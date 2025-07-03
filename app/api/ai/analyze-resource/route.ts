import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { respData, respErr, respUnauthorized } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";
import { getAllCategories } from "@/models/category";

export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respUnauthorized("用户未登录");
    }

    const { text } = await req.json();
    
    if (!text || !text.trim()) {
      return respErr("请输入要分析的文本内容");
    }

    if (text.trim().length > 2000) {
      return respErr("文本内容不能超过2000个字符");
    }

    log.info("AI资源分析请求", { user_uuid, textLength: text.length });

    // 获取数据库中的所有分类
    const categories = await getAllCategories();
    const categoryNames = categories.map(cat => cat.name).join('、');

    // 提取资源链接
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    const resourceUrl = urls.length > 0 ? urls[0] : '';

    // 使用SiliconFlow的免费模型
    const siliconflow = createOpenAICompatible({
      name: "siliconflow",
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    });

    const model = siliconflow("Qwen/Qwen2.5-7B-Instruct"); // 免费模型

    const prompt = `你是一个专业的资源分析助手，请分析以下文本内容，为资源上传提供智能建议。

文本内容：
${text}

请根据文本内容，生成以下信息（请用JSON格式返回）：
{
  "title": "根据内容生成一个简洁明确的资源标题（不超过50字）",
  "description": "生成详细的资源描述（100-200字，说明资源的主要内容和价值）",
  "category": "推荐最合适的分类（必须从以下分类中选择一个：${categoryNames}）",
  "tags": ["根据内容生成3-5个相关标签"],
  "file_url": "${resourceUrl}"
}

要求：
1. 标题要简洁明确，突出资源核心价值
2. 描述要详细但不冗长，突出资源特点和适用场景
3. 分类必须从提供的分类列表中选择最匹配的一个：${categoryNames}
4. 标签要相关且有用，便于搜索
5. file_url字段直接使用提取到的链接：${resourceUrl}
6. 必须返回有效的JSON格式`;

    const result = await generateText({
      model,
      prompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    // 尝试解析JSON响应
    let analysis;
    try {
      // 提取JSON部分（去除可能的额外文本）
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("未找到JSON格式的响应");
      }
    } catch (parseError) {
      log.warn("AI响应解析失败", { error: parseError, response: result.text });
      return respErr("AI分析结果格式错误，请重试");
    }

    // 验证响应格式
    if (!analysis.title || !analysis.description || !analysis.category || !analysis.tags) {
      return respErr("AI分析结果不完整，请重试");
    }

    // 确保file_url字段存在
    if (!analysis.file_url && resourceUrl) {
      analysis.file_url = resourceUrl;
    }

    log.info("AI资源分析成功", { 
      user_uuid, 
      title: analysis.title,
      category: analysis.category,
      tagsCount: analysis.tags?.length || 0
    });

    return respData({
      analysis,
      message: "AI分析完成"
    });

  } catch (error) {
    log.error("AI资源分析失败", error as Error, {
      user_uuid: await getUserUuid().catch(() => 'unknown'),
      endpoint: "/api/ai/analyze-resource"
    });

    return respErr("AI分析失败，请稍后再试");
  }
}
