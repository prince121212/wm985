// AI服务配置
export interface AIModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  baseURL?: string;
}

// AI聊天频率限制配置
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// 默认AI模型配置
export const DEFAULT_AI_CONFIG: AIModelConfig = {
  provider: "SiliconFlow",
  model: "Qwen/Qwen2.5-7B-Instruct",
  temperature: 0.1,
  maxTokens: 1000,
  topP: 0.8,
  baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
};

// AI聊天频率限制配置
export const CHAT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1分钟窗口
  maxRequests: 10 // 每分钟最多10次请求
};

// 获取AI模型配置
export function getAIConfig(): AIModelConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    baseURL: process.env.SILICONFLOW_BASE_URL || DEFAULT_AI_CONFIG.baseURL
  };
}

// 获取API密钥
export function getAIApiKey(): string {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("SILICONFLOW_API_KEY environment variable is not set");
  }
  return apiKey;
}
