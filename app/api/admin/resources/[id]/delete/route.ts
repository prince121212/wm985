import { respData, respErr, respInvalidParams, respUnauthorized, respNotFound } from "@/lib/resp";
import { getUserUuid, isUserAdmin, getUserEmail } from "@/services/user";
import { log } from "@/lib/logger";
import { findResourceByUuid } from "@/models/resource";
import { getSupabaseClient, withRetry } from "@/models/db";
import { getResourceTags, decrementTagUsage } from "@/models/tag";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// 更新用户的总通过审核资源数
async function updateUserApprovedResourcesCount(authorId: string) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    // 计算用户当前通过审核的资源数
    const { count, error: countError } = await supabase
      .from("resources")
      .select('id', { count: 'exact', head: true })
      .eq("author_id", authorId)
      .eq("status", "approved");

    if (countError) {
      log.error("计算用户通过审核资源数失败", countError, { authorId });
      throw countError;
    }

    // 更新用户表中的统计数据
    const { error: updateError } = await supabase
      .from("users")
      .update({ total_approved_resources: count || 0 })
      .eq("uuid", authorId);

    if (updateError) {
      log.error("更新用户通过审核资源数失败", updateError, { authorId });
      throw updateError;
    }

    log.info("用户通过审核资源数更新成功", { 
      authorId, 
      newCount: count || 0 
    });
  });
}

// DELETE /api/admin/resources/[id]/delete - 删除资源
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const user_uuid = await getUserUuid();
    const user_email = await getUserEmail();

    if (!user_uuid || !user_email) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    const { id } = await params;
    if (!id) {
      return respInvalidParams("资源ID不能为空");
    }

    log.info("管理员删除资源", { resourceId: id, user_uuid, action: "delete" });

    // 检查资源是否存在
    const resource = await findResourceByUuid(id);
    if (!resource) {
      return respNotFound("资源不存在");
    }

    const resourceInfo = {
      uuid: resource.uuid,
      title: resource.title,
      status: resource.status,
      authorId: resource.author_id
    };

    // 在删除资源前，先获取资源的标签并减少使用次数
    if (resource.id) {
      const resourceTags = await getResourceTags(resource.id);
      if (resourceTags.length > 0) {
        // 减少标签使用次数
        await Promise.all(
          resourceTags.map(tag => decrementTagUsage(tag.id!))
        );
        log.info("已减少标签使用次数", {
          resourceId: id,
          tagCount: resourceTags.length,
          tags: resourceTags.map(t => t.name)
        });
      }
    }

    // 删除资源（由于设置了 ON DELETE CASCADE，相关的评论、收藏、评分等会自动删除）
    await withRetry(async () => {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from("resources")
        .delete()
        .eq("uuid", id);

      if (error) {
        log.error("删除资源失败", error, { resourceId: id });
        throw error;
      }
    });

    // 如果删除的是已通过审核的资源，更新用户的总通过审核资源数
    if (resource.status === 'approved') {
      await updateUserApprovedResourcesCount(resource.author_id);
    }

    log.info("资源已删除", {
      resourceId: id,
      title: resource.title,
      status: resource.status,
      user_uuid,
      authorId: resource.author_id
    });

    return respData({
      message: "资源已删除",
      resource: resourceInfo
    });

  } catch (error) {
    log.error("删除资源失败", error as Error, {
      resourceId: await params.then(p => p.id),
      user_uuid: await getUserUuid().catch(() => 'unknown'),
    });

    return respErr("删除资源失败");
  }
}
