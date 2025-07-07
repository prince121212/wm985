// AI资源评分核心逻辑
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { log } from "@/lib/logger";
import { getAIReviewConfig, getAIReviewApiKey, AI_REVIEW_RATE_LIMIT_CONFIG } from "@/lib/ai-review-config";

// AI评分结果接口
export interface AIReviewResult {
  riskScore: number;        // 风险评分 0-100
  shouldAutoApprove: boolean; // 是否应该自动通过
  reasoning: string;        // 评分理由
}

// 资源评分输入接口
export interface ResourceForReview {
  title: string;
  description: string;
  content?: string;
  file_url?: string;
}

// AI评分频率限制（内存存储，生产环境建议使用Redis）
const reviewRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 清理过期的限制记录
function cleanupReviewRateLimit() {
  const now = Date.now();
  for (const [key, value] of reviewRateLimitMap.entries()) {
    if (now > value.resetTime) {
      reviewRateLimitMap.delete(key);
    }
  }
}

// 检查评分频率限制
function checkReviewRateLimit(identifier: string): boolean {
  cleanupReviewRateLimit();
  
  const now = Date.now();
  const key = `review_${identifier}`;
  const limit = reviewRateLimitMap.get(key);
  
  if (!limit) {
    reviewRateLimitMap.set(key, {
      count: 1,
      resetTime: now + AI_REVIEW_RATE_LIMIT_CONFIG.windowMs
    });
    return true;
  }
  
  if (limit.count >= AI_REVIEW_RATE_LIMIT_CONFIG.maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

// 构建AI评分提示词
function buildReviewPrompt(resource: ResourceForReview): string {
  return `你是一个专业的内容审核助手，请客观评估以下资源的质量和安全性。

资源信息：
标题：${resource.title}
描述：${resource.description}
${resource.content ? `详细内容：${resource.content.substring(0, 1000)}` : ''}
${resource.file_url ? `资源链接：${resource.file_url}` : ''}

请从以下维度进行评估：

1. 内容合规性
   - 内容是否符合法律法规
   - 是否包含违禁信息（暴力、色情、政治敏感等）
   - 语言是否文明，无歧视性内容

2. 资源价值
   - 内容是否对用户有实际价值
   - 信息是否准确、完整
   - 是否为有意义的知识分享

3. 内容质量
   - 描述是否清晰、详细
   - 标题与内容是否匹配
   - 是否为原创或合法转载

4. 安全性
   - 链接是否安全可信
   - 是否存在恶意软件风险
   - 是否为诈骗或钓鱼内容

评估原则：
- 大多数正常的学习资源、工具分享、知识文档、娱乐内容都应该被认为是安全的
- 只有明确存在违法违规、恶意欺诈、严重质量问题的内容才需要高分
- 普通的个人分享、学习笔记、开源项目、动漫资源、软件工具等都属于低风险内容
- 版权问题不是主要考虑因素，重点关注内容是否有害
- 即使内容质量一般，只要无害且合规，也应该给予较低分数（通常在20-40分范围）
- 只有发现明确的违法、欺诈、恶意内容时才给高分（70分以上）

重要提醒：分数越高表示风险越大，安全无害的内容应该得到低分！

请基于资源的实际内容进行客观评分（0-100分，分数越高风险越大），然后返回JSON格式：
{
  "riskScore": 评分数字(0-100),
  "reasoning": "详细说明评分理由，重点说明发现的具体问题或确认内容安全的原因"
}`;
}

// 解析AI响应
function parseAIResponse(response: string): { riskScore: number; reasoning: string } {
  try {
    // 提取JSON部分（去除可能的额外文本）
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("未找到JSON格式的响应");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (typeof parsed.riskScore !== 'number' || !parsed.reasoning) {
      throw new Error("响应格式不正确");
    }
    
    // 确保评分在有效范围内
    const riskScore = Math.max(0, Math.min(100, Math.round(parsed.riskScore)));
    
    return {
      riskScore,
      reasoning: parsed.reasoning.toString()
    };
  } catch (error) {
    log.warn("AI响应解析失败", { error, response });
    throw new Error("AI响应格式错误");
  }
}

// 主要的AI评分函数
export async function scoreResourceWithAI(resource: ResourceForReview, identifier?: string): Promise<AIReviewResult> {
  const config = getAIReviewConfig();
  
  // 检查是否启用AI评分
  if (!config.enabled) {
    log.info("AI评分功能已禁用");
    return {
      riskScore: 0,
      shouldAutoApprove: true,
      reasoning: "AI评分功能已禁用，默认通过"
    };
  }
  
  // 检查频率限制
  if (identifier && !checkReviewRateLimit(identifier)) {
    log.warn("AI评分频率限制触发", { identifier });
    throw new Error("评分请求过于频繁，请稍后再试");
  }
  
  try {
    const apiKey = getAIReviewApiKey();
    
    // 创建AI客户端
    const siliconflow = createOpenAICompatible({
      name: "siliconflow",
      apiKey,
      baseURL: config.baseURL,
    });
    
    const model = siliconflow(config.model);
    const prompt = buildReviewPrompt(resource);
    
    log.info("开始AI资源评分", {
      title: resource.title,
      promptLength: prompt.length
    });
    
    // 调用AI进行评分
    const result = await generateText({
      model,
      prompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    
    // 解析AI响应
    const { riskScore, reasoning } = parseAIResponse(result.text);
    
    // 判断是否应该自动通过
    const shouldAutoApprove = riskScore < config.autoApproveThreshold;
    
    log.info("AI资源评分完成", {
      title: resource.title,
      riskScore,
      shouldAutoApprove,
      tokensUsed: result.usage?.totalTokens || 0
    });
    
    return {
      riskScore,
      shouldAutoApprove,
      reasoning
    };
    
  } catch (error) {
    log.error("AI资源评分失败", error as Error, {
      title: resource.title,
      identifier
    });
    
    // 评分失败时的默认处理：不自动通过，需要人工审核
    return {
      riskScore: 50, // 中等风险分数
      shouldAutoApprove: false,
      reasoning: `AI评分失败：${(error as Error).message}，需要人工审核`
    };
  }
}
