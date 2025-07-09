/**
 * AI资源智能填充工具
 * 用于批量上传时自动填充资源信息
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { log } from "@/lib/logger";
import { BatchResourceItem, EnrichedResource, BATCH_UPLOAD_CONFIG } from "@/types/batch-upload";

/**
 * AI智能填充资源信息
 */
export async function enrichResourceWithAI(
  resourceItem: BatchResourceItem,
  categoryMap: Map<string, number>
): Promise<EnrichedResource> {
  
  try {
    // 检查API密钥
    if (!process.env.SILICONFLOW_API_KEY) {
      log.warn("AI API密钥未配置，使用默认值", { resourceName: resourceItem.name });
      return getDefaultEnrichedResource(resourceItem, categoryMap);
    }

    // 构建AI分析文本
    const analysisText = `资源名称：${resourceItem.name}\n资源链接：${resourceItem.link}`;
    
    // 获取所有分类名称
    const categoryNames = Array.from(categoryMap.keys()).join('、');
    
    // 使用AI分析资源信息，增加超时控制
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
  "title": "简洁明确的资源标题",
  "description": "详细的资源描述",
  "category": "从可选分类中选择最匹配的一个",
  "tags": ["相关标签1", "相关标签2", "相关标签3"]
}

要求：
1. 标题要简洁明确，突出资源核心价值
2. 描述要详细但不冗长，突出资源特点和适用场景
3. 分类必须从提供的分类列表中选择最匹配的一个
4. 标签要相关且有用，便于搜索，3-5个即可
5. 必须返回有效的JSON格式`;

    // 使用Promise.race实现超时控制
    const AI_TIMEOUT = BATCH_UPLOAD_CONFIG.AI_TIMEOUT;
    const result = await Promise.race([
      generateText({
        model,
        prompt,
        temperature: 0.7,
        maxTokens: 500,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('AI调用超时'));
        }, AI_TIMEOUT);
      })
    ]);

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
      
      return getDefaultEnrichedResource(resourceItem, categoryMap);
    }

    // 验证和处理AI返回的数据
    const categoryId = categoryMap.get(analysis.category) || 
                      categoryMap.get("其他资源") || 
                      categoryMap.get("综合资源") || 
                      Array.from(categoryMap.values())[0] || 1;

    return {
      title: analysis.title || resourceItem.name,
      description: analysis.description || `${resourceItem.name} - 资源分享`,
      link: resourceItem.link,
      category_id: categoryId,
      tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 5) : ["资源", "分享"]
    };

  } catch (error) {
    log.error("AI智能填充失败，使用默认值", error as Error, {
      resourceName: resourceItem.name
    });
    
    return getDefaultEnrichedResource(resourceItem, categoryMap);
  }
}

/**
 * 获取默认的资源信息（当AI不可用时）
 */
export function getDefaultEnrichedResource(
  resourceItem: BatchResourceItem,
  categoryMap: Map<string, number>
): EnrichedResource {
  // 尝试从资源名称推断分类
  const name = resourceItem.name.toLowerCase();
  let categoryId = categoryMap.get("其他资源") ||
                   categoryMap.get("综合资源") ||
                   Array.from(categoryMap.values())[0] || 1;

  // 简单的分类推断逻辑
  if (name.includes('电影') || name.includes('影视') || name.includes('movie')) {
    categoryId = categoryMap.get("影视资源") || categoryId;
  } else if (name.includes('音乐') || name.includes('歌曲') || name.includes('music')) {
    categoryId = categoryMap.get("音乐资源") || categoryId;
  } else if (name.includes('软件') || name.includes('工具') || name.includes('app')) {
    categoryId = categoryMap.get("软件工具") || categoryId;
  } else if (name.includes('游戏') || name.includes('game')) {
    categoryId = categoryMap.get("游戏资源") || categoryId;
  } else if (name.includes('教程') || name.includes('学习') || name.includes('课程')) {
    categoryId = categoryMap.get("学习资源") || categoryId;
  }

  return {
    title: resourceItem.name,
    description: `${resourceItem.name} - 资源分享`,
    link: resourceItem.link,
    category_id: categoryId,
    tags: ["资源", "分享"]
  };
}
