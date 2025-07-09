/**
 * 批量上传相关的类型定义和配置
 */

// 批量上传的资源项
export interface BatchResourceItem {
  name: string;
  link: string;
}

// 批量上传请求
export interface BatchUploadRequest {
  total_resources: number;
  resources: BatchResourceItem[];
}

// AI智能填充后的资源信息
export interface EnrichedResource {
  title: string;
  description: string;
  link: string;
  category_id: number;
  tags: string[];
}

// 文本解析请求
export interface ParseTextRequest {
  text: string;
}

// 文本解析响应
export interface ParseTextResponse {
  total_resources: number;
  resources: BatchResourceItem[];
  errors?: string[];
  stats?: {
    total: number;
    success: number;
    failed: number;
    method: 'regex' | 'ai';
  };
}

// 批量上传配置常量
export const BATCH_UPLOAD_CONFIG = {
  // 资源限制
  MAX_RESOURCES_PER_BATCH: 500,
  MAX_RESOURCE_NAME_LENGTH: 100,

  // 批次配置
  DEFAULT_BATCH_SIZE: 1,

  // 超时配置
  MAX_PROCESSING_TIME: 45 * 1000, // 45秒
  RESOURCE_TIMEOUT: 25 * 1000,    // 25秒

  // AI解析配置
  AI_TIMEOUT: 10 * 1000,          // 10秒
  MAX_AI_PARSE_BLOCKS: 20,        // 最多解析20个资源块
  AI_PARSE_BATCH_SIZE: 3,         // AI并发处理批次大小

  // 文本解析配置
  MAX_TEXT_LENGTH: 50000,         // 最大文本长度

  // 触发延迟
  SUBTASK_TRIGGER_DELAY: 100,     // 100ms延迟
} as const;
