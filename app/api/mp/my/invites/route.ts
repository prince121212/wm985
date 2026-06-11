import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getMpShareRewardsByInviter, getMpShareRewardsCount, MP_SHARE_REWARD_CREDITS } from "@/models/mp-share";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) {
      return respUnauthorized("用户未登录");
    }

    const { searchParams } = new URL(req.url);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 100);

    const [rewards, total] = await Promise.all([
      getMpShareRewardsByInviter(user.uuid, offset, limit),
      getMpShareRewardsCount(user.uuid),
    ]);

    return respData({
      rewards,
      total,
      reward_credits: MP_SHARE_REWARD_CREDITS,
      offset,
      limit,
    });
  } catch (error) {
    log.error("获取小程序邀请记录失败", error as Error);
    return respErr("获取邀请记录失败");
  }
}
