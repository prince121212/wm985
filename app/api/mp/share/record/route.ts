import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findUserByUuid } from "@/models/user";
import { createMpShareReward, MP_SHARE_REWARD_CREDITS } from "@/models/mp-share";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) {
      return respUnauthorized("用户未登录");
    }

    const body = await req.json();
    const inviterUuid = body?.share_user?.toString() || body?.inviter_uuid?.toString();
    const scene = body?.scene?.toString();
    const targetType = body?.target_type?.toString();
    const targetId = body?.target_id?.toString();

    if (!inviterUuid) {
      return respInvalidParams("缺少分享人");
    }

    const inviter = await findUserByUuid(inviterUuid);
    if (!inviter?.uuid) {
      return respInvalidParams("分享人不存在");
    }

    const result = await createMpShareReward({
      inviterUuid: inviter.uuid,
      inviteeUuid: user.uuid,
      scene,
      targetType,
      targetId,
    });

    return respData({
      ...result,
      credits: MP_SHARE_REWARD_CREDITS,
      message: result.rewarded
        ? `分享成功，双方各得${MP_SHARE_REWARD_CREDITS}积分`
        : "分享已记录或不满足奖励条件",
    });
  } catch (error) {
    log.error("记录小程序分享奖励失败", error as Error);
    return respErr("记录分享奖励失败");
  }
}
