import {
  CreditsAmount,
  CreditsTransType,
  decreaseCredits,
} from "@/services/credit";
import { respData, respInvalidParams, respUnauthorized, respErr, ErrorCode } from "@/lib/resp";

import { getUserUuid } from "@/services/user";

// 定义请求体类型
interface PingRequest {
  message: string;
}

// 定义响应体类型
interface PongResponse {
  pong: string;
}

export async function POST(req: Request) {
  try {
    const body: PingRequest = await req.json();

    // 验证参数
    if (!body.message || typeof body.message !== 'string') {
      return respInvalidParams("消息内容不能为空");
    }

    // 验证消息长度
    if (body.message.length > 1000) {
      return respInvalidParams("消息内容过长，最多1000字符");
    }

    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // decrease credits for ping
    await decreaseCredits({
      user_uuid,
      trans_type: CreditsTransType.Ping,
      credits: CreditsAmount.PingCost,
    });

    const response: PongResponse = {
      pong: `received message: ${body.message}`,
    };

    return respData(response);
  } catch (e) {
    console.error("ping test failed:", e);
    return respErr("测试失败，请稍后再试", ErrorCode.INTERNAL_ERROR);
  }
}
