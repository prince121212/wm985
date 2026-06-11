import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findUserByUuid, updateUserProfile } from "@/models/user";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const body = await req.json();
    const nickname = body?.nickname?.toString().trim();
    const avatarUrl = body?.avatar_url?.toString().trim();

    if (nickname !== undefined && nickname.length === 0) {
      return respInvalidParams("昵称不能为空");
    }
    if (nickname && nickname.length > 50) {
      return respInvalidParams("昵称不能超过50个字符");
    }

    const updateData: { nickname?: string; avatar_url?: string } = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

    if (Object.keys(updateData).length === 0) {
      return respInvalidParams("没有可更新的资料");
    }

    await updateUserProfile(user.uuid, updateData);
    const updatedUser = await findUserByUuid(user.uuid);

    return respData({
      user: {
        uuid: updatedUser?.uuid || user.uuid,
        nickname: updatedUser?.nickname || nickname || user.nickname,
        avatar_url: updatedUser?.avatar_url || avatarUrl || user.avatar_url,
        invite_code: updatedUser?.invite_code || user.invite_code,
      },
      message: "个人资料保存成功",
    });
  } catch (error) {
    log.error("更新小程序个人资料失败", error as Error);
    return respErr("更新个人资料失败");
  }
}
