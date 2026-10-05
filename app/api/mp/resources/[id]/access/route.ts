import { respData, respErr, respForbidden, respInvalidParams, respNotFound, respUnauthorized } from "@/lib/resp";
import { getMpUser } from "@/lib/mp-auth";
import { findResourceByUuid, incrementResourceAccess } from "@/models/resource";
import { decreaseCredits, getUserCredits, increaseCredits, CreditsTransType } from "@/services/credit";
import { log } from "@/lib/logger";
import { completeResourceAdSession } from '@/models/mp-resource-ad';
import { hasResourceAdClaim, mpAdConfig, requiresResourceAdPolicy, resourceCreditsCost } from '@/lib/mp-resource-access-policy';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// New clients need resource-bound ad receipts. Old installed clients keep their protocol during rollout.
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return respInvalidParams("资源ID不能为空");

    const resource = await findResourceByUuid(id);
    if (!resource || resource.status !== "approved") {
      return respNotFound("资源不存在或暂不可访问");
    }

    if (!resource.file_url) return respNotFound('资源链接暂不可用');
    let userUuid = "";
    const creditsCost = resourceCreditsCost(resource);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respInvalidParams('请求数据无效');
    const requiresAd = requiresResourceAdPolicy(req, body);
    let countAccess = true;

    if (creditsCost > 0) {
      // The user consented to a free ad unlock, not a later price change.
      if (hasResourceAdClaim(body)) return respInvalidParams('资源访问方式已变更，请刷新页面后重试');
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
    } else if (requiresAd) {
      const user = await getMpUser(req);
      if (!user?.uuid) return respUnauthorized('请先登录后获取资源');
      userUuid = user.uuid;
      const config = mpAdConfig();
      if (!config.enabled) return respForbidden('广告暂不可用，请稍后再试');
      if (body?.ad_completed !== true || typeof body?.ad_session_id !== 'string') {
        return respForbidden('请完整观看激励视频后获取资源');
      }
      const receipt = await completeResourceAdSession(body.ad_session_id, user.uuid, id, config.ad_unit_id);
      if (!receipt.allowed) return respForbidden('广告记录无效或已过期，请重新观看');
      countAccess = receipt.firstCompletion;
    }

    if (countAccess) await incrementResourceAccess(id).catch(error => {
      log.warn("小程序更新资源访问量失败", {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    const response = respData({
      message: creditsCost > 0 ? `已扣除${creditsCost}积分` : (requiresAd ? "广告解锁成功" : "访问记录成功"),
      resource_url: resource.file_url,
      credits_cost: creditsCost,
      user_uuid: userUuid,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    log.error("小程序记录资源访问失败", error as Error);
    return respErr("访问失败，请稍后再试");
  }
}
