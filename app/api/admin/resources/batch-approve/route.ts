import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getSupabaseClient, withRetry } from "@/models/db";
import { updateCategoryResourceCount } from "@/models/category";

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';

// POST /api/admin/resources/batch-approve - 批量审核通过所有待审核资源
export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    log.info("管理员开始批量审核资源", { user_uuid, action: "batch-approve" });

    // 获取所有待审核资源
    const pendingResources = await getPendingResources();
    
    if (pendingResources.length === 0) {
      return respData({
        message: "没有待审核的资源",
        total_count: 0,
        approved_count: 0,
        failed_count: 0
      });
    }

    log.info("获取到待审核资源", { 
      count: pendingResources.length,
      user_uuid 
    });

    // 批量审核通过资源
    const result = await batchApproveResources(pendingResources, user_uuid);

    log.info("批量审核完成", {
      user_uuid,
      totalCount: pendingResources.length,
      approvedCount: result.approved_count,
      failedCount: result.failed_count
    });

    return respData({
      message: `批量审核完成！成功：${result.approved_count}个，失败：${result.failed_count}个`,
      total_count: pendingResources.length,
      approved_count: result.approved_count,
      failed_count: result.failed_count,
      failed_resources: result.failed_resources
    });

  } catch (error) {
    log.error("批量审核资源失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
      action: "batch-approve"
    });

    return respErr("批量审核失败，请稍后再试");
  }
}

// 获取所有待审核资源
async function getPendingResources(): Promise<Array<{
  uuid: string;
  title: string;
  author_id: string;
  category_id: number;
}>> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from("resources")
      .select("uuid, title, author_id, category_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true }); // 按创建时间排序，先创建的先审核

    if (error) {
      log.error("获取待审核资源失败", error);
      throw error;
    }

    return data || [];
  });
}

// 批量审核通过资源
async function batchApproveResources(
  resources: Array<{
    uuid: string;
    title: string;
    author_id: string;
    category_id: number;
  }>,
  adminUuid: string
): Promise<{
  approved_count: number;
  failed_count: number;
  failed_resources: Array<{ uuid: string; title: string; error: string }>;
}> {
  const supabase = getSupabaseClient();
  let approved_count = 0;
  let failed_count = 0;
  const failed_resources: Array<{ uuid: string; title: string; error: string }> = [];
  
  // 收集需要更新统计的用户和分类
  const affectedAuthors = new Set<string>();
  const affectedCategories = new Set<number>();

  // 批量更新资源状态
  try {
    const resourceUuids = resources.map(r => r.uuid);
    
    const { error: batchUpdateError } = await supabase
      .from("resources")
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .in("uuid", resourceUuids)
      .eq("status", "pending"); // 只更新状态为pending的资源

    if (batchUpdateError) {
      log.error("批量更新资源状态失败", batchUpdateError);
      throw batchUpdateError;
    }

    // 记录成功审核的资源
    approved_count = resources.length;
    
    // 收集需要更新统计的用户和分类
    resources.forEach(resource => {
      affectedAuthors.add(resource.author_id);
      affectedCategories.add(resource.category_id);
    });

    log.info("批量更新资源状态成功", {
      approvedCount: approved_count,
      affectedAuthors: affectedAuthors.size,
      affectedCategories: affectedCategories.size
    });

  } catch (error) {
    log.error("批量更新资源状态失败", error as Error);
    
    // 如果批量更新失败，尝试逐个更新
    for (const resource of resources) {
      try {
        const { error: singleUpdateError } = await supabase
          .from("resources")
          .update({ 
            status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq("uuid", resource.uuid)
          .eq("status", "pending");

        if (singleUpdateError) {
          throw singleUpdateError;
        }

        approved_count++;
        affectedAuthors.add(resource.author_id);
        affectedCategories.add(resource.category_id);

      } catch (singleError) {
        failed_count++;
        failed_resources.push({
          uuid: resource.uuid,
          title: resource.title,
          error: singleError instanceof Error ? singleError.message : '未知错误'
        });
        
        log.error("单个资源审核失败", singleError as Error, {
          resourceUuid: resource.uuid,
          resourceTitle: resource.title
        });
      }
    }
  }

  // 批量更新用户统计
  if (affectedAuthors.size > 0) {
    await batchUpdateUserStats(Array.from(affectedAuthors));
  }

  // 批量更新分类统计（异步执行，不阻塞主流程）
  if (affectedCategories.size > 0) {
    Promise.all(
      Array.from(affectedCategories).map(categoryId => 
        updateCategoryResourceCount(categoryId).catch((error: Error) => {
          log.error("更新分类资源数失败", error, { categoryId });
        })
      )
    ).catch(() => {
      // 忽略分类统计更新失败，不影响主流程
    });
  }

  return {
    approved_count,
    failed_count,
    failed_resources
  };
}

// 批量更新用户统计
async function batchUpdateUserStats(authorIds: string[]): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 为每个用户更新统计
    for (const authorId of authorIds) {
      try {
        // 计算用户当前已通过审核的资源数
        const { count, error: countError } = await supabase
          .from("resources")
          .select("*", { count: 'exact', head: true })
          .eq("author_id", authorId)
          .eq("status", "approved");

        if (countError) {
          log.error("计算用户审核通过资源数失败", countError, { authorId });
          continue; // 继续处理下一个用户
        }

        const approvedCount = count || 0;

        // 更新用户表中的总通过审核资源数
        const { error: updateError } = await supabase
          .from("users")
          .update({ total_approved_resources: approvedCount })
          .eq("uuid", authorId);

        if (updateError) {
          log.error("更新用户总通过审核资源数失败", updateError, { authorId, approvedCount });
          continue; // 继续处理下一个用户
        }

        log.info("用户统计更新成功", { 
          authorId, 
          newApprovedCount: approvedCount 
        });

      } catch (error) {
        log.error("更新用户统计失败", error as Error, { authorId });
        // 继续处理下一个用户，不中断整个流程
      }
    }
  });
}
