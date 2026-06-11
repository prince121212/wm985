# 通用资源导入 API

固定密钥：`wm985`

调用方式任选其一：

```http
Authorization: Bearer wm985
```

或：

```http
x-import-key: wm985
```

## 1. 查看格式

```http
GET /api/resource-import/schema
```

## 2. 预览，不入库

```http
POST /api/resource-import/preview
Authorization: Bearer wm985
Content-Type: application/json
```

## 3. 确认导入

```http
POST /api/resource-import/commit
Authorization: Bearer wm985
Content-Type: application/json
```

## JSON 格式

```json
{
  "source": {
    "name": "Example Site",
    "url": "https://example.com",
    "description": "示例资源站"
  },
  "defaults": {
    "category_name": "AI工具",
    "tags": ["外部导入", "精选"],
    "is_free": true,
    "credits": 0,
    "safety_score": 80
  },
  "options": {
    "safe_threshold": 80,
    "create_missing_categories": true,
    "skip_existing": true
  },
  "resources": [
    {
      "external_id": "example-qwen",
      "title": "Qwen",
      "url": "https://chat.qwen.ai/",
      "description": "Qwen官方AI聊天工具。",
      "category_name": "AI工具",
      "tags": ["AI", "聊天机器人"],
      "source_section": "Artificial Intelligence / Official Model Sites",
      "quality": "recommended",
      "safety_score": 95,
      "safety_note": "官方网站，风险低"
    }
  ]
}
```

## 安全分值规则

- `safety_score` 范围：0-100，分数越高越安全。
- 默认阈值：80。
- `safety_score >= 80`：自动过审，状态为 `approved`。
- `safety_score < 80`：进入待审核，状态为 `pending`。
- 不会因为风险过滤资源，低分资源仍会导入，只是等待人工审核。

## 兼容字段

每条资源里：

- `title` 也兼容 `name`
- `url` 也兼容 `link`

## 注意

- 单次最多 500 条，更多请分批。
- 默认会按 URL 跳过数据库已有资源。
- 分类不存在时默认自动创建。
- 不传 `defaults.author_uuid` 时，接口会自动使用管理员用户或系统第一个用户作为作者。
