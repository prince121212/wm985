import crypto from "crypto";
import { respData, respErr, respInvalidParams } from "@/lib/resp";
import { createMpToken } from "@/lib/mp-auth";
import { getIsoTimestr, getOneYearLaterTimestr } from "@/lib/time";
import { getUniSeq, getUuid } from "@/lib/hash";
import { log } from "@/lib/logger";
import { insertUser, findUserBySigninOpenid, updateUserProfile } from "@/models/user";
import { increaseCredits, CreditsAmount, CreditsTransType } from "@/services/credit";
import { User } from "@/types/user";

export const dynamic = 'force-dynamic';

const WECHAT_MP_PROVIDER = "wechat_mp";

function openidEmail(openid: string): string {
  const hash = crypto.createHash("sha1").update(openid).digest("hex");
  return `mp_${hash}@wechat-mini.wm985.local`;
}

async function getWechatOpenid(code: string): Promise<{ openid: string; session_key?: string; unionid?: string }> {
  const appid = process.env.WECHAT_MP_APPID;
  const secret = process.env.WECHAT_MP_SECRET;

  if (!appid || !secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("WECHAT_MP_APPID or WECHAT_MP_SECRET is not configured");
    }
    return { openid: `dev_${code || getUuid()}` };
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url.toString(), { cache: "no-store" });
  const data = await response.json();

  if (!response.ok || data.errcode) {
    throw new Error(data.errmsg || "微信登录失败");
  }
  if (!data.openid) {
    throw new Error("微信登录未返回 openid");
  }

  return data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body?.code?.toString();
    const nickname = body?.nickname?.toString()?.trim();
    const avatarUrl = body?.avatar_url?.toString()?.trim() || body?.avatarUrl?.toString()?.trim();

    if (!code) {
      return respInvalidParams("缺少微信登录 code");
    }

    const wxSession = await getWechatOpenid(code);
    let user = await findUserBySigninOpenid(WECHAT_MP_PROVIDER, wxSession.openid);
    const now = getIsoTimestr();

    if (!user) {
      const newUser: User = {
        uuid: getUuid(),
        email: openidEmail(wxSession.openid),
        created_at: now,
        nickname: nickname || `微信用户${wxSession.openid.slice(-4)}`,
        avatar_url: avatarUrl || "",
        locale: "zh",
        signin_type: WECHAT_MP_PROVIDER,
        signin_provider: WECHAT_MP_PROVIDER,
        signin_openid: wxSession.openid,
        invite_code: getUniSeq("mp"),
        invited_by: "",
        is_affiliate: false,
        email_verified: true,
        email_verified_at: now,
      };

      await insertUser(newUser);
      await increaseCredits({
        user_uuid: newUser.uuid!,
        trans_type: CreditsTransType.NewUser,
        credits: CreditsAmount.NewUserGet,
        expired_at: getOneYearLaterTimestr(),
      });
      user = newUser;
    } else if ((nickname && nickname !== user.nickname) || (avatarUrl && avatarUrl !== user.avatar_url)) {
      await updateUserProfile(user.uuid!, {
        nickname: nickname || user.nickname,
        avatar_url: avatarUrl || user.avatar_url,
      });
      user = { ...user, nickname: nickname || user.nickname, avatar_url: avatarUrl || user.avatar_url };
    }

    const token = createMpToken({ user_uuid: user.uuid!, openid: wxSession.openid });

    log.audit("小程序登录成功", { user_uuid: user.uuid, provider: WECHAT_MP_PROVIDER });

    return respData({
      token,
      user: {
        uuid: user.uuid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        invite_code: user.invite_code,
      },
    });
  } catch (error) {
    log.error("小程序登录失败", error as Error);
    return respErr(error instanceof Error ? error.message : "小程序登录失败");
  }
}
