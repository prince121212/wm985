import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getUserCredits } from "@/services/credit";
import { getUserFavoriteCount } from "@/models/favorite";
import { getUserResourcesCount } from "@/models/resource";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) {
      return respUnauthorized("用户未登录");
    }

    const [credits, favoriteCount, uploadCount, pendingCount] = await Promise.all([
      getUserCredits(user.uuid),
      getUserFavoriteCount(user.uuid),
      getUserResourcesCount(user.uuid),
      getUserResourcesCount(user.uuid, "pending"),
    ]);

    return respData({
      user: {
        uuid: user.uuid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        invite_code: user.invite_code,
      },
      credits,
      stats: {
        favorites: favoriteCount,
        uploads: uploadCount,
        pending: pendingCount,
      },
    });
  } catch (error) {
    log.error("获取小程序用户信息失败", error as Error);
    return respErr("获取用户信息失败");
  }
}
