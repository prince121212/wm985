import {
  CreditsAmount,
  CreditsTransType,
  decreaseCredits,
} from "@/services/credit";
import { respData, respInvalidParams, respUnauthorized, respErr, ErrorCode } from "@/lib/resp";

import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";

// 定义请求体类型
interface PingRequest {
  message: string;
}

// 定义响应体类型
interface PongResponse {
  pong: string;
}

// 轻量级保活端点 - 用于外部监控服务
export async function GET() {
  log.info("----保活成功Ping-Success");
  return Response.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.6.0" // 从package.json获取
  });
}

// 原有的POST端点 - 用于用户功能测试
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
    log.error("Ping测试失败", e as Error, { endpoint: "/api/ping" });
    return respErr("测试失败，请稍后再试", ErrorCode.INTERNAL_ERROR);
  }
}
