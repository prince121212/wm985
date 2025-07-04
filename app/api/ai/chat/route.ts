import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";
import { buildAIPrompt } from "@/lib/ai-knowledge";
import { getAIConfig, getAIApiKey, CHAT_RATE_LIMIT_CONFIG } from "@/lib/ai-config";

// AI聊天频率限制（内存存储，生产环境建议使用Redis）
const chatRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 清理过期的限制记录
function cleanupChatRateLimit() {
  const now = Date.now();
  for (const [key, value] of chatRateLimitMap.entries()) {
    if (now > value.resetTime) {
      chatRateLimitMap.delete(key);
    }
  }
}

// 检查AI聊天频率限制
function checkChatRateLimit(userUuid: string): boolean {
  cleanupChatRateLimit();

  const now = Date.now();
  const { windowMs, maxRequests } = CHAT_RATE_LIMIT_CONFIG;

  const record = chatRateLimitMap.get(userUuid);
  if (!record) {
    chatRateLimitMap.set(userUuid, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (now > record.resetTime) {
    chatRateLimitMap.set(userUuid, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查频率限制
    if (!checkChatRateLimit(user_uuid)) {
      log.warn("AI聊天频率限制触发", { user_uuid });
      return respErr("请求过于频繁，请稍后再试");
    }

    const { message, context } = await req.json();

    if (!message || !message.trim()) {
      return respErr("请输入您的问题");
    }

    if (message.trim().length > 500) {
      return respErr("问题内容不能超过500个字符");
    }

    log.info("AI客服对话请求", { user_uuid, messageLength: message.length });

    // 构建AI提示词
    const prompt = buildAIPrompt(message.trim(), context);

    log.info("AI提示词构建完成", {
      user_uuid,
      promptLength: prompt.length,
      messageLength: message.length
    });

    // 获取AI配置
    const aiConfig = getAIConfig();
    const apiKey = getAIApiKey();

    // 使用配置创建AI客户端
    const siliconflow = createOpenAICompatible({
      name: "siliconflow",
      apiKey,
      baseURL: aiConfig.baseURL,
    });

    const model = siliconflow(aiConfig.model);

    const result = await generateText({
      model,
      prompt,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens,
      topP: aiConfig.topP,
    });

    log.info("AI客服回答生成成功", { 
      user_uuid, 
      responseLength: result.text.length,
      tokensUsed: result.usage?.totalTokens || 0
    });

    return respData({
      response: result.text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error("AI客服对话失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
      endpoint: "/api/ai/chat"
    });

    // 返回友好的错误信息
    return respErr("AI客服暂时无法回答，请稍后再试或使用反馈功能联系管理员");
  }
}
