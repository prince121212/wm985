import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { getUserResources, getUserResourcesCount } from "@/models/resource";
import { getSupabaseClient, withRetry } from "@/models/db";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

async function getUploadStats(userUuid: string) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resources")
      .select("status, view_count, access_count")
      .eq("author_id", userUuid);

    if (error) {
      log.error("获取小程序上传统计失败", error, { userUuid });
      throw error;
    }

    const resources = data || [];
    return {
      total: resources.length,
      pending: resources.filter(item => item.status === "pending").length,
      approved: resources.filter(item => item.status === "approved").length,
      rejected: resources.filter(item => item.status === "rejected").length,
      totalViews: resources.reduce((sum, item) => sum + (item.view_count || 0), 0),
      totalAccess: resources.reduce((sum, item) => sum + (item.access_count || 0), 0),
    };
  });
}

export async function GET(req: Request) {
  try {
    const user = await getMpUser(req);
    if (!user?.uuid) return respUnauthorized("用户未登录");

    const { searchParams } = new URL(req.url);
    const params = {
      author_id: user.uuid,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      sort: searchParams.get("sort") || "latest",
      offset: Math.max(parseInt(searchParams.get("offset") || "0"), 0),
      limit: Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100),
    };

    const [resources, total, stats] = await Promise.all([
      getUserResources(params),
      getUserResourcesCount(user.uuid, params.status),
      getUploadStats(user.uuid),
    ]);

    return respData({
      resources,
      total,
      stats,
      offset: params.offset,
      limit: params.limit,
    });
  } catch (error) {
    log.error("获取小程序我的上传失败", error as Error);
    return respErr("获取我的上传失败");
  }
}
