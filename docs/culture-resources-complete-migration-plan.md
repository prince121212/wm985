# 文明资源站完整改造计划

## 📋 项目概况

当前项目是一个基于 Next.js 15 的 AI SaaS 模板项目，需要改造为文明资源站。项目使用现代技术栈：
- **前端**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Shadcn UI
- **后端**: Next.js API Routes, Supabase (PostgreSQL)
- **认证**: NextAuth.js 5.0 (支持邮箱密码、Google 登录)
- **支付**: Stripe (可用于付费资源)
- **国际化**: next-intl
- **部署**: Vercel, Cloudflare Pages

## 🎯 改造目标

将 ShipAny AI SaaS 模板改造为文明资源站，参考原型图功能但保持当前系统样式主题，争取用最小的改动完成改造计划。

## 🔄 实施原则

### 保留现有功能
- ✅ 用户认证系统（邮箱密码、Google 登录）
- ✅ 用户中心基础功能
- ✅ 支付系统（可用于付费资源）
- ✅ 管理后台框架
- ✅ 国际化支持
- ✅ 主题切换
- ✅ 响应式设计
- ✅ 现有的 UI 组件库

### 设计原则
- 保持当前系统的设计风格和主题
- 使用现有的 Shadcn UI 组件
- 保持响应式设计
- 遵循现有的代码规范和架构
- 最大化复用现有组件和样式

## 📝 详细改造计划

### 第一阶段：基础信息更新 (预计2-3天)

#### 1.1 项目名称和品牌更新
- [ ] 将所有 "ShipAny" 替换为 "文明资源站"
- [ ] 更新 package.json 中的项目名称和描述
- [ ] 更新 README.md
- [ ] 更新国际化文件（i18n/messages/en.json, zh.json）
- [ ] 更新导航菜单和页面标题

#### 1.2 Logo和视觉元素更新
- [ ] 替换 public/logo.png 为文明资源站 logo （已改）
- [ ] 更新 public/favicon.ico（已改）
- [ ] 调整品牌色彩（不需要）

#### 1.3 法律文档更新
- [ ] 更新隐私政策、服务条款
- [ ] 更新 LICENSE 文件
- [ ] 调整法律文档内容适配资源站业务

#### 1.4 环境变量配置
- [ ] 更新环境变量中的项目名称
- [ ] 配置文件存储相关环境变量

### 第二阶段：数据模型设计 (预计3-4天)

#### 2.1 资源数据模型设计
创建 `models/resource.ts`，定义资源的数据结构：
```typescript
interface Resource {
  id: string;
  title: string;
  description: string;
  content?: string;
  file_url?: string;
  file_type: string;
  file_size?: number;
  category_id: string;
  tags: string[];
  author_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rating_avg: number;
  rating_count: number;
  view_count: number;
  download_count: number;
  is_featured: boolean;
  is_free: boolean;
  price?: number;
  created_at: string;
  updated_at: string;
}
```

#### 2.2 分类和标签模型
- 创建 `models/category.ts` - 分类数据模型
- 创建 `models/tag.ts` - 标签数据模型

#### 2.3 用户交互模型
- 创建 `models/rating.ts` - 评分数据模型
- 创建 `models/favorite.ts` - 收藏数据模型
- 创建 `models/comment.ts` - 评论数据模型

#### 2.4 数据库表结构设计
更新 `data/install.sql`，添加以下表：
- resources（资源表）
- categories（分类表）
- tags（标签表）
- resource_tags（资源标签关联表）
- ratings（评分表）
- favorites（收藏表）
- comments（评论表）

#### 2.5 数据库迁移脚本
编写数据库迁移脚本，确保现有数据不受影响

### 第三阶段：核心页面开发 (预计5-7天)

#### 3.1 首页改造
基于现有首页结构，调整内容：
- 保留当前 Hero 区域，调整文案为文明资源站
- 添加分类导航区块
- 添加热门资源展示区块
- 添加最新资源区块
- 保留现有的 CTA 区域

#### 3.2 资源列表页面
创建 `app/[locale]/(default)/resources/page.tsx`：
- 实现资源列表展示
- 添加筛选功能（分类、标签、评分）
- 添加搜索功能
- 添加排序功能（最新、最热、评分）
- 实现分页功能

#### 3.3 资源详情页面
创建 `app/[locale]/(default)/resources/[id]/page.tsx`：
- 展示资源详细信息
- 显示评分和评论
- 提供下载/访问功能
- 显示相关资源推荐

#### 3.4 资源上传页面
创建 `app/[locale]/(default)/upload/page.tsx`：
- 实现文件上传功能
- 资源信息填写表单
- 分类和标签选择
- 表单验证和提交

#### 3.5 分类和标签页面
- 创建 `/categories` 页面，展示分类列表
- 创建 `/tags` 页面，展示标签云

#### 3.6 用户中心扩展
在现有用户中心基础上添加：
- "我的上传" 页面
- "我的收藏" 页面
- "我的评论" 页面

### 第四阶段：API接口开发 (预计4-5天)

#### 4.1 资源管理API
- `GET /api/resources` - 获取资源列表（支持筛选、搜索、排序）
- `GET /api/resources/[id]` - 获取资源详情
- `POST /api/resources` - 上传资源
- `PUT /api/resources/[id]` - 更新资源
- `DELETE /api/resources/[id]` - 删除资源

#### 4.2 资源查询API
优化 `GET /api/resources` 接口，支持：
- 分类筛选
- 标签筛选
- 关键词搜索
- 评分筛选
- 排序（时间、热度、评分）
- 分页

#### 4.3 分类和标签API
- `GET /api/categories` - 获取分类列表
- `GET /api/tags` - 获取标签列表
- `POST /api/categories` - 创建分类（管理员）
- `POST /api/tags` - 创建标签

#### 4.4 文件上传API
- `POST /api/upload` - 文件上传接口
- 集成现有存储服务
- 支持多种文件类型
- 文件大小限制和验证

#### 4.5 用户交互API
- `POST /api/resources/[id]/favorite` - 收藏/取消收藏
- `POST /api/resources/[id]/rating` - 评分
- `GET /api/resources/[id]/comments` - 获取评论
- `POST /api/resources/[id]/comments` - 添加评论

### 第五阶段：组件开发 (预计4-5天)

#### 5.1 资源卡片组件
开发 `components/blocks/resource-card.tsx`：
- 展示资源基本信息
- 显示评分和标签
- 收藏按钮
- 响应式设计

#### 5.2 资源列表组件
开发 `components/blocks/resource-list.tsx`：
- 资源列表展示
- 分页功能
- 加载状态

#### 5.3 资源筛选组件
开发 `components/blocks/resource-filter.tsx`：
- 分类筛选
- 标签筛选
- 评分筛选
- 搜索框

#### 5.4 资源上传组件
开发 `components/blocks/resource-upload.tsx`：
- 文件上传
- 拖拽上传
- 进度显示
- 表单验证

#### 5.5 交互功能组件
- `components/ui/rating-stars.tsx` - 评分星级组件
- `components/ui/favorite-button.tsx` - 收藏按钮组件
- `components/blocks/comment-section.tsx` - 评论区组件

#### 5.6 选择器组件
- `components/ui/tag-selector.tsx` - 标签选择器
- `components/ui/category-selector.tsx` - 分类选择器

### 第六阶段：用户交互功能 (预计3-4天)

#### 6.1 收藏功能实现
- 前端收藏按钮组件
- 后端收藏API
- 我的收藏页面

#### 6.2 评分功能实现
- 星级评分组件
- 评分统计
- 评分API

#### 6.3 评论功能实现
- 评论发布
- 评论展示
- 评论回复（可选）

#### 6.4 通知功能
- 收藏通知
- 评论通知
- 系统通知

### 第七阶段：管理后台扩展 (预计3-4天)

#### 7.1 资源管理后台
在现有管理后台基础上添加：
- 资源列表管理
- 资源审核功能
- 资源编辑和删除

#### 7.2 分类和标签管理
- 分类管理页面
- 标签管理页面
- 增删改查功能

#### 7.3 用户上传统计
- 用户上传数量统计
- 资源质量分析
- 热门资源统计

#### 7.4 内容审核系统
- 待审核资源列表
- 审核流程管理
- 审核状态跟踪

### 第八阶段：国际化和优化 (预计2-3天)

#### 8.1 多语言支持完善
- 添加资源相关的翻译文本
- 更新导航菜单翻译
- 添加新页面的翻译

#### 8.2 SEO优化
- 更新页面 metadata
- 添加结构化数据
- 优化页面标题和描述

#### 8.3 性能优化
- 页面加载速度优化
- 图片懒加载
- 资源缓存策略

#### 8.4 响应式优化
- 移动端体验优化
- 触摸友好的交互
- 移动端导航优化

## 📊 项目时间线

| 阶段 | 预计时间 | 主要交付物 |
|------|----------|------------|
| 第一阶段 | 2-3天 | 品牌更新完成 |
| 第二阶段 | 3-4天 | 数据模型和数据库设计 |
| 第三阶段 | 5-7天 | 核心页面开发完成 |
| 第四阶段 | 4-5天 | API接口开发完成 |
| 第五阶段 | 4-5天 | 组件开发完成 |
| 第六阶段 | 3-4天 | 用户交互功能完成 |
| 第七阶段 | 3-4天 | 管理后台扩展完成 |
| 第八阶段 | 2-3天 | 优化和完善 |

**总计预估时间：26-35天**

## 🔍 风险评估和应对策略

### 技术风险
1. **数据库迁移风险**
   - 应对：充分测试迁移脚本，做好数据备份
   
2. **文件存储集成**
   - 应对：复用现有存储服务配置，渐进式集成

3. **性能影响**
   - 应对：分阶段上线，监控性能指标

### 业务风险
1. **用户体验变化**
   - 应对：保持现有设计风格，渐进式功能发布

2. **功能复杂度**
   - 应对：MVP优先，核心功能先行

## 📋 验收标准

### 功能验收
- [ ] 所有核心页面正常访问
- [ ] 资源上传、浏览、搜索功能正常
- [ ] 用户交互功能（收藏、评分、评论）正常
- [ ] 管理后台功能正常
- [ ] 移动端适配良好

### 性能验收
- [ ] 页面加载时间 < 3秒
- [ ] 移动端体验流畅
- [ ] 文件上传稳定可靠

### 兼容性验收
- [ ] 主流浏览器兼容
- [ ] 移动设备兼容
- [ ] 多语言切换正常

## 🗂️ 核心数据模型预览

### 资源表 (resources)
```sql
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    content TEXT,
    file_url VARCHAR(1000),
    file_type VARCHAR(100),
    file_size BIGINT,
    category_id INTEGER REFERENCES categories(id),
    author_id VARCHAR(255) REFERENCES users(uuid),
    status VARCHAR(50) DEFAULT 'pending',
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_free BOOLEAN DEFAULT TRUE,
    price DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 分类表 (categories)
```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    icon VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 标签表 (tags)
```sql
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📞 后续维护计划

1. **功能迭代**
   - 根据用户反馈优化功能
   - 添加高级搜索功能
   - 实现资源推荐算法

2. **性能优化**
   - 持续监控和优化性能
   - 实现CDN加速
   - 优化数据库查询

3. **内容运营**
   - 建立内容审核规范
   - 制定资源质量标准
   - 用户激励机制

## 📚 相关文档

- [第一阶段实施指南](./implementation-guide-phase1.md)
- [数据模型详细设计](./data-model-design.md)
- [API接口规范](./api-specification.md)
- [组件开发指南](./component-development-guide.md)

---

**注意**: 此计划将根据开发进度和需求变化进行动态调整。所有改动都将保持与现有系统的兼容性，确保不影响当前系统原有功能。
