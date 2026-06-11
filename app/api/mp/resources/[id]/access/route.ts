import { respData, respErr, respInvalidParams, respNotFound } from "@/lib/resp";
import { findResourceByUuid, incrementResourceAccess } from "@/models/resource";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/mp/resources/[id]/access - 小程序端记录资源访问（不做扣费，只支持免费资源）
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource || resource.status !== "approved" || !resource.is_free) {
      return respNotFound("资源不存在或暂不支持在小程序中访问");
    }

    incrementResourceAccess(id).catch(error => {
      log.warn("小程序更新资源访问量失败", {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return respData({
      message: "访问记录成功",
      resource_url: resource.file_url,
      credits_cost: 0,
    });
  } catch (error) {
    log.error("小程序记录资源访问失败", error as Error);
    return respErr("访问记录失败");
  }
}
