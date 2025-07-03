import {
  AffiliateRewardAmount,
  AffiliateRewardPercent,
  AffiliateStatus,
} from "@/services/constant";
import {
  findUserByInviteCode,
  findUserByUuid,
  updateUserInvitedBy,
} from "@/models/user";
import { respData, respErr } from "@/lib/resp";

import { getIsoTimestr } from "@/lib/time";
import { insertAffiliate } from "@/models/affiliate";
import { increaseCredits, CreditsTransType, CreditsAmount } from "@/services/credit";
import { getCreditsByUserUuid } from "@/models/credit";
import { getOneYearLaterTimestr } from "@/lib/time";
import { log } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const { invite_code, user_uuid } = await req.json();
    if (!invite_code || !user_uuid) {
      return respErr("invalid params");
    }

    // check invite user
    const inviteUser = await findUserByInviteCode(invite_code);
    if (!inviteUser) {
      return respErr("invite user not found");
    }

    // check current user
    const user = await findUserByUuid(user_uuid);
    if (!user) {
      return respErr("user not found");
    }

    if (user.uuid === inviteUser.uuid || user.email === inviteUser.email) {
      return respErr("can't invite yourself");
    }

    if (user.invited_by) {
      return respErr("user already has invite user");
    }

    user.invited_by = inviteUser.uuid;

    // update invite user uuid
    await updateUserInvitedBy(user_uuid, inviteUser.uuid);

    // 立即给邀请者发放注册奖励积分
    if (AffiliateRewardAmount.Invited > 0) {
      await increaseCredits({
        user_uuid: inviteUser.uuid,
        trans_type: CreditsTransType.SystemAdd,
        credits: AffiliateRewardAmount.Invited,
        expired_at: getOneYearLaterTimestr(),
        order_no: `INVITE_REWARD_${user_uuid}_${Date.now()}`
      });

      log.info("邀请注册奖励发放成功", {
        inviter_uuid: inviteUser.uuid,
        invitee_uuid: user_uuid,
        reward_credits: AffiliateRewardAmount.Invited
      });
    }

    // 检查被邀请者是否已经获得过被邀请奖励
    const userCredits = await getCreditsByUserUuid(user_uuid, 1, 100);
    const hasInviteeBonus = userCredits?.some(credit => credit.trans_type === CreditsTransType.InviteeBonus);

    // 如果被邀请者还没有获得过被邀请奖励，则发放
    if (!hasInviteeBonus && CreditsAmount.InviteeBonus > 0) {
      await increaseCredits({
        user_uuid: user_uuid,
        trans_type: CreditsTransType.InviteeBonus,
        credits: CreditsAmount.InviteeBonus,
        expired_at: getOneYearLaterTimestr(),
        order_no: `INVITEE_BONUS_${user_uuid}_${Date.now()}`
      });

      log.info("被邀请者奖励发放成功", {
        invitee_uuid: user_uuid,
        inviter_uuid: inviteUser.uuid,
        bonus_credits: CreditsAmount.InviteeBonus
      });
    } else if (hasInviteeBonus) {
      log.info("被邀请者已获得过奖励，跳过发放", {
        invitee_uuid: user_uuid,
        inviter_uuid: inviteUser.uuid
      });
    }



    await insertAffiliate({
      user_uuid: user_uuid,
      invited_by: inviteUser.uuid,
      created_at: getIsoTimestr(),
      status: AffiliateStatus.Completed, // 改为已完成状态，因为奖励已发放
      paid_order_no: "",
      paid_amount: 0,
      reward_percent: AffiliateRewardPercent.Invited,
      reward_amount: AffiliateRewardAmount.Invited,
    });

    return respData(user);
  } catch (e) {
    console.error("update invited by failed: ", e);
    return respErr("update invited by failed");
  }
}
