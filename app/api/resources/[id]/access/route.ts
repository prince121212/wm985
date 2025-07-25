import { respData, respErr, respInvalidParams, respUnauthorized, respNotFound, respForbidden } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";
import { findResourceByUuid, incrementResourceAccess } from "@/models/resource";

import { getUserCredits, decreaseCredits, increaseCredits, CreditsTransType } from "@/services/credit";

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/resources/[id]/access - 记录资源访问
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return respInvalidParams("资源ID不能为空");
    }

    log.info("记录资源访问", { resourceUuid: id });

    // 检查资源是否存在
    const resource = await findResourceByUuid(id);
    if (!resource) {
      return respNotFound("资源不存在");
    }

    // 检查资源状态
    if (resource.status !== 'approved') {
      return respForbidden("资源未通过审核，无法访问");
    }

    // 获取用户信息（所有资源都需要登录）
    const user_uuid = await getUserUuid().catch(() => null);

    // 所有资源都需要用户登录
    if (!user_uuid) {
      return respUnauthorized("请先登录后访问资源");
    }

    // 如果是付费资源，检查用户积分并扣除
    if (!resource.is_free) {
      const requiredCredits = resource.credits || 0;

      if (requiredCredits > 0) {
        // 检查用户积分余额
        const userCredits = await getUserCredits(user_uuid);

        if (userCredits.left_credits < requiredCredits) {
          return respErr(`积分不足，需要${requiredCredits}积分，当前余额${userCredits.left_credits}积分`, 1003); // 使用403 Forbidden状态码
        }

        // 扣除积分
        try {
          await decreaseCredits({
            user_uuid,
            trans_type: CreditsTransType.ResourceAccess,
            credits: requiredCredits,
            order_no: resource.uuid // 使用order_no字段存储资源UUID
          });

          log.info("积分扣除成功", {
            user_uuid,
            resourceUuid: id,
            creditsDeducted: requiredCredits
          });

          // 给资源上传者奖励积分（永久有效，不设置过期时间）
          try {
            await increaseCredits({
              user_uuid: resource.author_id,
              trans_type: CreditsTransType.ResourceReward,
              credits: requiredCredits,
              order_no: `RESOURCE_REWARD_${resource.uuid}_${Date.now()}`,
              // 不设置 expired_at，积分永久有效
            });

            log.info("资源上传者奖励积分发放成功", {
              author_id: resource.author_id,
              resourceUuid: id,
              rewardCredits: requiredCredits,
              accessor_uuid: user_uuid
            });
          } catch (rewardError) {
            log.error("资源上传者奖励积分发放失败", rewardError as Error, {
              author_id: resource.author_id,
              resourceUuid: id,
              rewardCredits: requiredCredits,
              accessor_uuid: user_uuid
            });
            // 奖励失败不影响资源访问，只记录错误日志
          }
        } catch (error) {
          log.error("积分扣除失败", error as Error, {
            user_uuid,
            resourceUuid: id,
            requiredCredits
          });
          return respErr("积分扣除失败，请稍后再试");
        }
      }
    }

    // 增加访问次数（异步执行，不影响响应）
    if (resource.id) {
      incrementResourceAccess(id).catch(error => {
        log.warn("更新访问次数失败", {
          error: error instanceof Error ? error.message : String(error),
          resourceUuid: id
        });
      });
    }



    log.info("资源访问记录成功", {
      resourceUuid: id,
      title: resource.title,
      user_uuid: user_uuid || 'anonymous'
    });

    return respData({
      message: "访问记录成功",
      resource_url: resource.file_url,
      credits_cost: resource.is_free ? 0 : (resource.credits || 0)
    });

  } catch (error) {
    log.error("记录资源访问失败", error as Error, {
      resourceUuid: await params.then(p => p.id),
      user_uuid: await getUserUuid().catch(() => 'unknown')
    });

    return respErr("访问记录失败，请稍后再试");
  }
}
