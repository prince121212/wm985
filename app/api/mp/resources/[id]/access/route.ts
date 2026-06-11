import { respData, respErr, respInvalidParams, respNotFound, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findResourceByUuid, incrementResourceAccess } from "@/models/resource";
import { decreaseCredits, getUserCredits, increaseCredits, CreditsTransType } from "@/services/credit";
import { log } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/mp/resources/[id]/access - 小程序端记录访问；积分资源扣除积分后返回原始链接
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource || resource.status !== "approved") {
      return respNotFound("资源不存在或暂不可访问");
    }

    let userUuid = "";
    const creditsCost = resource.is_free ? 0 : (resource.credits || 0);

    if (creditsCost > 0) {
      const user = await getMpUser(req);
      if (!user?.uuid) return respUnauthorized("请先登录后访问资源");
      userUuid = user.uuid;

      const balance = await getUserCredits(user.uuid);
      if ((balance.left_credits || 0) < creditsCost) {
        return respErr(`积分不足，需要${creditsCost}积分，当前余额${balance.left_credits || 0}积分`, 1003);
      }

      await decreaseCredits({
        user_uuid: user.uuid,
        trans_type: CreditsTransType.ResourceAccess,
        credits: creditsCost,
        order_no: resource.uuid,
      });

      if (resource.author_id && resource.author_id !== user.uuid) {
        increaseCredits({
          user_uuid: resource.author_id,
          trans_type: CreditsTransType.ResourceReward,
          credits: creditsCost,
          order_no: `RESOURCE_REWARD_${resource.uuid}_${Date.now()}`,
        }).catch(error => {
          log.warn("小程序资源作者奖励发放失败", {
            resourceUuid: resource.uuid,
            author_id: resource.author_id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    incrementResourceAccess(id).catch(error => {
      log.warn("小程序更新资源访问量失败", {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return respData({
      message: creditsCost > 0 ? `已扣除${creditsCost}积分` : "访问记录成功",
      resource_url: resource.file_url,
      credits_cost: creditsCost,
      user_uuid: userUuid,
    });
  } catch (error) {
    log.error("小程序记录资源访问失败", error as Error);
    return respErr("访问失败，请稍后再试");
  }
}
