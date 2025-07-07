// AI资源评分配置

export interface AIReviewConfig {
  enabled: boolean;
  autoApproveThreshold: number; // 自动通过阈值
  model: string;
  temperature: number;
  maxTokens: number;
  baseURL?: string;
}

// AI评分频率限制配置
export interface AIReviewRateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// 默认AI评分配置
export const DEFAULT_AI_REVIEW_CONFIG: AIReviewConfig = {
  enabled: true,
  autoApproveThreshold: 60, // 60分以下自动通过
  model: "Qwen/Qwen2.5-7B-Instruct",
  temperature: 0.1, // 更严格的温度设置
  maxTokens: 500,
  baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
};

// AI评分频率限制配置
export const AI_REVIEW_RATE_LIMIT_CONFIG: AIReviewRateLimitConfig = {
  windowMs: 60 * 1000, // 1分钟窗口
  maxRequests: 20 // 每分钟最多20次评分请求
};

// 获取AI评分配置
export function getAIReviewConfig(): AIReviewConfig {
  return {
    ...DEFAULT_AI_REVIEW_CONFIG,
    enabled: process.env.AI_REVIEW_ENABLED !== 'false' // 默认启用，除非明确设置为false
  };
}

// 获取API密钥
export function getAIReviewApiKey(): string {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("SILICONFLOW_API_KEY environment variable is not set");
  }
  return apiKey;
}

// 检查AI评分是否启用
export function isAIReviewEnabled(): boolean {
  return getAIReviewConfig().enabled;
}
