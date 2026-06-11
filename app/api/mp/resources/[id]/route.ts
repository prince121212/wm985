import { respData, respErr, respInvalidParams, respNotFound, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { deleteResource, findResourceByUuid, incrementResourceViews } from "@/models/resource";
import { decrementTagUsage, getResourceTags } from "@/models/tag";
import { getSupabaseClient, withRetry } from "@/models/db";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getAuthorStats(authorUuid?: string): Promise<{ uploadedResourcesCount: number; totalVisitors: number } | null> {
  if (!authorUuid) return null;
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("total_access_count, total_approved_resources")
      .eq("uuid", authorUuid)
      .single();

    if (error) {
      log.warn("获取小程序资源作者统计失败", {
        authorUuid,
        error: error instanceof Error ? error.message : String(error),
      });
      return { uploadedResourcesCount: 0, totalVisitors: 0 };
    }

    return {
      uploadedResourcesCount: data?.total_approved_resources || 0,
      totalVisitors: data?.total_access_count || 0,
    };
  });
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource || resource.status !== "approved") {
      return respNotFound("资源不存在或暂不可访问");
    }

    let authorStats = null;
    if (resource.id) {
      const tags = await getResourceTags(resource.id);
      resource.tags = tags.filter(tag => tag.id !== undefined).map(tag => ({
        id: tag.id!,
        name: tag.name,
        color: tag.color,
      }));
      authorStats = await getAuthorStats(resource.author?.uuid || resource.author_id);
      incrementResourceViews(id).catch(error => {
        log.warn("小程序更新资源浏览量失败", { resourceId: id, error: error instanceof Error ? error.message : String(error) });
      });
    }

    return respData({ resource, author_stats: authorStats });
  } catch (error) {
    log.error("获取小程序资源详情失败", error as Error);
    return respErr("获取资源详情失败");
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource) return respNotFound("资源不存在");
    if (resource.author_id !== user.uuid) return respUnauthorized("无权限删除此资源");

    if (resource.id) {
      const resourceTags = await getResourceTags(resource.id);
      await Promise.all(resourceTags.map(tag => tag.id ? decrementTagUsage(tag.id) : Promise.resolve()));
    }

    await deleteResource(id);

    return respData({ message: "资源删除成功" });
  } catch (error) {
    log.error("删除小程序资源失败", error as Error);
    return respErr("删除资源失败");
  }
}
