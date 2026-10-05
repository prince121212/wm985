import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getUserFavorites } from "@/models/favorite";
import { log } from "@/lib/logger";
import { publicMpResource } from '@/lib/mp-resource-access-policy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const { searchParams } = new URL(req.url);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100);
    const favorites = await getUserFavorites(user.uuid, offset, limit);

    const response = respData({
      favorites: favorites.map(item => ({ ...item, resource: item.resource ? publicMpResource(item.resource, req) : item.resource })),
      total: favorites.length, offset, limit,
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Vary', 'X-MP-Resource-Access-Version');
    return response;
  } catch (error) {
    log.error("获取小程序我的收藏失败", error as Error);
    return respErr("获取我的收藏失败");
  }
}
