import { respData, respErr, respInvalidParams } from "@/lib/resp";
import { log } from "@/lib/logger";
import { redisBatchManager } from "@/lib/redis-batch-manager";
import { updateBatchLog } from "@/models/batch-log";
import { insertResource, updateResourceAIScore } from "@/models/resource";
import { addResourceTags } from "@/models/tag";
import { getAllCategories } from "@/models/category";
import { getUuid } from "@/lib/hash";
import { scoreResourceWithAI, ResourceForReview } from "@/lib/ai-review";
import { isAIReviewEnabled } from "@/lib/ai-review-config";
import { getSupabaseClient } from "@/models/db";
import { enrichResourceWithAI } from "@/lib/ai-resource-enricher";
import { BatchResourceItem, BATCH_UPLOAD_CONFIG } from "@/types/batch-upload";

// POST /api/admin/batch-upload/process-subtask - 处理单个子任务
export async function POST(req: Request) {
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = BATCH_UPLOAD_CONFIG.MAX_PROCESSING_TIME; // 45秒超时保护
  
  try {
    const { subtask_uuid } = await req.json();
    
    if (!subtask_uuid) {
      return respInvalidParams("缺少subtask_uuid参数");
    }

    // 从Redis获取子任务
    const subtask = await redisBatchManager.getSubtask(subtask_uuid);
    if (!subtask) {
      return respErr("子任务不存在");
    }

    // 获取主任务信息以获取用户ID
    const parentTask = await redisBatchManager.getMainTask(subtask.parent_task_uuid);
    if (!parentTask) {
      return respErr("主任务不存在");
    }

    log.info(`开始处理批次 ${subtask.batch_index}`, {
      subtask_uuid,
      parent_task: subtask.parent_task_uuid,
      resource_count: subtask.resources.length
    });

    // 更新子任务状态为processing
    await redisBatchManager.updateSubtask(subtask_uuid, {
      status: 'processing',
      started_at: new Date().toISOString()
    });

    // 获取分类信息
    const categories = await getAllCategories();
    const categoryMap = new Map<string, number>(
      categories
        .filter(cat => cat.id !== undefined)
        .map(cat => [cat.name, cat.id!])
    );

    // 处理这批资源
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < subtask.resources.length; i++) {
      // 检查是否接近超时
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_PROCESSING_TIME) {
        log.warn("子任务处理接近超时，提前结束", {
          subtask_uuid,
          processed: i,
          total: subtask.resources.length,
          elapsedTime
        });
        break;
      }

      const resource = subtask.resources[i];
      
      try {
        log.info(`处理资源 ${i + 1}/${subtask.resources.length}`, {
          name: resource.name,
          subtask_uuid
        });

        const result = await processResourceWithTimeout(resource, categoryMap, parentTask.user_id);
        
        results.push({
          name: resource.name,
          success: true,
          uuid: result.uuid
        });
        
        successCount++;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        
        log.error(`资源处理失败`, error as Error, {
          name: resource.name,
          subtask_uuid
        });
        
        results.push({
          name: resource.name,
          success: false,
          error: errorMessage
        });
        
        failedCount++;
      }
    }

    // 更新子任务完成状态
    await redisBatchManager.updateSubtask(subtask_uuid, {
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

      log.info(`批次 ${subtask.batch_index} 处理完成`, {
        subtask_uuid,
        success_count: successCount,
        failed_count: failedCount,
        completed_batches: newCompletedBatches,
        total_batches: mainTask.total_batches
      });

      // 检查是否所有批次都完成了
      if (newCompletedBatches >= mainTask.total_batches) {
        await completeMainTask(subtask.parent_task_uuid);
      } else {
        // 继续处理下一批 - 这里是真正的链式调用（HTTP请求）
        await redisBatchManager.triggerNextSubtask(subtask.parent_task_uuid);
      }
    }

    return respData({
      message: `批次 ${subtask.batch_index} 处理完成`,
      batch_index: subtask.batch_index,
      success_count: successCount,
      failed_count: failedCount,
      processing_time: Math.round((Date.now() - startTime) / 1000)
    });

  } catch (error) {
    log.error("子任务处理失败", error as Error);
    return respErr("子任务处理失败");
  }
}

// 带超时的资源处理
async function processResourceWithTimeout(
  resourceItem: BatchResourceItem,
  categoryMap: Map<string, number>,
  user_uuid: string
): Promise<{ uuid: string }> {
  const RESOURCE_TIMEOUT = BATCH_UPLOAD_CONFIG.RESOURCE_TIMEOUT; // 25秒超时

  return Promise.race([
    processResource(resourceItem, categoryMap, user_uuid),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`资源处理超时（${RESOURCE_TIMEOUT/1000}秒）`));
      }, RESOURCE_TIMEOUT);
    })
  ]);
}

// 处理单个资源
async function processResource(
  resourceItem: BatchResourceItem,
  categoryMap: Map<string, number>,
  user_uuid: string
): Promise<{ uuid: string }> {

  log.info("开始处理资源", {
    resourceName: resourceItem.name,
    user_uuid
  });

  // 1. AI智能填充缺失信息
  const enrichedResource = await enrichResourceWithAI(resourceItem, categoryMap);

  log.info("AI智能填充完成", {
    title: enrichedResource.title,
    category_id: enrichedResource.category_id
  });

  // 2. 验证用户是否存在
  const supabase = getSupabaseClient();
  const { data: userExists, error: userError } = await supabase
    .from('users')
    .select('uuid')
    .eq('uuid', user_uuid)
    .single();

  log.info("用户验证结果", {
    user_uuid,
    userExists: !!userExists,
    userError: userError?.message
  });

  if (!userExists) {
    throw new Error(`用户不存在: ${user_uuid}`);
  }

  // 3. 创建资源记录
  const resourceUuid = getUuid();
  const resource = {
    uuid: resourceUuid,
    title: enrichedResource.title,
    description: enrichedResource.description,
    content: '', // 批量上传默认为空
    file_url: enrichedResource.link,
    category_id: enrichedResource.category_id,
    author_id: user_uuid, // 使用实际的用户UUID
    status: 'pending' as const,
    rating_avg: 0,
    rating_count: 0,
    view_count: 0,
    access_count: 0,
    is_featured: false,
    is_free: true, // 批量上传默认免费
    credits: 0,
    top: false
  };

  // 插入资源
  const createdResource = await insertResource(resource);

  // 3. 添加标签
  if (enrichedResource.tags && enrichedResource.tags.length > 0 && createdResource.id) {
    await addResourceTags(createdResource.id, enrichedResource.tags);
  }

  // 4. 异步AI审核（不阻塞批量上传）
  if (isAIReviewEnabled()) {
    performAIReview(createdResource, user_uuid).catch(error => {
      log.error("AI评分失败", error, { resourceUuid });
    });
  }

  return { uuid: resourceUuid };
}

// 异步AI审核处理函数
async function performAIReview(resource: any, user_uuid: string) {
  try {
    log.info("开始AI评分", { resourceUuid: resource.uuid, title: resource.title });

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
      // 如果评分低于阈值，自动通过审核
      status: reviewResult.shouldAutoApprove ? 'approved' : 'pending'
    });

    log.info("AI评分完成", {
      resourceUuid: resource.uuid,
      riskScore: reviewResult.riskScore,
      autoApproved: reviewResult.shouldAutoApprove
    });

  } catch (error) {
    log.error("AI评分处理失败", error as Error, {
      resourceUuid: resource.uuid,
      user_uuid
    });
  }
}

// 完成主任务 - 将结果写入数据库
async function completeMainTask(mainTaskUuid: string) {
  try {
    const mainTask = await redisBatchManager.getMainTask(mainTaskUuid);
    if (!mainTask) {
      log.warn("要完成的主任务不存在", { mainTaskUuid });
      return;
    }

    // 更新Redis中的主任务状态
    await redisBatchManager.updateMainTaskProgress(mainTaskUuid, {
      status: 'completed'
    });

    // 收集失败的资源信息（用于details）
    const failedResources: Array<{name: string, error: string}> = [];
    // 这里可以遍历所有子任务收集失败信息，暂时简化

    // 将最终结果写入数据库
    await updateBatchLog(mainTaskUuid, {
      status: 'completed',
      success_count: mainTask.success_count,
      failed_count: mainTask.failed_count,
      completed_at: new Date().toISOString(),
      details: {
        redis_managed: true,
        total_batches: mainTask.total_batches,
        completed_batches: mainTask.completed_batches,
        batch_size: 1,
        execution_summary: {
          total_resources: mainTask.total_resources,
          successful: mainTask.success_count,
          failed: mainTask.failed_count,
          success_rate: Math.round((mainTask.success_count / mainTask.total_resources) * 100)
        },
        failed_resources: failedResources
      }
    });

    // 从用户活跃任务列表中移除
    await redisBatchManager.cleanupCompletedTask(mainTaskUuid, mainTask.user_id);

    log.info("主任务完成并已同步到数据库", {
      task_uuid: mainTaskUuid,
      total_resources: mainTask.total_resources,
      success_count: mainTask.success_count,
      failed_count: mainTask.failed_count
    });

  } catch (error) {
    log.error("完成主任务时出错", error as Error, { mainTaskUuid });
  }
}
