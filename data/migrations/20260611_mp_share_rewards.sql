-- 小程序分享奖励表
-- 说明：好友通过分享进入小程序后，分享人与好友各得 20 积分；同一邀请关系只奖励一次。
CREATE TABLE IF NOT EXISTS mp_share_rewards (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    inviter_uuid VARCHAR(255) NOT NULL REFERENCES users(uuid),
    invitee_uuid VARCHAR(255) NOT NULL REFERENCES users(uuid),
    scene VARCHAR(100),
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    reward_credits INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rewarded_at TIMESTAMPTZ,
    UNIQUE(inviter_uuid, invitee_uuid)
);

CREATE INDEX IF NOT EXISTS idx_mp_share_rewards_inviter ON mp_share_rewards(inviter_uuid);
CREATE INDEX IF NOT EXISTS idx_mp_share_rewards_invitee ON mp_share_rewards(invitee_uuid);
CREATE INDEX IF NOT EXISTS idx_mp_share_rewards_created_at ON mp_share_rewards(created_at DESC);
