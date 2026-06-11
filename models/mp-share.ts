import { getSupabaseClient, withRetry } from "@/models/db";
import { findCreditByOrderNo } from "@/models/credit";
import { getUsersByUuids } from "@/models/user";
import { increaseCredits } from "@/services/credit";
import { getOneYearLaterTimestr } from "@/lib/time";
import { getUuid } from "@/lib/hash";
import { log } from "@/lib/logger";

export const MP_SHARE_REWARD_CREDITS = 20;

export interface MpShareReward {
  id?: number;
  uuid: string;
  inviter_uuid: string;
  invitee_uuid: string;
  scene?: string;
  target_type?: string;
  target_id?: string;
  reward_credits: number;
  created_at?: string;
  rewarded_at?: string;
  invitee?: {
    uuid: string;
    nickname?: string;
    avatar_url?: string;
  };
}

export async function findMpShareReward(inviterUuid: string, inviteeUuid: string): Promise<MpShareReward | null> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("mp_share_rewards")
      .select("*")
      .eq("inviter_uuid", inviterUuid)
      .eq("invitee_uuid", inviteeUuid)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data;
  });
}

async function grantShareRewardCredits(reward: {
  uuid: string;
  inviter_uuid: string;
  invitee_uuid: string;
}): Promise<void> {
  const expiredAt = getOneYearLaterTimestr();
  const inviterOrderNo = `MP_SHARE_${reward.uuid}_INVITER`;
  const inviteeOrderNo = `MP_SHARE_${reward.uuid}_INVITEE`;

  const [inviterCredit, inviteeCredit] = await Promise.all([
    findCreditByOrderNo(inviterOrderNo),
    findCreditByOrderNo(inviteeOrderNo),
  ]);

  await Promise.all([
    inviterCredit
      ? Promise.resolve()
      : increaseCredits({
          user_uuid: reward.inviter_uuid,
          trans_type: "share_reward",
          credits: MP_SHARE_REWARD_CREDITS,
          expired_at: expiredAt,
          order_no: inviterOrderNo,
        }),
    inviteeCredit
      ? Promise.resolve()
      : increaseCredits({
          user_uuid: reward.invitee_uuid,
          trans_type: "share_reward",
          credits: MP_SHARE_REWARD_CREDITS,
          expired_at: expiredAt,
          order_no: inviteeOrderNo,
        }),
  ]);
}

export async function createMpShareReward(params: {
  inviterUuid: string;
  inviteeUuid: string;
  scene?: string;
  targetType?: string;
  targetId?: string;
}): Promise<{ rewarded: boolean; reward?: MpShareReward; reason?: string }> {
  const { inviterUuid, inviteeUuid, scene, targetType, targetId } = params;

  if (!inviterUuid || !inviteeUuid) {
    return { rewarded: false, reason: "missing_user" };
  }
  if (inviterUuid === inviteeUuid) {
    return { rewarded: false, reason: "self_share" };
  }

  const existing = await findMpShareReward(inviterUuid, inviteeUuid);
  if (existing) {
    if (!existing.rewarded_at) {
      await grantShareRewardCredits(existing);
      const supabase = getSupabaseClient();
      const rewardedAt = new Date().toISOString();
      const { data: updated, error } = await supabase
        .from("mp_share_rewards")
        .update({ rewarded_at: rewardedAt })
        .eq("uuid", existing.uuid)
        .select()
        .single();

      if (error) {
        log.warn("恢复小程序分享奖励后更新时间失败", {
          rewardUuid: existing.uuid,
          error: error.message,
        });
        return { rewarded: true, reward: { ...existing, rewarded_at: rewardedAt }, reason: "reward_resumed" };
      }

      return { rewarded: true, reward: updated, reason: "reward_resumed" };
    }
    return { rewarded: false, reward: existing, reason: "already_rewarded" };
  }

  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const rewardUuid = getUuid();
    const payload = {
      uuid: rewardUuid,
      inviter_uuid: inviterUuid,
      invitee_uuid: inviteeUuid,
      scene: scene || "mini_program",
      target_type: targetType || null,
      target_id: targetId || null,
      reward_credits: MP_SHARE_REWARD_CREDITS,
    };

    const { data, error } = await supabase
      .from("mp_share_rewards")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { rewarded: false, reason: "already_rewarded" };
      }
      throw error;
    }

    await grantShareRewardCredits(data);

    const rewardedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("mp_share_rewards")
      .update({ rewarded_at: rewardedAt })
      .eq("uuid", rewardUuid)
      .select()
      .single();

    if (updateError) {
      log.warn("小程序分享奖励已发放但更新时间失败", { rewardUuid, error: updateError.message });
      return { rewarded: true, reward: data };
    }

    return { rewarded: true, reward: updated };
  });
}

export async function getMpShareRewardsByInviter(
  inviterUuid: string,
  offset: number = 0,
  limit: number = 50
): Promise<MpShareReward[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("mp_share_rewards")
      .select("*")
      .eq("inviter_uuid", inviterUuid)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const rewards = (data || []) as MpShareReward[];
    const inviteeUuids = [...new Set(rewards.map((reward) => reward.invitee_uuid).filter(Boolean))];
    const invitees = inviteeUuids.length > 0 ? await getUsersByUuids(inviteeUuids) : [];
    const inviteeMap = new Map(invitees.map((user) => [user.uuid, user]));

    return rewards.map((reward) => {
      const invitee = inviteeMap.get(reward.invitee_uuid);
      return {
        ...reward,
        invitee: invitee
          ? {
              uuid: invitee.uuid!,
              nickname: invitee.nickname,
              avatar_url: invitee.avatar_url,
            }
          : undefined,
      };
    });
  });
}

export async function getMpShareRewardsCount(inviterUuid: string): Promise<number> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("mp_share_rewards")
      .select("*", { count: "exact", head: true })
      .eq("inviter_uuid", inviterUuid);

    if (error) {
      throw error;
    }

    return count || 0;
  });
}
