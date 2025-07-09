/**
 * Redis批量任务相关的Key定义
 */

export const REDIS_BATCH_KEYS = {
  // 主任务信息 - 7天过期
  MAIN_TASK: (taskUuid: string) => `batch:main:${taskUuid}`,
  
  // 子任务信息 - 7天过期  
  SUBTASK: (subtaskUuid: string) => `batch:sub:${subtaskUuid}`,
  
  // 主任务的子任务队列（有序列表，按batch_index排序）
  SUBTASK_QUEUE: (mainTaskUuid: string) => `batch:queue:${mainTaskUuid}`,
  
  // 用户当前进行中的任务列表（有序集合，按创建时间排序）
  USER_ACTIVE_TASKS: (userUuid: string) => `user:active:${userUuid}`,
  
  // 任务进度缓存（用于快速查询）
  TASK_PROGRESS: (taskUuid: string) => `batch:progress:${taskUuid}`,
  
  // 任务结果汇总（用于最终写入数据库）
  TASK_RESULTS: (taskUuid: string) => `batch:results:${taskUuid}`
};

// Redis数据过期时间配置
export const REDIS_BATCH_CONFIG = {
  // 任务数据过期时间（7天）
  TASK_EXPIRE_TIME: 7 * 24 * 3600,
  
  // 进度缓存过期时间（3天）
  PROGRESS_EXPIRE_TIME: 3 * 24 * 3600,
  
  // 用户活跃任务列表最大长度
  MAX_USER_ACTIVE_TASKS: 50
};
