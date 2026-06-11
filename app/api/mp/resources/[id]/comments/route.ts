import { respData, respErr, respInvalidParams, respNotFound, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findResourceByUuid } from "@/models/resource";
import { addResourceComment, getResourceComments, getResourceCommentsCount, getCommentById } from "@/models/comment";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource?.id || resource.status !== "approved") {
      return respNotFound("资源不存在或暂不可访问");
    }

    const { searchParams } = new URL(req.url);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100);

    const [comments, total] = await Promise.all([
      getResourceComments(resource.id, offset, limit),
      getResourceCommentsCount(resource.id),
    ]);

    return respData({ comments, total, offset, limit });
  } catch (error) {
    log.error("获取小程序资源评论失败", error as Error);
    return respErr("获取评论失败");
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
    const content = body?.content?.toString().trim();
    const parentId = body?.parent_id ? parseInt(body.parent_id) : undefined;

    if (!content) return respInvalidParams("评论内容不能为空");
    if (content.length > 1000) return respInvalidParams("评论内容不能超过1000字符");
    if (parentId && parentId <= 0) return respInvalidParams("无效的父评论ID");

    if (parentId) {
      const parentComment = await getCommentById(parentId);
      if (!parentComment || parentComment.resource_id !== resource.id) {
        return respInvalidParams("父评论不存在或不属于当前资源");
      }
    }

    const comment = await addResourceComment({
      resource_id: resource.id,
      user_uuid: user.uuid,
      content,
      parent_id: parentId,
      status: "approved",
    });

    return respData({
      comment: {
        ...comment,
        author: {
          uuid: user.uuid,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
        },
        replies: [],
        reply_count: 0,
      },
      message: "评价发布成功",
    });
  } catch (error) {
    log.error("发布小程序资源评论失败", error as Error);
    return respErr("发布评价失败");
  }
}
