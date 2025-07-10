import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getUserUuid, isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { getUuid } from "@/lib/hash";
import { BatchUploadRequest, BatchResourceItem } from "@/types/batch-upload";
import { createBatchLog, updateBatchLog } from "@/models/batch-log";
import { getSupabaseClient } from "@/models/db";
import { getAllCategories } from "@/models/category";
import { insertResource } from "@/models/resource";
import { addResourceTags } from "@/models/tag";
import { enrichResourceWithAI } from "@/lib/ai-resource-enricher";
import { scoreResourceWithAI, ResourceForReview } from "@/lib/ai-review";
import { isAIReviewEnabled } from "@/lib/ai-review-config";

// 强制动态渲染，因为使用了headers()
export const dynamic = 'force-dynamic';

// POST /api/admin/batch-upload/local - 本地批量上传（极简版，不使用Redis）
export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    // 检查管理员权限
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return respUnauthorized("无管理员权限");
    }

    const body = await req.json();
    const { total_resources, resources }: BatchUploadRequest = body;

    // 验证输入
    if (!resources || !Array.isArray(resources)) {
      return respInvalidParams("resources参数必须是数组");
    }

    if (resources.length === 0) {
      return respInvalidParams("资源数组不能为空");
    }

    // 验证每个资源的基本信息
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      
      if (!resource.name?.trim()) {
        return respInvalidParams(`第${i + 1}个资源的名称不能为空`);
      }
      
      if (!resource.link?.trim()) {
        return respInvalidParams(`第${i + 1}个资源的链接不能为空`);
      }
      
      // 验证链接格式
      try {
        new URL(resource.link);
      } catch {
        return respInvalidParams(`第${i + 1}个资源的链接格式不正确`);
      }
    }

    log.info("开始本地批量上传", {
      count: resources.length,
      user_uuid
    });

    // 验证用户是否存在于数据库中
    const supabase = getSupabaseClient();
    const { data: userExists, error: userError } = await supabase
      .from('users')
      .select('uuid, email')
      .eq('uuid', user_uuid)
      .single();

    if (!userExists) {
      log.error("用户不存在于数据库中", new Error("User not found in database"), { user_uuid });
      return respErr("用户验证失败，请重新登录");
    }

    // 创建批量任务记录
    const taskUuid = getUuid();
    await createBatchLog({
      uuid: taskUuid,
      user_id: user_uuid,
      type: 'batch_upload',
      title: `本地批量上传资源 - ${resources.length}个资源`,
      status: 'processing',
      total_count: resources.length,
      success_count: 0,
      failed_count: 0,
      details: {
        local_upload: true,
        no_redis: true
      }
    });

    // 获取所有分类信息
    const categories = await getAllCategories();
    const categoryMap = new Map<string, number>(
      categories
        .filter(cat => cat.id !== undefined)
        .map(cat => [cat.name, cat.id!])
    );

    const results: Array<{name: string; success: boolean; uuid?: string; error?: string}> = [];
    let successCount = 0;
    let failedCount = 0;

    // 逐个处理资源
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      
      try {
        log.info(`处理资源 ${i + 1}/${resources.length}: ${resource.name}`);
        
        // 处理单个资源
        const result = await processResource(resource, user_uuid, categoryMap);
        
        results.push({
          name: resource.name,
          success: true,
          uuid: result.uuid
        });
        
        successCount++;
        
        log.info(`资源处理成功 ${i + 1}/${resources.length}: ${resource.name}`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        
        results.push({
          name: resource.name,
          success: false,
          error: errorMessage
        });
        
        failedCount++;
        
        log.error(`资源处理失败 ${i + 1}/${resources.length}: ${resource.name}`, error as Error);
      }
    }

    // 更新任务状态
    await updateBatchLog(taskUuid, {
      status: 'completed',
      success_count: successCount,
      failed_count: failedCount,
      details: {
        local_upload: true,
        no_redis: true,
        results: results
      }
    });

    log.info("本地批量上传完成", {
      taskUuid,
      totalResources: resources.length,
      successCount,
      failedCount,
      user_uuid
    });

    return respData({
      task_uuid: taskUuid,
      total_count: resources.length,
      success_count: successCount,
      failed_count: failedCount,
      message: `批量上传完成！成功：${successCount}个，失败：${failedCount}个`,
      results: results
    });

  } catch (error) {
    log.error("本地批量上传失败", error as Error);
    return respErr("批量上传失败，请稍后再试");
  }
}

// 处理单个资源
async function processResource(
  resourceItem: BatchResourceItem,
  user_uuid: string,
  categoryMap: Map<string, number>
): Promise<{ uuid: string }> {
  
  // 1. AI智能填充缺失信息
  const enrichedResource = await enrichResourceWithAI(resourceItem, categoryMap);
  
  // 2. 创建资源记录
  const resourceUuid = getUuid();
  const resource = {
    uuid: resourceUuid,
    title: enrichedResource.title,
    description: enrichedResource.description,
    content: '', // 批量上传默认为空
    file_url: enrichedResource.link,
    category_id: enrichedResource.category_id,
    author_id: user_uuid,
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

// 异步AI审核
async function performAIReview(createdResource: any, user_uuid: string): Promise<void> {
  try {
    const resourceForReview: ResourceForReview = {
      title: createdResource.title,
      description: createdResource.description,
      content: createdResource.content || '',
      file_url: createdResource.file_url
    };

    const reviewResult = await scoreResourceWithAI(resourceForReview, user_uuid);

    // 更新资源的AI评分信息
    const { updateResourceAIScore } = await import("@/models/resource");
    await updateResourceAIScore(createdResource.uuid, {
      ai_risk_score: reviewResult.riskScore,
      ai_review_result: reviewResult.reasoning,
      ai_reviewed_at: new Date().toISOString(),
      auto_approved: reviewResult.shouldAutoApprove,
      // 如果评分低于阈值，自动通过审核
      status: reviewResult.shouldAutoApprove ? 'approved' : 'pending'
    });

    log.info("AI评分完成", {
      resourceUuid: createdResource.uuid,
      riskScore: reviewResult.riskScore,
      autoApproved: reviewResult.shouldAutoApprove
    });
  } catch (error) {
    log.error("AI审核失败", error as Error, {
      resourceUuid: createdResource.uuid
    });

    // AI评分失败时，记录失败信息但不影响资源状态
    try {
      const { updateResourceAIScore } = await import("@/models/resource");
      await updateResourceAIScore(createdResource.uuid, {
        ai_risk_score: 50, // 默认中等风险分数
        ai_review_result: `AI评分失败：${(error as Error).message}`,
        ai_reviewed_at: new Date().toISOString(),
        auto_approved: false
        // 不改变status，保持pending状态等待人工审核
      });
    } catch (updateError) {
      log.error("更新AI评分失败信息时出错", updateError as Error, {
        resourceUuid: createdResource.uuid
      });
    }
  }
}
