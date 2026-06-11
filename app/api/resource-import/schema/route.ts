import { respData } from "@/lib/resp";
import { DEFAULT_SAFE_THRESHOLD, RESOURCE_IMPORT_MAX_ITEMS, RESOURCE_IMPORT_SECRET } from "@/lib/resource-import";

export const dynamic = 'force-dynamic';

export async function GET() {
  return respData({
    name: "Resource Import API",
    description: "通用资源批量导入接口。AI按此格式清洗数据后，可先preview再commit。",
    auth: {
      secret: RESOURCE_IMPORT_SECRET,
      headers: [
        `Authorization: Bearer ${RESOURCE_IMPORT_SECRET}`,
        `x-import-key: ${RESOURCE_IMPORT_SECRET}`
      ],
      query: `?key=${RESOURCE_IMPORT_SECRET}`
    },
    limits: {
      max_items_per_request: RESOURCE_IMPORT_MAX_ITEMS
    },
    safety_rule: {
      field: "safety_score",
      range: "0-100，分数越高越安全",
      default_safe_threshold: DEFAULT_SAFE_THRESHOLD,
      behavior: `safety_score >= ${DEFAULT_SAFE_THRESHOLD} 自动过审，否则进入待审核。不会因为风险分过滤资源。`
    },
    endpoints: {
      preview: "POST /api/resource-import/preview",
      commit: "POST /api/resource-import/commit"
    },
    schema: {
      source: {
        name: "来源名称，例如 FMHY",
        url: "来源网站地址",
        description: "来源说明"
      },
      defaults: {
        author_uuid: "可选；不填时自动使用管理员或第一个用户作为作者",
        category_name: "默认分类名，不存在会自动创建",
        tags: ["默认标签"],
        is_free: true,
        credits: 0,
        safety_score: 80
      },
      options: {
        safe_threshold: DEFAULT_SAFE_THRESHOLD,
        create_missing_categories: true,
        skip_existing: true
      },
      resources: [
        {
          external_id: "外部唯一ID，可选",
          title: "资源标题，必填；也兼容name",
          url: "资源链接，必填；也兼容link",
          description: "资源描述",
          content: "详细说明，可选",
          category_name: "分类名",
          tags: ["标签1", "标签2"],
          source_section: "来源栏目，可选",
          quality: "recommended / normal 等，可选",
          safety_score: 90,
          safety_note: "安全评分说明，可选",
          is_free: true,
          credits: 0
        }
      ]
    },
    example: {
      source: {
        name: "Example Site",
        url: "https://example.com",
        description: "示例资源站"
      },
      defaults: {
        category_name: "AI工具",
        tags: ["外部导入", "精选"],
        is_free: true,
        credits: 0
      },
      options: {
        safe_threshold: DEFAULT_SAFE_THRESHOLD
      },
      resources: [
        {
          external_id: "example-qwen",
          title: "Qwen",
          url: "https://chat.qwen.ai/",
          description: "Qwen官方AI聊天工具。",
          category_name: "AI工具",
          tags: ["AI", "聊天机器人"],
          source_section: "Artificial Intelligence / Official Model Sites",
          quality: "recommended",
          safety_score: 95,
          safety_note: "官方网站，风险低"
        }
      ]
    }
  });
}
