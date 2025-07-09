/**
 * Redis批量任务管理器
 * 用于管理批量上传任务的执行状态和进度
 */

import { getRedisClient } from '@/lib/redis-cache';
import { REDIS_BATCH_KEYS, REDIS_BATCH_CONFIG } from './redis-batch-keys';
import { BATCH_UPLOAD_CONFIG } from '@/types/batch-upload';
import { log } from '@/lib/logger';

// 主任务数据结构
export interface MainTaskRedis {
  uuid: string;
  user_id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial_completed';
  total_resources: number;
  total_batches: number;
  completed_batches: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

// 子任务数据结构
export interface SubtaskRedis {
  uuid: string;
  parent_task_uuid: string;
  batch_index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resources: Array<{name: string, link: string}>;
  success_count: number;
  failed_count: number;
  results: Array<{success: boolean, uuid?: string, error?: string, name: string}>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// 任务进度数据结构
export interface TaskProgress {
  total_batches: number;
  completed_batches: number;
  success_count: number;
  failed_count: number;
  progress_percentage: number;
  status: string;
  last_updated: string;
}

export class RedisBatchManager {
  private async getRedis() {
    return await getRedisClient();
  }

  /**
   * 创建主任务
   */
  async createMainTask(taskData: MainTaskRedis): Promise<void> {
    try {
      const redis = await this.getRedis();
      const pipeline = redis.multi();
      
      // 存储主任务数据
      pipeline.setEx(
        REDIS_BATCH_KEYS.MAIN_TASK(taskData.uuid),
        REDIS_BATCH_CONFIG.TASK_EXPIRE_TIME,
        JSON.stringify(taskData)
      );

      // 添加到用户活跃任务列表
      pipeline.zAdd(
        REDIS_BATCH_KEYS.USER_ACTIVE_TASKS(taskData.user_id),
        { score: Date.now(), value: taskData.uuid }
      );

      // 限制用户活跃任务列表长度
      pipeline.zRemRangeByRank(
        REDIS_BATCH_KEYS.USER_ACTIVE_TASKS(taskData.user_id),
        0,
        -(REDIS_BATCH_CONFIG.MAX_USER_ACTIVE_TASKS + 1)
      );

      // 初始化进度缓存
      const initialProgress: TaskProgress = {
        total_batches: taskData.total_batches,
        completed_batches: 0,
        success_count: 0,
        failed_count: 0,
        progress_percentage: 0,
        status: taskData.status,
        last_updated: taskData.created_at
      };

      pipeline.setEx(
        REDIS_BATCH_KEYS.TASK_PROGRESS(taskData.uuid),
        REDIS_BATCH_CONFIG.PROGRESS_EXPIRE_TIME,
        JSON.stringify(initialProgress)
      );

      await pipeline.exec();
      
      log.info("Redis主任务创建成功", {
        task_uuid: taskData.uuid,
        user_id: taskData.user_id,
        total_batches: taskData.total_batches
      });
      
    } catch (error) {
      log.error("创建Redis主任务失败", error as Error, { taskData });
      throw error;
    }
  }

  /**
   * 创建子任务并加入队列
   */
  async createSubtasksAndQueue(mainTaskUuid: string, subtasks: SubtaskRedis[]): Promise<void> {
    try {
      const redis = await this.getRedis();
      const pipeline = redis.multi();
      const queueKey = REDIS_BATCH_KEYS.SUBTASK_QUEUE(mainTaskUuid);

      // 按batch_index排序，确保处理顺序
      const sortedSubtasks = subtasks.sort((a, b) => a.batch_index - b.batch_index);

      for (const subtask of sortedSubtasks) {
        // 存储子任务数据
        pipeline.setEx(
          REDIS_BATCH_KEYS.SUBTASK(subtask.uuid),
          REDIS_BATCH_CONFIG.TASK_EXPIRE_TIME,
          JSON.stringify(subtask)
        );

        // 加入队列（使用lPush，然后用rPop取出，保证FIFO顺序）
        pipeline.lPush(queueKey, subtask.uuid);
      }

      // 设置队列过期时间
      pipeline.expire(queueKey, REDIS_BATCH_CONFIG.TASK_EXPIRE_TIME);

      await pipeline.exec();
      
      log.info("Redis子任务队列创建成功", {
        main_task_uuid: mainTaskUuid,
        subtask_count: subtasks.length
      });
      
    } catch (error) {
      log.error("创建Redis子任务队列失败", error as Error, { mainTaskUuid });
      throw error;
    }
  }

  /**
   * 获取下一个待处理的子任务
   */
  async getNextPendingSubtask(mainTaskUuid: string): Promise<SubtaskRedis | null> {
    try {
      const redis = await this.getRedis();
      const queueKey = REDIS_BATCH_KEYS.SUBTASK_QUEUE(mainTaskUuid);

      // 从队列尾部取出（保证FIFO顺序）
      const subtaskUuid = await redis.rPop(queueKey);
      if (!subtaskUuid) {
        return null;
      }

      const subtaskData = await redis.get(REDIS_BATCH_KEYS.SUBTASK(subtaskUuid));
      if (!subtaskData) {
        log.warn("子任务数据不存在", { subtaskUuid, mainTaskUuid });
        return null;
      }

      return JSON.parse(subtaskData);

    } catch (error) {
      log.error("获取下一个子任务失败", error as Error, { mainTaskUuid });
      return null;
    }
  }

  /**
   * 更新子任务状态
   */
  async updateSubtask(subtaskUuid: string, updates: Partial<SubtaskRedis>): Promise<void> {
    try {
      const current = await this.getSubtask(subtaskUuid);
      if (!current) {
        log.warn("要更新的子任务不存在", { subtaskUuid });
        return;
      }

      const updated = {
        ...current,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const redis = await this.getRedis();
      await redis.setEx(
        REDIS_BATCH_KEYS.SUBTASK(subtaskUuid),
        REDIS_BATCH_CONFIG.TASK_EXPIRE_TIME,
        JSON.stringify(updated)
      );
      
      log.info("子任务状态更新成功", {
        subtask_uuid: subtaskUuid,
        status: updates.status,
        success_count: updates.success_count,
        failed_count: updates.failed_count
      });
      
    } catch (error) {
      log.error("更新子任务状态失败", error as Error, { subtaskUuid, updates });
      throw error;
    }
  }

  /**
   * 更新主任务进度
   */
  async updateMainTaskProgress(mainTaskUuid: string, updates: {
    completed_batches?: number;
    success_count?: number;
    failed_count?: number;
    status?: string;
  }): Promise<void> {
    try {
      const current = await this.getMainTask(mainTaskUuid);
      if (!current) {
        log.warn("要更新的主任务不存在", { mainTaskUuid });
        return;
      }

      const updated = {
        ...current,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // 计算进度百分比
      const completedBatches = updates.completed_batches ?? current.completed_batches;
      const progressPercentage = Math.round((completedBatches / current.total_batches) * 100);

      const redis = await this.getRedis();
      const pipeline = redis.multi();

      // 更新主任务
      pipeline.setEx(
        REDIS_BATCH_KEYS.MAIN_TASK(mainTaskUuid),
        REDIS_BATCH_CONFIG.TASK_EXPIRE_TIME,
        JSON.stringify(updated)
      );

      // 更新进度缓存
      const progressData: TaskProgress = {
        total_batches: updated.total_batches,
        completed_batches: completedBatches,
        success_count: updates.success_count ?? current.success_count,
        failed_count: updates.failed_count ?? current.failed_count,
        progress_percentage: progressPercentage,
        status: updates.status ?? current.status,
        last_updated: updated.updated_at
      };

      pipeline.setEx(
        REDIS_BATCH_KEYS.TASK_PROGRESS(mainTaskUuid),
        REDIS_BATCH_CONFIG.PROGRESS_EXPIRE_TIME,
        JSON.stringify(progressData)
      );

      await pipeline.exec();
      
      log.info("主任务进度更新成功", {
        main_task_uuid: mainTaskUuid,
        completed_batches: completedBatches,
        total_batches: current.total_batches,
        progress_percentage: progressPercentage,
        status: updates.status
      });
      
    } catch (error) {
      log.error("更新主任务进度失败", error as Error, { mainTaskUuid, updates });
      throw error;
    }
  }

  /**
   * 获取任务进度（快速查询）
   */
  async getTaskProgress(mainTaskUuid: string): Promise<TaskProgress | null> {
    try {
      const redis = await this.getRedis();
      const progressData = await redis.get(REDIS_BATCH_KEYS.TASK_PROGRESS(mainTaskUuid));
      return progressData ? JSON.parse(progressData) : null;
    } catch (error) {
      log.error("获取任务进度失败", error as Error, { mainTaskUuid });
      return null;
    }
  }

  /**
   * 获取主任务
   */
  async getMainTask(mainTaskUuid: string): Promise<MainTaskRedis | null> {
    try {
      const redis = await this.getRedis();
      const data = await redis.get(REDIS_BATCH_KEYS.MAIN_TASK(mainTaskUuid));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      log.error("获取主任务失败", error as Error, { mainTaskUuid });
      return null;
    }
  }

  /**
   * 获取子任务
   */
  async getSubtask(subtaskUuid: string): Promise<SubtaskRedis | null> {
    try {
      const redis = await this.getRedis();
      const data = await redis.get(REDIS_BATCH_KEYS.SUBTASK(subtaskUuid));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      log.error("获取子任务失败", error as Error, { subtaskUuid });
      return null;
    }
  }

  /**
   * 获取用户活跃任务
   */
  async getUserActiveTasks(userUuid: string): Promise<MainTaskRedis[]> {
    try {
      const redis = await this.getRedis();
      const taskUuids = await redis.zRange(
        REDIS_BATCH_KEYS.USER_ACTIVE_TASKS(userUuid),
        0, 19, // 最近20个
        { REV: true } // 反向排序，获取最新的
      );

      const tasks = [];
      if (taskUuids && Array.isArray(taskUuids)) {
        for (const taskUuid of taskUuids) {
          if (typeof taskUuid === 'string') {
            const task = await this.getMainTask(taskUuid);
            if (task) {
              tasks.push(task);
            }
          }
        }
      }

      return tasks;
    } catch (error) {
      log.error("获取用户活跃任务失败", error as Error, { userUuid });
      return [];
    }
  }

  /**
   * 保存任务最终结果（用于写入数据库）
   */
  async saveTaskResults(mainTaskUuid: string, results: {
    subtask_results: Array<{
      batch_index: number;
      status: string;
      success_count: number;
      failed_count: number;
      started_at?: string;
      completed_at?: string;
    }>;
    failed_resources: Array<{
      name: string;
      link: string;
      error: string;
      batch_index: number;
    }>;
  }): Promise<void> {
    try {
      const redis = await this.getRedis();
      await redis.setEx(
        REDIS_BATCH_KEYS.TASK_RESULTS(mainTaskUuid),
        REDIS_BATCH_CONFIG.TASK_EXPIRE_TIME,
        JSON.stringify(results)
      );

      log.info("任务结果保存成功", { mainTaskUuid });
    } catch (error) {
      log.error("保存任务结果失败", error as Error, { mainTaskUuid });
      throw error;
    }
  }

  /**
   * 获取任务最终结果
   */
  async getTaskResults(mainTaskUuid: string): Promise<any> {
    try {
      const redis = await this.getRedis();
      const data = await redis.get(REDIS_BATCH_KEYS.TASK_RESULTS(mainTaskUuid));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      log.error("获取任务结果失败", error as Error, { mainTaskUuid });
      return null;
    }
  }

  /**
   * 清理已完成的任务（从用户活跃列表移除）
   */
  async cleanupCompletedTask(mainTaskUuid: string, userUuid: string): Promise<void> {
    try {
      const redis = await this.getRedis();
      // 从用户活跃任务列表中移除
      await redis.zRem(REDIS_BATCH_KEYS.USER_ACTIVE_TASKS(userUuid), mainTaskUuid);

      log.info("已完成任务清理成功", { mainTaskUuid, userUuid });
    } catch (error) {
      log.error("清理已完成任务失败", error as Error, { mainTaskUuid, userUuid });
    }
  }

  /**
   * 检查队列中剩余的子任务数量
   */
  async getRemainingSubtaskCount(mainTaskUuid: string): Promise<number> {
    try {
      const redis = await this.getRedis();
      const queueKey = REDIS_BATCH_KEYS.SUBTASK_QUEUE(mainTaskUuid);
      return await redis.lLen(queueKey);
    } catch (error) {
      log.error("获取剩余子任务数量失败", error as Error, { mainTaskUuid });
      return 0;
    }
  }

  /**
   * 清空所有批量处理数据
   */
  async clearAllBatchData(): Promise<void> {
    try {
      const redis = await this.getRedis();

      // 获取所有批量处理相关的键
      const patterns = [
        'batch:main:*',
        'batch:subtask:*',
        'batch:queue:*',
        'batch:progress:*',
        'batch:results:*',
        'batch:user:*'
      ];

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          // 分批删除键，避免扩展运算符的TypeScript问题
          for (const key of keys) {
            await redis.del(key);
          }
          log.info("清空Redis批量数据", { pattern, count: keys.length });
        }
      }

      log.info("所有批量处理数据清空成功");
    } catch (error) {
      log.error("清空批量处理数据失败", error as Error);
      throw error;
    }
  }

  // 触发下一个子任务处理
  async triggerNextSubtask(mainTaskUuid: string): Promise<void> {
    try {
      const nextSubtask = await this.getNextPendingSubtask(mainTaskUuid);

      if (nextSubtask) {
        log.info("触发下一个子任务", {
          mainTaskUuid,
          subtaskUuid: nextSubtask.uuid,
          batchIndex: nextSubtask.batch_index
        });

        // 使用setTimeout异步触发，确保真正的链式调用
        setTimeout(async () => {
          try {
            // 构建正确的baseURL
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}/api/admin/batch-upload/process-subtask`;

            log.info("尝试触发子任务", {
              mainTaskUuid,
              subtaskUuid: nextSubtask.uuid,
              url,
              baseUrl
            });

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Internal-Service/1.0'
              },
              body: JSON.stringify({ subtask_uuid: nextSubtask.uuid })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            log.info("成功触发下一个子任务", {
              mainTaskUuid,
              subtaskUuid: nextSubtask.uuid,
              status: response.status
            });

          } catch (error) {
            log.error("触发下一个子任务失败，尝试备用方案", error as Error, {
              mainTaskUuid,
              subtaskUuid: nextSubtask.uuid,
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });

            // 备用方案：直接调用处理逻辑
            try {
              await this.fallbackProcessSubtask(nextSubtask.uuid);
            } catch (fallbackError) {
              log.error("备用方案也失败了", fallbackError as Error, {
                mainTaskUuid,
                subtaskUuid: nextSubtask.uuid
              });
            }
          }
        }, BATCH_UPLOAD_CONFIG.SUBTASK_TRIGGER_DELAY); // 100ms延迟，确保当前请求完成
      } else {
        log.info("没有更多待处理的子任务", { mainTaskUuid });
      }
    } catch (error) {
      log.error("触发下一个子任务失败", error as Error, { mainTaskUuid });
    }
  }

  // 获取正确的baseURL
  private getBaseUrl(): string {
    let baseUrl: string;

    // 优先使用环境变量
    if (process.env.NEXTAUTH_URL) {
      baseUrl = process.env.NEXTAUTH_URL;
      log.info("使用NEXTAUTH_URL作为baseURL", { baseUrl });
      return baseUrl;
    }

    // Vercel环境
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
      log.info("使用VERCEL_URL作为baseURL", { baseUrl });
      return baseUrl;
    }

    // 开发环境 - 尝试多个端口
    if (process.env.NODE_ENV === 'development') {
      // 检查当前服务器端口
      const port = process.env.PORT || '3000';
      baseUrl = `http://localhost:${port}`;
      log.info("使用开发环境baseURL", { baseUrl, port });
      return baseUrl;
    }

    // 默认值
    baseUrl = 'http://localhost:3000';
    log.info("使用默认baseURL", { baseUrl });
    return baseUrl;
  }

  // 备用方案：直接调用处理逻辑（当HTTP调用失败时）
  private async fallbackProcessSubtask(subtaskUuid: string): Promise<void> {
    log.info("使用备用方案处理子任务", { subtaskUuid });

    // 动态导入处理逻辑，避免循环依赖
    const { processSubtaskDirectly } = await import('@/lib/subtask-processor-fallback');
    await processSubtaskDirectly(subtaskUuid);
  }
}

// 导出单例实例
export const redisBatchManager = new RedisBatchManager();
