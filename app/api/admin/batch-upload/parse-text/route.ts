import { respData, respErr, respInvalidParams, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { isUserAdmin } from "@/services/user";
import { log } from "@/lib/logger";
import { 
  parseTextWithRegex, 
  splitTextIntoResourceBlocks,
  ParseResult,
  ParsedResource 
} from "@/lib/text-parser";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

interface ParseTextRequest {
  text: string;
}

// AI解析单个资源块
async function parseResourceBlockWithAI(block: string): Promise<ParsedResource | null> {
  try {
    const siliconflow = createOpenAICompatible({
      name: "siliconflow",
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    });

    const model = siliconflow("Qwen/Qwen2.5-7B-Instruct");

    const prompt = `你是一个专业的文本解析助手，请从以下文本中提取资源名称和链接。

文本内容：
${block}

要求：
1. 提取资源的名称（标题）
2. 提取资源的链接（必须是有效的http或https链接）
3. 如果文本中包含多个链接，选择最主要的一个
4. 资源名称要简洁明确，移除不必要的emoji和特殊字符
5. 必须返回JSON格式：{"name": "资源名称", "link": "链接地址"}
6. 如果无法提取有效的资源信息，返回：{"error": "无法解析"}

请直接返回JSON，不要包含其他文字：`;

    const result = await generateText({
      model,
      prompt,
      temperature: 0.1,
      maxTokens: 200,
    });

    // 尝试解析JSON响应
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.error) {
          return null;
        }
        
        if (parsed.name && parsed.link) {
          return {
            name: parsed.name.trim().substring(0, 100),
            link: parsed.link.trim()
          };
        }
      }
    } catch (parseError) {
      log.warn("AI解析JSON失败", { error: parseError, response: result.text });
    }
    
    return null;
  } catch (error) {
    log.error("AI解析资源块失败", error as Error);
    return null;
  }
}

// 使用AI解析文本（兜底方案）
async function parseTextWithAI(text: string): Promise<ParseResult> {
  const resources: ParsedResource[] = [];
  const errors: string[] = [];
  
  try {
    // 将文本分割为资源块
    const blocks = splitTextIntoResourceBlocks(text);
    
    if (blocks.length === 0) {
      return {
        resources: [],
        errors: ["未找到可解析的资源信息"],
        stats: {
          total: 0,
          success: 0,
          failed: 1,
          method: 'ai'
        }
      };
    }

    // 限制AI解析的块数量（避免过多API调用）
    const maxBlocks = Math.min(blocks.length, 20);
    const blocksToProcess = blocks.slice(0, maxBlocks);
    
    if (blocks.length > maxBlocks) {
      errors.push(`文本包含${blocks.length}个资源块，仅处理前${maxBlocks}个`);
    }

    // 并发处理多个资源块（限制并发数）
    const batchSize = 3;
    for (let i = 0; i < blocksToProcess.length; i += batchSize) {
      const batch = blocksToProcess.slice(i, i + batchSize);
      const promises = batch.map(block => parseResourceBlockWithAI(block));
      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        if (result) {
          // 检查重复
          const isDuplicate = resources.some(r => 
            r.name === result.name || r.link === result.link
          );
          
          if (!isDuplicate) {
            resources.push(result);
          } else {
            errors.push(`重复的资源：${result.name}`);
          }
        } else {
          errors.push(`无法解析第${i + index + 1}个资源块`);
        }
      });
    }

    return {
      resources,
      errors,
      stats: {
        total: resources.length + errors.length,
        success: resources.length,
        failed: errors.length,
        method: 'ai'
      }
    };
    
  } catch (error) {
    log.error("AI解析文本失败", error as Error);
    return {
      resources: [],
      errors: ["AI解析失败，请检查文本格式"],
      stats: {
        total: 0,
        success: 0,
        failed: 1,
        method: 'ai'
      }
    };
  }
}

// POST /api/admin/batch-upload/parse-text - 解析文本为JSON格式
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
    const { text }: ParseTextRequest = body;

    // 验证输入
    if (!text || typeof text !== 'string') {
      return respInvalidParams("text参数必须是字符串");
    }

    if (text.trim().length === 0) {
      return respInvalidParams("文本内容不能为空");
    }

    if (text.length > 50000) {
      return respInvalidParams("文本内容过长，请限制在50000字符以内");
    }

    log.info("收到文本解析请求", { 
      user_uuid, 
      textLength: text.length 
    });

    // 首先尝试正则表达式解析
    const regexResult = parseTextWithRegex(text);
    
    // 如果正则解析成功率较高，直接返回结果
    if (regexResult.resources.length > 0 && 
        regexResult.stats.success / regexResult.stats.total >= 0.7) {
      
      log.info("正则解析成功", {
        user_uuid,
        resourceCount: regexResult.resources.length,
        successRate: regexResult.stats.success / regexResult.stats.total
      });
      
      return respData(regexResult);
    }

    // 如果正则解析效果不好，使用AI解析作为兜底
    log.info("正则解析效果不佳，使用AI解析", {
      user_uuid,
      regexSuccess: regexResult.stats.success,
      regexTotal: regexResult.stats.total
    });

    const aiResult = await parseTextWithAI(text);
    
    // 合并正则和AI的结果（去重）
    const combinedResources: ParsedResource[] = [...regexResult.resources];
    const combinedErrors: string[] = [...regexResult.errors, ...aiResult.errors];
    
    // 添加AI解析的新资源（避免重复）
    for (const aiResource of aiResult.resources) {
      const isDuplicate = combinedResources.some(r => 
        r.name === aiResource.name || r.link === aiResource.link
      );
      
      if (!isDuplicate) {
        combinedResources.push(aiResource);
      }
    }

    const finalResult: ParseResult = {
      resources: combinedResources,
      errors: combinedErrors,
      stats: {
        total: combinedResources.length + combinedErrors.length,
        success: combinedResources.length,
        failed: combinedErrors.length,
        method: combinedResources.length > regexResult.resources.length ? 'ai' : 'regex'
      }
    };

    log.info("文本解析完成", {
      user_uuid,
      finalResourceCount: finalResult.resources.length,
      method: finalResult.stats.method,
      regexCount: regexResult.resources.length,
      aiCount: aiResult.resources.length
    });

    return respData(finalResult);

  } catch (error) {
    log.error("文本解析失败", error as Error);
    return respErr("文本解析失败，请稍后再试");
  }
}
