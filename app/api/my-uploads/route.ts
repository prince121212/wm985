import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";
import { getUserResources, getUserResourcesCount } from "@/models/resource";

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';
import { getSupabaseClient, withRetry } from "@/models/db";

// GET /api/my-uploads - 获取当前用户上传的资源列表
export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    const { searchParams } = new URL(req.url);
    
    const params = {
      author_id: user_uuid,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      sort: searchParams.get('sort') || 'latest',
      offset: parseInt(searchParams.get('offset') || '0'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100), // 最大100条
    };

    log.info("获取用户上传资源列表", { user_uuid, ...params });

    // 并行获取资源列表、用户统计信息和总资源数
    const [resources, userStats, totalResources] = await Promise.all([
      getUserResources(params),
      getUserStatsFromDB(user_uuid),
      getUserResourcesCount(user_uuid, params.status) // 获取用户资源总数
    ]);

    // 计算统计信息
    const stats = {
      total: totalResources, // 使用真正的总数量
      approved: userStats.total_approved_resources, // 直接从用户表获取已通过审核的资源数
      pending: resources.filter(r => r.status === 'pending').length,
      rejected: resources.filter(r => r.status === 'rejected').length,
      totalViews: userStats.total_access_count, // 直接从用户表获取总访问数
    };

    return respData({
      resources,
      stats,
      offset: params.offset,
      limit: params.limit
    });

  } catch (error) {
    log.error("获取用户上传资源列表失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
    });
    return respErr("获取上传列表失败");
  }
}

// 获取用户统计信息
async function getUserStatsFromDB(userUuid: string): Promise<{
  total_access_count: number;
  total_approved_resources: number;
}> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("users")
      .select("total_access_count, total_approved_resources")
      .eq("uuid", userUuid)
      .single();

    if (error) {
      log.error("获取用户统计信息失败", error, { userUuid });
      // 如果获取失败，返回默认值而不是抛出错误，保证接口正常响应
      return {
        total_access_count: 0,
        total_approved_resources: 0
      };
    }

    return {
      total_access_count: data?.total_access_count || 0,
      total_approved_resources: data?.total_approved_resources || 0
    };
  });
}
