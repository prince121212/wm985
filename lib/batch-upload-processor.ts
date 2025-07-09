import { log } from "@/lib/logger";
import { updateBatchLog, findBatchLogByUuid, BatchLogDetail } from "@/models/batch-log";
import { insertResource, updateResourceAIScore } from "@/models/resource";
import { addResourceTags } from "@/models/tag";
import { getAllCategories, findCategoryByName } from "@/models/category";
import { getUuid } from "@/lib/hash";
import { scoreResourceWithAI, ResourceForReview } from "@/lib/ai-review";
import { isAIReviewEnabled } from "@/lib/ai-review-config";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

interface BatchResourceItem {
  name: string;
  link: string;
}

interface EnrichedResource {
  title: string;
  description: string;
  link: string;
  category_id: number;
  tags: string[];
}

// 主要的批量处理函数
export async function processBatchUpload(
  taskUuid: string,
  resources: BatchResourceItem[],
  user_uuid: string
): Promise<void> {
  try {
    log.info("开始批量处理上传任务", { taskUuid, resourceCount: resources.length });

    // 更新任务状态为处理中
    await updateBatchLog(taskUuid, {
      status: 'processing'
    });

    // 获取所有分类信息
    const categories = await getAllCategories();
    const categoryMap = new Map<string, number>(
      categories
        .filter(cat => cat.id !== undefined)
        .map(cat => [cat.name, cat.id!])
    );

    const results: BatchLogDetail[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 逐个处理资源
    for (let i = 0; i < resources.length; i++) {
      const resourceItem = resources[i];
      
      try {
        log.info(`处理第${i + 1}个资源`, { 
          name: resourceItem.name, 
          taskUuid 
        });

        const processResult = await processResource(resourceItem, user_uuid, categoryMap);
        
        results.push({
          name: resourceItem.name,
          success: true,
          uuid: processResult.uuid
        });
        
        successCount++;
        
        log.info(`第${i + 1}个资源处理成功`, { 
          name: resourceItem.name,
          uuid: processResult.uuid,
          taskUuid 
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        
        log.error(`第${i + 1}个资源处理失败`, error as Error, {
          name: resourceItem.name,
          taskUuid
        });
        
        results.push({
          name: resourceItem.name,
          success: false,
          error: errorMessage
        });
        
        failedCount++;
      }

      // 每处理10个资源更新一次进度
      if ((i + 1) % 10 === 0 || i === resources.length - 1) {
        await updateBatchLog(taskUuid, {
          success_count: successCount,
          failed_count: failedCount,
          details: {
            results: results,
            progress: {
              processed: i + 1,
              total: resources.length,
              percentage: Math.round(((i + 1) / resources.length) * 100)
            }
          }
        });
        
        log.info("批量处理进度更新", {
          taskUuid,
          processed: i + 1,
          total: resources.length,
          successCount,
          failedCount
        });
      }
    }

    // 更新任务状态为完成
    await updateBatchLog(taskUuid, {
      status: 'completed',
      success_count: successCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
      details: {
        results: results,
        summary: {
          total: resources.length,
          successful: successCount,
          failed: failedCount,
          success_rate: Math.round((successCount / resources.length) * 100)
        }
      }
    });

    log.info("批量处理任务完成", {
      taskUuid,
      total: resources.length,
      successful: successCount,
      failed: failedCount
    });

  } catch (error) {
    log.error("批量处理任务失败", error as Error, { taskUuid });
    
    // 更新任务状态为失败
    await updateBatchLog(taskUuid, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : "批量处理过程中发生未知错误",
      completed_at: new Date().toISOString()
    });
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

// AI智能填充资源信息
async function enrichResourceWithAI(
  resourceItem: BatchResourceItem,
  categoryMap: Map<string, number>
): Promise<EnrichedResource> {
  
  try {
    // 构建AI分析文本
    const analysisText = `资源名称：${resourceItem.name}\n资源链接：${resourceItem.link}`;
    
    // 获取所有分类名称
    const categoryNames = Array.from(categoryMap.keys()).join('、');
    
    // 使用AI分析资源信息
    const siliconflow = createOpenAICompatible({
      name: "siliconflow",
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    });

    const model = siliconflow("Qwen/Qwen2.5-7B-Instruct");

    const prompt = `你是一个专业的资源分析助手，请分析以下资源信息，生成详细的资源描述、推荐分类和相关标签。

资源信息：
${analysisText}

可选分类：${categoryNames}

请返回JSON格式的分析结果：
{
  "title": "优化后的资源标题（保持简洁明确）",
  "description": "详细的资源描述（100-200字，突出资源特点和价值）",
  "category": "从可选分类中选择最匹配的一个",
  "tags": ["相关标签1", "相关标签2", "相关标签3"]
}

要求：
1. 标题要简洁明确，突出资源核心价值
2. 描述要详细但不冗长，突出资源特点和适用场景
3. 分类必须从提供的分类列表中选择最匹配的一个
4. 标签要相关且有用，便于搜索，3-5个即可
5. 必须返回有效的JSON格式`;

    const result = await generateText({
      model,
      prompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    // 解析AI响应
    let analysis;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("未找到JSON格式的响应");
      }
    } catch (parseError) {
      log.warn("AI响应解析失败，使用默认值", { 
        error: parseError, 
        response: result.text,
        resourceName: resourceItem.name 
      });
      
      // 使用默认值
      analysis = {
        title: resourceItem.name,
        description: `${resourceItem.name}资源分享`,
        category: "其他资源",
        tags: ["资源", "分享"]
      };
    }

    // 验证和处理分类
    let categoryId = categoryMap.get(analysis.category);
    if (!categoryId) {
      // 如果AI推荐的分类不存在，尝试找到最相似的分类
      const categoryNames = Array.from(categoryMap.keys());
      const defaultCategory = categoryNames.find(name => 
        name.includes("其他") || name.includes("综合")
      ) || categoryNames[0];
      categoryId = categoryMap.get(defaultCategory) || 1;
      
      log.warn("AI推荐的分类不存在，使用默认分类", {
        aiCategory: analysis.category,
        defaultCategory,
        resourceName: resourceItem.name
      });
    }

    return {
      title: analysis.title || resourceItem.name,
      description: analysis.description || `${resourceItem.name}资源分享`,
      link: resourceItem.link,
      category_id: categoryId,
      tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 5) : ["资源", "分享"]
    };

  } catch (error) {
    log.error("AI智能填充失败，使用默认值", error as Error, {
      resourceName: resourceItem.name
    });
    
    // AI失败时使用默认值
    const defaultCategoryId = categoryMap.get("其他资源") || 
                             categoryMap.get("综合资源") || 
                             Array.from(categoryMap.values())[0] || 1;
    
    return {
      title: resourceItem.name,
      description: `${resourceItem.name}资源分享`,
      link: resourceItem.link,
      category_id: defaultCategoryId,
      tags: ["资源", "分享"]
    };
  }
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
      shouldAutoApprove: reviewResult.shouldAutoApprove
    });

  } catch (error) {
    log.error("AI评分处理失败", error as Error, {
      resourceUuid: resource.uuid,
      user_uuid
    });
  }
}
