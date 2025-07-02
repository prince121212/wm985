import { respData, respErr, respInvalidParams, respNotFound } from "@/lib/resp";
import { log } from "@/lib/logger";
import { getSupabaseClient, withRetry } from "@/models/db";

interface RouteParams {
  params: Promise<{
    uuid: string;
  }>;
}

// GET /api/users/[uuid]/stats - 获取用户统计信息
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { uuid } = await params;

    if (!uuid) {
      return respInvalidParams("用户UUID不能为空");
    }

    // 检查是否需要强制刷新
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    log.info("获取用户统计信息", {
      userUuid: uuid,
      forceRefresh
    });

    const stats = await getUserStats(uuid, forceRefresh);

    return respData({
      stats
    });

  } catch (error) {
    log.error("获取用户统计信息失败", error as Error, {
      userUuid: (await params).uuid
    });
    return respErr("获取用户统计信息失败");
  }
}

// 获取用户统计信息
async function getUserStats(userUuid: string, forceRefresh: boolean = false): Promise<{
  uploadedResourcesCount: number;
  totalVisitors: number;
}> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 根据 forceRefresh 参数决定查询方式
    let queryBuilder = supabase
      .from("users")
      .select("total_access_count, total_approved_resources")
      .eq("uuid", userUuid);

    // 如果强制刷新，添加额外条件来绕过查询缓存
    if (forceRefresh) {
      queryBuilder = queryBuilder.eq("created_at", "created_at");
    }

    const { data, error } = await queryBuilder.single();

    if (error) {
      log.error("获取用户统计信息失败", error, { userUuid });
      throw error;
    }

    const uploadedResourcesCount = data?.total_approved_resources || 0;
    const totalVisitors = data?.total_access_count || 0;

    log.info("用户统计信息获取成功", {
      userUuid,
      uploadedResourcesCount,
      totalVisitors
    });

    return {
      uploadedResourcesCount,
      totalVisitors
    };
  });
}
