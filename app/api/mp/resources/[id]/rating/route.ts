import { respData, respErr, respInvalidParams, respNotFound, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findResourceByUuid } from "@/models/resource";
import { addResourceRating, getUserResourceRating } from "@/models/rating";
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
    if (!resource?.id || resource.status !== "approved") {
      return respNotFound("资源不存在或暂不可访问");
    }

    const rating = await getUserResourceRating(user.uuid, resource.id);
    return respData({
      rating: rating?.rating || 0,
      has_rated: !!rating,
      rated_at: rating?.created_at || null,
    });
  } catch (error) {
    log.error("获取小程序用户评分失败", error as Error);
    return respErr("获取评分失败");
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
      return respNotFound("资源不存在或暂不可评价");
    }

    const body = await req.json();
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return respInvalidParams("评分必须是1-5之间的整数");
    }

    const ratingResult = await addResourceRating({
      user_uuid: user.uuid,
      resource_id: resource.id,
      rating,
    });
    const updatedResource = await findResourceByUuid(id);

    return respData({
      rating: ratingResult.rating,
      has_rated: true,
      rated_at: ratingResult.created_at,
      rating_avg: updatedResource?.rating_avg ?? resource.rating_avg,
      rating_count: updatedResource?.rating_count ?? resource.rating_count,
      message: "评分成功",
    });
  } catch (error) {
    log.error("提交小程序用户评分失败", error as Error);
    return respErr("评分失败");
  }
}
