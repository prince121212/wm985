/**
 * 子任务处理备用方案
 * 当HTTP调用失败时使用直接函数调用
 */

import { log } from "@/lib/logger";
import { redisBatchManager } from "@/lib/redis-batch-manager";
import { updateBatchLog } from "@/models/batch-log";
import { updateResourceAIScore } from "@/models/resource";
import { addResourceTags } from "@/models/tag";
import { categoryCache } from "@/lib/category-cache";
import { getUuid } from "@/lib/hash";
import { scoreResourceWithAI, ResourceForReview } from "@/lib/ai-review";
import { isAIReviewEnabled } from "@/lib/ai-review-config";
import { getSupabaseClient } from "@/models/db";
import { enrichResourceWithAI } from "@/lib/ai-resource-enricher";
import { BatchResourceItem, BATCH_UPLOAD_CONFIG } from "@/types/batch-upload";

/**
 * 直接处理子任务（备用方案）
 */
export async function processSubtaskDirectly(subtaskUuid: string): Promise<void> {
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = BATCH_UPLOAD_CONFIG.MAX_PROCESSING_TIME;
  
  try {
    log.info("开始备用方案处理子任务", { subtaskUuid });

    // 从Redis获取子任务
    const subtask = await redisBatchManager.getSubtask(subtaskUuid);
    if (!subtask) {
      throw new Error("子任务不存在");
    }

    // 获取主任务信息以获取用户ID
    const parentTask = await redisBatchManager.getMainTask(subtask.parent_task_uuid);
    if (!parentTask) {
      throw new Error("主任务不存在");
    }

    log.info(`备用方案处理批次 ${subtask.batch_index}`, {
      subtask_uuid: subtaskUuid,
      parent_task: subtask.parent_task_uuid,
      resource_count: subtask.resources.length
    });

    // 更新子任务状态为processing
    await redisBatchManager.updateSubtask(subtaskUuid, {
      status: 'processing',
      started_at: new Date().toISOString()
    });

    // 获取分类信息（使用缓存）
    const categoryMap = await categoryCache.getCategoryMap();

    // 批量处理这批资源
    const results = await processBatchResourcesOptimized(
      subtask.resources,
      categoryMap,
      parentTask.user_id,
      startTime,
      MAX_PROCESSING_TIME,
      subtaskUuid
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    // 更新子任务完成状态
    await redisBatchManager.updateSubtask(subtaskUuid, {
      status: 'completed',
      success_count: successCount,
      failed_count: failedCount,
      results: results,
      completed_at: new Date().toISOString()
    });

    // 更新主任务进度
    const mainTask = await redisBatchManager.getMainTask(subtask.parent_task_uuid);
    if (mainTask) {
      const newCompletedBatches = mainTask.completed_batches + 1;
      const newSuccessCount = mainTask.success_count + successCount;
      const newFailedCount = mainTask.failed_count + failedCount;

      await redisBatchManager.updateMainTaskProgress(subtask.parent_task_uuid, {
        completed_batches: newCompletedBatches,
        success_count: newSuccessCount,
        failed_count: newFailedCount
      });

      log.info(`备用方案批次 ${subtask.batch_index} 处理完成`, {
        subtask_uuid: subtaskUuid,
        success_count: successCount,
        failed_count: failedCount,
        completed_batches: newCompletedBatches,
        total_batches: mainTask.total_batches
      });

      // 检查是否所有批次都完成了
      if (newCompletedBatches >= mainTask.total_batches) {
        await completeMainTask(subtask.parent_task_uuid);
      } else {
        // 继续处理下一批 - 使用备用方案直接处理，避免HTTP调用
        log.info("备用方案继续处理下一批", {
          parent_task: subtask.parent_task_uuid,
          completed_batches: newCompletedBatches,
          total_batches: mainTask.total_batches
        });

        // 使用延迟确保当前任务完全完成，然后直接处理下一批
        setTimeout(async () => {
          await continueWithFallbackMode(subtask.parent_task_uuid);
        }, BATCH_UPLOAD_CONFIG.SUBTASK_TRIGGER_DELAY);
      }
    }

  } catch (error) {
    log.error("备用方案子任务处理失败", error as Error, { subtask_uuid: subtaskUuid });
    throw error;
  }
}

/**
 * 批量处理资源 - 优化版本
 * 使用批量插入和并行处理提高性能
 */
async function processBatchResourcesOptimized(
  resources: BatchResourceItem[],
  categoryMap: Map<string, number>,
  user_uuid: string,
  startTime: number,
  maxProcessingTime: number,
  subtaskUuid: string
): Promise<Array<{ name: string; success: boolean; uuid?: string; error?: string }>> {
  const results: Array<{ name: string; success: boolean; uuid?: string; error?: string }> = [];

  try {
    // 1. 验证用户是否存在（只验证一次）
    const supabase = getSupabaseClient();
    const { data: userExists } = await supabase
      .from('users')
      .select('uuid')
      .eq('uuid', user_uuid)
      .single();

    if (!userExists) {
      // 如果用户不存在，所有资源都失败
      return resources.map(resource => ({
        name: resource.name,
        success: false,
        error: `用户不存在: ${user_uuid}`
      }));
    }

    // 2. 并行AI智能填充（控制并发数避免超时）
    const enrichPromises = resources.map(async (resource, index) => {
      try {
        // 检查是否接近超时
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > maxProcessingTime * 0.8) { // 80%时间用完就停止
          throw new Error("处理时间不足，跳过AI填充");
        }

        const enriched = await enrichResourceWithAI(resource, categoryMap);
        return { index, enriched, error: null };
      } catch (error) {
        log.warn("AI智能填充失败，使用默认值", {
          resourceName: resource.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // 使用默认值
        return {
          index,
          enriched: {
            title: resource.name.substring(0, 100), // 限制长度
            description: `批量上传的资源：${resource.name}`,
            link: resource.link,
            category_id: 1, // 默认分类
            tags: []
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const enrichResults = await Promise.allSettled(enrichPromises);

    // 3. 准备批量插入数据
    const resourcesData = [];
    const resourceIndexMap = new Map<number, number>(); // 原始索引 -> 数据库索引的映射

    for (let i = 0; i < enrichResults.length; i++) {
      const result = enrichResults[i];
      if (result.status === 'fulfilled' && result.value.enriched) {
        const enriched = result.value.enriched;
        const resourceUuid = getUuid();

        resourcesData.push({
          uuid: resourceUuid,
          title: enriched.title,
          description: enriched.description,
          content: '', // 批量上传默认为空
          file_url: enriched.link,
          category_id: enriched.category_id,
          author_id: user_uuid,
          status: 'pending' as const,
          rating_avg: 0,
          rating_count: 0,
          view_count: 0,
          access_count: 0,
          is_featured: false,
          is_free: true,
          credits: 0,
          top: false
        });

        resourceIndexMap.set(i, resourcesData.length - 1);

        results.push({
          name: resources[i].name,
          success: true,
          uuid: resourceUuid
        });
      } else {
        const errorMsg = result.status === 'rejected'
          ? (result.reason instanceof Error ? result.reason.message : 'AI处理失败')
          : (result.value.error || 'AI处理失败');

        results.push({
          name: resources[i].name,
          success: false,
          error: errorMsg
        });
      }
    }

    // 4. 批量插入资源到数据库
    if (resourcesData.length > 0) {
      log.info("开始批量插入资源", {
        subtaskUuid,
        resourceCount: resourcesData.length
      });

      const { data: insertedResources, error: insertError } = await supabase
        .from('resources')
        .insert(resourcesData)
        .select('id, uuid');

      if (insertError) {
        log.error("批量插入资源失败", insertError, { subtaskUuid });
        // 将所有成功的结果标记为失败
        results.forEach(result => {
          if (result.success) {
            result.success = false;
            result.error = "数据库插入失败";
            delete result.uuid;
          }
        });
        return results;
      }

      // 5. 批量添加标签（异步处理，不阻塞主流程）
      if (insertedResources && insertedResources.length > 0) {
        const tagPromises = [];

        for (let i = 0; i < enrichResults.length; i++) {
          const result = enrichResults[i];
          if (result.status === 'fulfilled' && result.value.enriched) {
            const dbIndex = resourceIndexMap.get(i);
            if (dbIndex !== undefined && insertedResources[dbIndex]) {
              const enriched = result.value.enriched;
              const insertedResource = insertedResources[dbIndex];

              if (enriched.tags && enriched.tags.length > 0) {
                tagPromises.push(
                  addResourceTags(insertedResource.id, enriched.tags).catch(error => {
                    log.warn("添加标签失败", {
                      resourceId: insertedResource.id,
                      tags: enriched.tags,
                      error
                    });
                  })
                );
              }
            }
          }
        }

        // 异步处理标签，不等待完成
        if (tagPromises.length > 0) {
          Promise.allSettled(tagPromises).then(() => {
            log.info("批量标签处理完成", {
              subtaskUuid,
              tagOperations: tagPromises.length
            });
          });
        }

        // 6. 异步AI审核（不阻塞批量上传）
        if (isAIReviewEnabled()) {
          for (const insertedResource of insertedResources) {
            const resourceData = resourcesData.find(r => r.uuid === insertedResource.uuid);
            if (resourceData) {
              performAIReview(resourceData, user_uuid).catch(error => {
                log.error("批量AI评分失败", error, {
                  resourceUuid: insertedResource.uuid,
                  subtaskUuid
                });
              });
            }
          }
        }
      }
    }

    log.info("批量资源处理完成", {
      subtaskUuid,
      total: resources.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;

  } catch (error) {
    log.error("批量处理资源失败", error as Error, { subtaskUuid });

    // 返回所有失败的结果
    return resources.map(resource => ({
      name: resource.name,
      success: false,
      error: error instanceof Error ? error.message : "批量处理失败"
    }));
  }
}

// 删除未使用的processResource函数，已被批量处理替代

// 异步AI审核处理函数
async function performAIReview(resource: any, user_uuid: string) {
  try {
    log.info("备用方案开始AI评分", { resourceUuid: resource.uuid, title: resource.title });

    // 构建评分输入数据
    const reviewData: ResourceForReview = {
      title: resource.title,
      description: resource.description,
      content: resource.content,
      file_url: resource.file_url
    };

    // 调用AI评分
    const reviewResult = await scoreResourceWithAI(reviewData, user_uuid);

    // 更新资源的AI评分信息
    await updateResourceAIScore(resource.uuid, {
      ai_risk_score: reviewResult.riskScore,
      ai_review_result: reviewResult.reasoning,
      ai_reviewed_at: new Date().toISOString(),
      auto_approved: reviewResult.shouldAutoApprove,
      status: reviewResult.shouldAutoApprove ? 'approved' : 'pending'
    });

    log.info("备用方案AI评分完成", {
      resourceUuid: resource.uuid,
      riskScore: reviewResult.riskScore,
      autoApproved: reviewResult.shouldAutoApprove
    });

  } catch (error) {
    log.error("备用方案AI评分处理失败", error as Error, {
      resourceUuid: resource.uuid,
      user_uuid
    });
  }
}

// 完成主任务 - 将结果写入数据库
export async function completeMainTask(mainTaskUuid: string) {
  try {
    const mainTask = await redisBatchManager.getMainTask(mainTaskUuid);
    if (!mainTask) {
      log.warn("备用方案要完成的主任务不存在", { mainTaskUuid });
      return;
    }

    // 更新Redis中的主任务状态
    await redisBatchManager.updateMainTaskProgress(mainTaskUuid, {
      status: 'completed'
    });

    // 将最终结果写入数据库
    await updateBatchLog(mainTaskUuid, {
      status: 'completed',
      success_count: mainTask.success_count,
      failed_count: mainTask.failed_count,
      completed_at: new Date().toISOString(),
      details: {
        redis_managed: true,
        fallback_mode: true, // 标记为备用方案处理
        total_batches: mainTask.total_batches,
        completed_batches: mainTask.completed_batches,
        batch_size: 1,
        execution_summary: {
          total_resources: mainTask.total_resources,
          successful: mainTask.success_count,
          failed: mainTask.failed_count,
          success_rate: Math.round((mainTask.success_count / mainTask.total_resources) * 100)
        }
      }
    });

    // 从用户活跃任务列表中移除
    await redisBatchManager.cleanupCompletedTask(mainTaskUuid, mainTask.user_id);

    log.info("备用方案主任务完成并已同步到数据库", {
      task_uuid: mainTaskUuid,
      total_resources: mainTask.total_resources,
      success_count: mainTask.success_count,
      failed_count: mainTask.failed_count
    });

  } catch (error) {
    log.error("备用方案完成主任务时出错", error as Error, { mainTaskUuid });
  }
}

/**
 * 备用方案模式下继续处理剩余批次
 * 避免HTTP调用，直接递归处理
 */
async function continueWithFallbackMode(mainTaskUuid: string): Promise<void> {
  try {
    log.info("备用方案模式：查找下一个待处理的子任务", { mainTaskUuid });

    // 获取下一个待处理的子任务
    const nextSubtask = await redisBatchManager.getNextPendingSubtask(mainTaskUuid);

    if (nextSubtask) {
      log.info("备用方案模式：找到下一个子任务，直接处理", {
        mainTaskUuid,
        subtaskUuid: nextSubtask.uuid,
        batchIndex: nextSubtask.batch_index
      });

      // 直接调用备用处理器，避免HTTP调用
      await processSubtaskDirectly(nextSubtask.uuid);
    } else {
      log.info("备用方案模式：没有更多待处理的子任务", { mainTaskUuid });
    }

  } catch (error) {
    log.error("备用方案模式处理失败", error as Error, { mainTaskUuid });

    // 标记主任务失败
    try {
      const mainTask = await redisBatchManager.getMainTask(mainTaskUuid);
      if (mainTask) {
        await redisBatchManager.updateMainTaskProgress(mainTaskUuid, {
          status: 'failed'
        });

        const { updateBatchLog } = await import('@/models/batch-log');
        await updateBatchLog(mainTaskUuid, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          details: {
            error_message: error instanceof Error ? error.message : '备用方案处理失败',
            failed_at: new Date().toISOString(),
            fallback_mode: true
          }
        });

        await redisBatchManager.cleanupCompletedTask(mainTaskUuid, mainTask.user_id);
      }
    } catch (cleanupError) {
      log.error("清理失败任务时出错", cleanupError as Error, { mainTaskUuid });
    }
  }
}
