import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";
import { getSupabaseClient, withRetry } from "@/models/db";

// POST /api/users/refresh-total-access - 刷新当前用户的总访问数
export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    log.info("刷新用户总访问数", { user_uuid });

    const totalAccessCount = await refreshUserTotalAccess(user_uuid);

    return respData({
      total_access_count: totalAccessCount
    });

  } catch (error) {
    log.error("刷新用户总访问数失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
    });
    return respErr("刷新总访问数失败");
  }
}

// 刷新用户总访问数
async function refreshUserTotalAccess(userUuid: string): Promise<number> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 1. 计算用户所有已审核资源的总访问数
    const { data: resources, error: resourcesError } = await supabase
      .from("resources")
      .select("access_count")
      .eq("author_id", userUuid)
      .eq("status", "approved"); // 只统计已审核通过的资源

    if (resourcesError) {
      log.error("获取用户资源访问数失败", resourcesError, { userUuid });
      throw resourcesError;
    }

    const totalAccessCount = resources?.reduce((sum, resource) => sum + (resource.access_count || 0), 0) || 0;

    // 2. 更新用户表中的总访问数
    const { error: updateError } = await supabase
      .from("users")
      .update({ total_access_count: totalAccessCount })
      .eq("uuid", userUuid);

    if (updateError) {
      log.error("更新用户总访问数失败", updateError, { userUuid, totalAccessCount });
      throw updateError;
    }

    log.info("用户总访问数刷新成功", {
      userUuid,
      totalAccessCount
    });

    return totalAccessCount;
  });
}
