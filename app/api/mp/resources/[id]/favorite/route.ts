import { respData, respErr, respInvalidParams, respNotFound, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findResourceByUuid } from "@/models/resource";
import { isFavorited, toggleFavorite } from "@/models/favorite";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource?.id) return respNotFound("资源不存在");

    const favorited = await isFavorited(user.uuid, resource.id);
    return respData({ favorited });
  } catch (error) {
    log.error("获取小程序收藏状态失败", error as Error);
    return respErr("获取收藏状态失败");
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource?.id || resource.status !== "approved") {
      return respNotFound("资源不存在或暂不可收藏");
    }

    const result = await toggleFavorite(user.uuid, resource.id);
    return respData({
      action: result.action,
      favorited: result.action === "added",
      message: result.action === "added" ? "收藏成功" : "已取消收藏",
    });
  } catch (error) {
    log.error("小程序收藏操作失败", error as Error);
    return respErr("收藏操作失败");
  }
}
