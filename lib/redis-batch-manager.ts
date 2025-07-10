/**
 * Redis批量任务管理器
 * 用于管理批量上传任务的执行状态和进度
 */

import { getRedisClient } from '@/lib/redis-cache';
import { REDIS_BATCH_KEYS, REDIS_BATCH_CONFIG } from './redis-batch-keys';
import { BATCH_UPLOAD_CONFIG, validateBatchUploadConfig } from '@/types/batch-upload';
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
  constructor() {
    // 验证配置
    try {
      validateBatchUploadConfig();
    } catch (error) {
      log.error("批量上传配置验证失败", error as Error);
      throw error;
    }
  }

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
   * 清空所有批量处理数据 - 优化版本使用SCAN和pipeline
   */
  async clearAllBatchData(): Promise<void> {
    try {
      const redis = await this.getRedis();

      // 获取所有批量处理相关的键模式
      const patterns = [
        'batch:main:*',
        'batch:subtask:*',
        'batch:queue:*',
        'batch:progress:*',
        'batch:results:*',
        'batch:user:*'
      ];

      let totalDeleted = 0;

      for (const pattern of patterns) {
        const keysToDelete: string[] = [];
        let cursor = '0';

        // 使用SCAN替代KEYS，避免阻塞Redis
        do {
          const result = await redis.scan(cursor, {
            MATCH: pattern,
            COUNT: 100 // 每次扫描100个键
          });

          cursor = result.cursor;
          keysToDelete.push(...result.keys);

          // 当累积到100个键或扫描完成时，批量删除
          if (keysToDelete.length >= 100 || cursor === '0') {
            if (keysToDelete.length > 0) {
              // 使用pipeline批量删除
              const pipeline = redis.multi();
              for (const key of keysToDelete) {
                pipeline.del(key);
              }
              await pipeline.exec();

              totalDeleted += keysToDelete.length;
              log.info("批量删除Redis键", {
                pattern,
                batchSize: keysToDelete.length,
                totalDeleted
              });

              keysToDelete.length = 0; // 清空数组
            }
          }
        } while (cursor !== '0');
      }

      log.info("所有批量处理数据清空成功", { totalDeleted });
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
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout');

            log.error("触发下一个子任务失败，尝试备用方案", error as Error, {
              mainTaskUuid,
              subtaskUuid: nextSubtask.uuid,
              errorMessage,
              isNetworkError,
              errorType: error instanceof Error ? error.constructor.name : 'Unknown'
            });

            // 备用方案：直接调用处理逻辑
            try {
              log.info("启动备用方案处理", {
                mainTaskUuid,
                subtaskUuid: nextSubtask.uuid,
                reason: "HTTP调用失败"
              });

              await this.fallbackProcessSubtask(nextSubtask.uuid);

              log.info("备用方案处理成功", {
                mainTaskUuid,
                subtaskUuid: nextSubtask.uuid
              });

            } catch (fallbackError) {
              log.error("备用方案也失败了", fallbackError as Error, {
                mainTaskUuid,
                subtaskUuid: nextSubtask.uuid,
                fallbackErrorMessage: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
                originalError: errorMessage
              });

              // 标记子任务失败
              await this.updateSubtask(nextSubtask.uuid, {
                status: 'failed',
                completed_at: new Date().toISOString()
              }).catch(updateError => {
                log.error("更新失败子任务状态时出错", updateError as Error, {
                  subtaskUuid: nextSubtask.uuid
                });
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

  // 获取正确的baseURL - 增强Vercel环境支持
  private getBaseUrl(): string {
    let baseUrl: string;

    // 记录所有环境变量用于调试
    log.info("环境变量调试信息", {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT
    });

    // 优先使用NEXTAUTH_URL
    if (process.env.NEXTAUTH_URL) {
      baseUrl = process.env.NEXTAUTH_URL;
      log.info("使用NEXTAUTH_URL作为baseURL", { baseUrl });
      return baseUrl;
    }

    // Vercel环境 - 使用多种方式获取URL
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
      log.info("使用VERCEL_URL作为baseURL", { baseUrl });
      return baseUrl;
    }

    // Vercel环境的备用方案 - 检查其他可能的环境变量
    if (process.env.VERCEL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
      log.info("使用VERCEL_PROJECT_PRODUCTION_URL作为baseURL", { baseUrl });
      return baseUrl;
    }

    // 开发环境
    if (process.env.NODE_ENV === 'development') {
      const port = process.env.PORT || '3000';
      baseUrl = `http://localhost:${port}`;
      log.info("使用开发环境baseURL", { baseUrl, port });
      return baseUrl;
    }

    // 最后的默认值
    baseUrl = 'http://localhost:3000';
    log.warn("使用默认baseURL，可能导致Vercel环境调用失败", { baseUrl });
    return baseUrl;
  }

  // 备用方案：直接调用处理逻辑（当HTTP调用失败时）
  private async fallbackProcessSubtask(subtaskUuid: string): Promise<void> {
    log.info("使用备用方案处理子任务", { subtaskUuid });

    // 动态导入处理逻辑，避免循环依赖
    const { processSubtaskDirectly } = await import('@/lib/subtask-processor-fallback');
    await processSubtaskDirectly(subtaskUuid);
  }

  /**
   * 检查并恢复中断的任务
   * 用于处理因各种原因中断的批量上传任务
   */
  async checkAndRecoverStuckTasks(): Promise<void> {
    try {
      log.info("开始检查中断的任务");

      const redis = await this.getRedis();

      // 获取所有主任务键
      const mainTaskKeys = await redis.keys('batch:main:*');

      for (const taskKey of mainTaskKeys) {
        const taskData = await redis.get(taskKey);
        if (!taskData) continue;

        const mainTask: MainTaskRedis = JSON.parse(taskData);

        // 检查任务是否可能中断（状态为pending或processing，但很久没有更新）
        const lastUpdateTime = new Date(mainTask.updated_at || mainTask.created_at).getTime();
        const now = Date.now();
        const timeDiff = now - lastUpdateTime;

        // 如果任务超过配置时间没有更新，认为可能中断
        if (timeDiff > BATCH_UPLOAD_CONFIG.TASK_RECOVERY_TIMEOUT && (mainTask.status === 'pending' || mainTask.status === 'processing')) {
          log.warn("发现可能中断的任务", {
            taskUuid: mainTask.uuid,
            status: mainTask.status,
            lastUpdate: mainTask.updated_at,
            timeDiffMinutes: Math.round(timeDiff / 60000)
          });

          // 尝试恢复任务
          await this.recoverTask(mainTask.uuid);
        }
      }

      log.info("任务检查完成");
    } catch (error) {
      log.error("检查中断任务失败", error as Error);
    }
  }

  /**
   * 恢复特定任务 - 使用分布式锁防止重复处理
   */
  async recoverTask(mainTaskUuid: string): Promise<void> {
    const lockKey = `lock:recover:${mainTaskUuid}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    const lockTTL = BATCH_UPLOAD_CONFIG.RECOVERY_LOCK_TTL; // 恢复锁定时间

    try {
      log.info("尝试恢复任务", { mainTaskUuid });

      // 尝试获取分布式锁 - 带重试机制
      const redis = await this.getRedis();
      let lockAcquired = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!lockAcquired && retryCount < maxRetries) {
        try {
          const setResult = await redis.set(lockKey, lockValue, {
            PX: lockTTL * 1000,
            NX: true
          });
          lockAcquired = setResult === 'OK';

          if (!lockAcquired && retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 指数退避
            retryCount++;
          }
        } catch (redisError) {
          log.warn(`获取锁失败，重试 ${retryCount + 1}/${maxRetries}`, {
            mainTaskUuid,
            error: redisError
          });
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      if (!lockAcquired) {
        log.info("任务恢复已在进行中或获取锁失败，跳过", { mainTaskUuid });
        return;
      }

      const mainTask = await this.getMainTask(mainTaskUuid);
      if (!mainTask) {
        log.warn("要恢复的主任务不存在", { mainTaskUuid });
        return;
      }

      // 检查是否有待处理的子任务
      const nextSubtask = await this.getNextPendingSubtask(mainTaskUuid);

      if (nextSubtask) {
        log.info("找到待处理的子任务，恢复处理", {
          mainTaskUuid,
          subtaskUuid: nextSubtask.uuid,
          batchIndex: nextSubtask.batch_index
        });

        // 更新主任务状态
        await this.updateMainTaskProgress(mainTaskUuid, {
          status: 'processing'
        });

        // 直接使用备用方案处理，避免HTTP调用问题
        await this.fallbackProcessSubtask(nextSubtask.uuid);
      } else {
        // 检查是否所有子任务都已完成
        const allSubtasks = await this.getAllSubtasks(mainTaskUuid);
        const completedCount = allSubtasks.filter(st => st.status === 'completed').length;

        if (completedCount >= mainTask.total_batches) {
          log.info("所有子任务已完成，标记主任务完成", { mainTaskUuid });

          // 动态导入完成函数
          const { completeMainTask } = await import('@/lib/subtask-processor-fallback');
          await completeMainTask(mainTaskUuid);
        } else {
          log.warn("任务状态异常，无法恢复", {
            mainTaskUuid,
            totalBatches: mainTask.total_batches,
            completedCount,
            allSubtasksCount: allSubtasks.length
          });
        }
      }

    } catch (error) {
      log.error("恢复任务失败", error as Error, { mainTaskUuid });
    } finally {
      // 释放分布式锁 - 使用Lua脚本确保原子性
      try {
        const redis = await this.getRedis();
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const result = await redis.eval(luaScript, {
          keys: [lockKey],
          arguments: [lockValue]
        });

        if (result === 1) {
          log.info("释放任务恢复锁", { mainTaskUuid });
        } else {
          log.warn("锁已被其他进程释放或过期", { mainTaskUuid });
        }
      } catch (lockError) {
        log.warn("释放任务恢复锁失败", { mainTaskUuid, error: lockError });
      }
    }
  }

  /**
   * 获取主任务的所有子任务 - 优化版本使用更高效的SCAN和pipeline
   */
  private async getAllSubtasks(mainTaskUuid: string): Promise<SubtaskRedis[]> {
    try {
      const redis = await this.getRedis();
      const subtasks: SubtaskRedis[] = [];
      let cursor = '0';
      const BATCH_SIZE = 50; // 减少批次大小，提高响应速度

      do {
        const result = await redis.scan(cursor, {
          MATCH: 'batch:sub:*',
          COUNT: BATCH_SIZE
        });

        cursor = result.cursor;
        const keys = result.keys;

        if (keys.length > 0) {
          // 使用pipeline批量获取数据
          const pipeline = redis.multi();
          for (const key of keys) {
            pipeline.get(key);
          }
          const values = await pipeline.exec();

          if (values) {
            // 批量处理结果，减少循环开销
            const validSubtasks = values
              .map((result, index) => {
                const [error, value] = result as unknown as [Error | null, string | null];
                if (error || !value || typeof value !== 'string') {
                  if (error) {
                    log.warn("获取子任务数据失败", { key: keys[index], error });
                  }
                  return null;
                }

                try {
                  const subtask: SubtaskRedis = JSON.parse(value);
                  // 只返回属于指定主任务的子任务
                  return subtask.parent_task_uuid === mainTaskUuid ? subtask : null;
                } catch (parseError) {
                  log.warn("解析子任务数据失败", { key: keys[index], error: parseError });
                  return null;
                }
              })
              .filter((subtask): subtask is SubtaskRedis => subtask !== null);

            subtasks.push(...validSubtasks);
          }
        }
      } while (cursor !== '0');

      // 按批次索引排序
      return subtasks.sort((a, b) => a.batch_index - b.batch_index);
    } catch (error) {
      log.error("获取所有子任务失败", error as Error, { mainTaskUuid });
      return [];
    }
  }
}

// 导出单例实例
export const redisBatchManager = new RedisBatchManager();
