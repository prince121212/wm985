import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getUserFavorites } from "@/models/favorite";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const { searchParams } = new URL(req.url);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100);
    const allFavorites = await getUserFavorites(user.uuid, offset, limit);
    const favorites = allFavorites.filter(item => item.resource && item.resource.is_free !== false);

    return respData({ favorites, total: favorites.length, offset, limit });
  } catch (error) {
    log.error("获取小程序我的收藏失败", error as Error);
    return respErr("获取我的收藏失败");
  }
}
