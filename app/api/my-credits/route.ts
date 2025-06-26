import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";
import { getCreditsByUserUuid } from "@/models/credit";
import { findResourceByUuid } from "@/models/resource";

// GET /api/my-credits - 获取当前用户的积分记录
export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // 最大100条

    log.info("获取用户积分记录", { user_uuid, page, limit });

    const result = await getCreditsByUserUuid(user_uuid, page, limit);
    const credits = result || [];

    // 暂时简化处理，直接返回积分记录，不获取资源信息
    const enrichedCredits = credits.map(credit => ({
      ...credit,
      resource: null
    }));

    // 判断是否还有更多数据：如果当前页返回的记录数等于limit，说明可能还有更多数据
    const hasMore = credits.length === limit;

    return respData({
      credits: enrichedCredits,
      total: credits.length, // 当前页的记录数
      hasMore, // 是否还有更多数据
      page,
      limit
    });

  } catch (error) {
    log.error("获取用户积分记录失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
    });
    return respErr("获取积分记录失败");
  }
}
