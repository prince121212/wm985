# 文明资源站完整改造计划

## 📋 项目概况

当前项目是一个基于 Next.js 15 的 AI SaaS 模板项目（ShipAny），需要改造为文明资源站。项目使用现代技术栈：

### 🛠️ 技术栈详情

#### 前端技术栈
- **框架**: Next.js 15 (App Router) + React 19
- **语言**: TypeScript 5.7.2 (严格模式)
- **样式**: Tailwind CSS 3.4.17 + Shadcn UI (默认主题)
  - 基于 CSS 变量的主题系统
  - 支持明暗主题切换 (next-themes)
  - 响应式设计 (移动端优先)
- **状态管理**: React Context + useSession (NextAuth)
- **UI组件库**:
  - Radix UI (无障碍组件基础)
  - Shadcn UI (预构建组件)
  - Lucide React Icons (图标库)
  - React Icons (补充图标)
- **通知系统**: Sonner Toast (优雅的通知组件)
- **国际化**: next-intl (支持中英文切换)
- **表单处理**: React Hook Form + Zod 验证
- **工具函数**:
  - clsx + tailwind-merge (样式合并)
  - class-variance-authority (组件变体)

#### 后端技术栈
- **API架构**: Next.js API Routes (RESTful)
- **数据库**:
  - Supabase (PostgreSQL 云服务)
  - 连接池管理 + 重试机制
  - 数据库健康检查
- **认证系统**: NextAuth.js 5.0
  - 邮箱密码登录 (bcrypt 加密)
  - Google OAuth 2.0
  - GitHub OAuth (可选)
  - Google One Tap (可选)
  - 邮箱验证码系统
  - 管理员权限控制
- **文件存储**: Cloudflare R2 (兼容 AWS S3 SDK)
- **支付系统**: Stripe 集成
  - 信用卡支付
  - 微信支付、支付宝 (国际版)
  - 订阅管理
  - Webhook 处理
- **邮件服务**: Nodemailer (SMTP)
- **日志系统**: 自定义 logger (结构化日志)
- **缓存**: localStorage (客户端缓存)

#### AI集成能力
- **AI SDK**: Vercel AI SDK
- **支持模型**:
  - OpenAI (GPT系列)
  - DeepSeek (国产大模型)
  - Replicate (开源模型)
  - Kling (视频生成)
  - OpenRouter (模型聚合)
- **功能**: 文本生成、图像生成、流式响应

#### 部署和监控
- **主要部署**: Vercel (Serverless)
- **备用部署**: Cloudflare Pages
- **CI/CD**: GitHub Actions (自动部署)
- **监控**:
  - UptimeRobot (外部监控)
  - 自定义保活端点 (/api/ping)
  - 健康检查端点 (/api/health)
- **构建**:
  - Docker 支持
  - 独立输出模式 (standalone)
  - Bundle 分析器

### �️ 项目架构分析

#### 项目架构详情

##### 目录结构
```
wm985/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # 国际化路由 (支持中英文)
│   │   ├── (default)/           # 默认布局页面
│   │   │   ├── (console)/       # 用户控制台 (需登录)
│   │   │   ├── auth/            # 认证页面
│   │   │   └── page.tsx         # 首页
│   │   └── (admin)/             # 管理后台页面 (需管理员权限)
│   ├── api/                     # API 路由
│   │   ├── auth/                # NextAuth 端点
│   │   ├── checkout/            # Stripe 支付
│   │   ├── demo/                # AI 演示接口
│   │   ├── health/              # 健康检查
│   │   ├── ping/                # 保活端点
│   │   └── check-admin/         # 管理员权限检查
│   ├── globals.css              # 全局样式
│   └── theme.css                # 主题变量定义
├── components/                   # React 组件
│   ├── ui/                      # Shadcn UI 基础组件
│   ├── blocks/                  # 页面布局块组件
│   ├── dashboard/               # 管理后台组件
│   ├── console/                 # 用户控制台组件
│   ├── sign/                    # 登录注册组件
│   ├── theme/                   # 主题切换组件
│   └── locale/                  # 语言切换组件
├── models/                      # 数据模型层
│   ├── db.ts                    # 数据库连接 + 重试机制
│   ├── user.ts                  # 用户模型
│   ├── order.ts                 # 订单模型
│   └── email-verification.ts   # 邮箱验证模型
├── services/                    # 业务逻辑层
│   ├── user.ts                  # 用户服务
│   ├── order.ts                 # 订单服务
│   ├── credit.ts                # 积分服务
│   ├── email.ts                 # 邮件服务
│   └── page.ts                  # 页面数据服务
├── lib/                         # 工具函数库
│   ├── utils.ts                 # 通用工具函数
│   ├── logger.ts                # 日志系统
│   ├── resp.ts                  # API 响应格式
│   ├── storage.ts               # 文件存储
│   ├── email-validator.ts       # 邮箱验证
│   └── constants.ts             # 应用常量
├── types/                       # TypeScript 类型定义
│   ├── user.d.ts                # 用户类型
│   ├── order.d.ts               # 订单类型
│   └── next-auth.d.ts           # NextAuth 类型扩展
├── i18n/                        # 国际化配置
│   ├── messages/                # 翻译文件
│   ├── pages/                   # 页面配置文件
│   ├── locale.ts                # 语言配置
│   └── routing.ts               # 路由配置
├── auth/                        # NextAuth 配置
│   ├── config.ts                # 认证配置
│   ├── index.ts                 # 认证入口
│   └── session.tsx              # 会话提供者
├── data/                        # 数据库脚本
│   └── install.sql              # 数据库初始化脚本
├── prototypes/                  # 原型图文件
└── docs/                        # 项目文档
```

##### 数据库结构
- **users**: 用户表 (支持邮箱/OAuth登录)
- **orders**: 订单表 (Stripe支付集成)
- **credits**: 积分表 (交易记录)
- **apikeys**: API密钥表
- **posts**: 文章表 (博客功能)
- **affiliates**: 推荐表 (分销系统)
- **feedbacks**: 反馈表
- **email_verifications**: 邮箱验证码表

##### 现有功能模块
1. **用户系统**:
   - 邮箱密码注册/登录 (bcrypt加密)
   - Google OAuth 登录
   - 邮箱验证码系统
   - 个人资料管理
   - 头像上传 (Cloudflare R2)
2. **支付系统**:
   - Stripe 集成 (信用卡、微信、支付宝)
   - 订单管理
   - 积分充值系统
   - Webhook 处理
3. **管理后台**:
   - 用户管理 (分页查询)
   - 订单管理 (支付状态)
   - 邮件服务管理
   - 反馈管理
4. **AI功能**:
   - 文本生成 (多模型支持)
   - 图像生成 (演示用)
   - 流式响应
5. **邀请系统**:
   - 推荐码生成
   - 分销奖励
   - 邀请统计
6. **国际化**:
   - 中英文切换
   - 动态路由
   - 页面配置文件
7. **主题系统**:
   - 明暗主题切换
   - CSS变量系统
   - 响应式设计

## �🎯 改造目标

将 ShipAny AI SaaS 模板改造为文明资源站，参考原型图功能但保持当前系统样式主题，争取用最小的改动完成改造计划。

## 🔄 实施原则

### 保留现有功能 (最大化复用)
- ✅ **用户认证系统**
  - 邮箱密码登录 (bcrypt加密)
  - Google OAuth 2.0
  - 邮箱验证码系统
  - 管理员权限控制
- ✅ **用户中心基础功能**
  - 个人资料管理
  - 积分系统 (可用于资源下载)
  - 订单管理
  - 邀请推荐系统
  - API密钥管理
- ✅ **支付系统** (用于付费资源)
  - Stripe 集成
  - 多种支付方式
  - 订单状态管理
  - Webhook 处理
- ✅ **管理后台框架**
  - 用户管理
  - 内容审核 (适用于资源审核)
  - 邮件服务管理
  - 反馈管理
- ✅ **技术基础设施**
  - 国际化支持 (中英文切换)
  - 主题切换 (明暗主题)
  - 响应式设计 (移动端适配)
  - Shadcn UI 组件库
  - 文件存储系统 (Cloudflare R2)
  - 邮件通知系统
  - 日志和监控系统
  - 数据库连接池 + 重试机制

### 新增功能模块 (基于现有架构)

#### 1. 资源管理系统
- **资源上传**:
  - 复用现有文件存储系统 (Cloudflare R2)
  - 支持多种文件类型 (文档、图片、视频、音频)
  - 文件大小限制和类型验证
  - 上传进度显示
- **资源分类**:
  - 多级分类体系 (树形结构)
  - 标签系统 (多对多关系)
  - 分类图标和描述
- **资源详情**:
  - 详细描述 (支持Markdown)
  - 文件预览 (图片、文档)
  - 下载统计和评分显示
  - 相关资源推荐
- **资源审核**:
  - 复用现有管理后台框架
  - 状态管理 (待审核、已发布、已拒绝)
  - 审核日志记录
- **资源搜索**:
  - 全文搜索 (标题、描述、标签)
  - 高级筛选 (分类、类型、评分)
  - 搜索历史记录

#### 2. 用户交互功能
- **资源评分**:
  - 5星评分系统
  - 评分统计和平均分计算
  - 防止重复评分
- **资源收藏**:
  - 个人收藏夹管理
  - 收藏分类整理
  - 收藏数量统计
- **下载历史**:
  - 用户下载记录
  - 下载时间和次数统计
  - 下载权限控制 (积分消耗)
- **资源推荐**:
  - 基于用户行为的推荐
  - 热门资源推荐
  - 相似资源推荐

#### 3. 内容展示页面
- **首页**:
  - 复用现有首页布局
  - 精选资源轮播
  - 分类导航卡片
  - 统计概览 (总资源数、用户数等)
- **资源库**:
  - 资源列表展示 (卡片/列表视图)
  - 多维度筛选 (分类、标签、类型、评分)
  - 排序功能 (时间、下载量、评分)
  - 分页加载
- **资源详情**:
  - 详细信息展示
  - 下载按钮 (积分验证)
  - 评分和评论区域
  - 相关推荐列表
- **分类页面**:
  - 分类树形展示
  - 子分类快速导航
  - 分类资源统计
- **标签页面**:
  - 标签云展示
  - 标签热度显示
  - 标签筛选功能

### 技术实现策略

#### 数据库扩展 (基于现有Supabase)
在现有数据库基础上新增表：
```sql
-- 资源分类表
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    icon VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 资源主表
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
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

-- 标签表
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 资源标签关联表
CREATE TABLE resource_tags (
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, tag_id)
);

-- 用户收藏表
CREATE TABLE user_favorites (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) REFERENCES users(uuid),
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_uuid, resource_id)
);

-- 资源评分表
CREATE TABLE resource_ratings (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) REFERENCES users(uuid),
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_uuid, resource_id)
);

-- 下载历史表
CREATE TABLE download_history (
    id SERIAL PRIMARY KEY,
    user_uuid VARCHAR(255) REFERENCES users(uuid),
    resource_id INTEGER REFERENCES resources(id),
    credits_cost INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### API 路由扩展 (基于现有架构)
在现有 API 基础上新增：
- `/api/resources/*`: 资源CRUD、搜索、统计
- `/api/categories/*`: 分类管理、树形结构
- `/api/tags/*`: 标签管理、热度统计
- `/api/favorites/*`: 收藏管理
- `/api/ratings/*`: 评分管理
- `/api/download/*`: 下载管理、权限验证

#### 组件复用策略
- **UI组件**: 复用所有 Shadcn UI 组件
- **布局组件**: 复用 Header、Footer、Sidebar
- **认证逻辑**: 复用用户登录、权限验证
- **文件处理**: 复用上传、存储、预览逻辑
- **支付逻辑**: 复用积分系统、订单管理
- **管理后台**: 扩展现有管理界面
- **国际化**: 扩展现有翻译文件
- **主题系统**: 保持一致的视觉风格

### 设计原则
- 保持当前系统的设计风格和主题（CSS变量、配色方案）
- 使用现有的 Shadcn UI 组件（Button、Card、Dialog等）
- 保持响应式设计（Tailwind 断点系统）
- 遵循现有的代码规范和架构（TypeScript、ESLint）
- 最大化复用现有组件和样式
- 保持 API 设计一致性（RESTful、错误处理）
- 遵循现有的安全实践（权限验证、数据验证）

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
基于现有系统架构，创建 `models/resource.ts`：
```typescript
// 复用现有的数据库连接和重试机制
import { getSupabaseClient, withRetry } from "./db";
import { log } from "@/lib/logger";

export interface Resource {
  id?: number;
  uuid: string;
  title: string;
  description: string;
  content?: string;
  file_url?: string;
  file_type: string;
  file_size?: number;
  category_id: number;
  author_id: string; // 关联 users.uuid
  status: 'pending' | 'approved' | 'rejected';
  rating_avg: number;
  rating_count: number;
  view_count: number;
  download_count: number;
  is_featured: boolean;
  is_free: boolean;
  price?: number;
  created_at?: string;
  updated_at?: string;
}

// 复用现有的错误处理和日志模式
export async function insertResource(resource: Resource) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("resources").insert(resource);

    if (error) {
      log.error("插入资源失败", error, { resource: resource.title });
      throw error;
    }

    log.info("资源创建成功", { resourceId: resource.uuid, title: resource.title });
    return data;
  });
}

export async function findResourceByUuid(uuid: string): Promise<Resource | undefined> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("uuid", uuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      throw error;
    }

    return data;
  });
}
```

#### 2.2 分类和标签模型
基于现有架构模式创建：

**`models/category.ts`** - 分类数据模型
```typescript
import { getSupabaseClient, withRetry } from "./db";

export interface Category {
  id?: number;
  name: string;
  description?: string;
  parent_id?: number;
  icon?: string;
  sort_order: number;
  created_at?: string;
}

// 获取分类树形结构
export async function getCategoriesTree(): Promise<Category[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return buildCategoryTree(data || []);
  });
}
```

**`models/tag.ts`** - 标签数据模型
```typescript
export interface Tag {
  id?: number;
  name: string;
  color?: string;
  usage_count: number;
  created_at?: string;
}

// 获取热门标签
export async function getPopularTags(limit: number = 20): Promise<Tag[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("usage_count", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  });
}
```

#### 2.3 用户交互模型
复用现有用户系统架构：

**`models/rating.ts`** - 评分数据模型
```typescript
export interface ResourceRating {
  id?: number;
  user_uuid: string;
  resource_id: number;
  rating: number; // 1-5
  created_at?: string;
}

// 复用现有的用户验证逻辑
export async function addResourceRating(rating: ResourceRating) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    // 使用 upsert 防止重复评分
    const { data, error } = await supabase
      .from("resource_ratings")
      .upsert(rating, { onConflict: 'user_uuid,resource_id' });

    if (error) throw error;

    // 更新资源平均评分
    await updateResourceRatingStats(rating.resource_id);
    return data;
  });
}
```

**`models/favorite.ts`** - 收藏数据模型
```typescript
export interface UserFavorite {
  id?: number;
  user_uuid: string;
  resource_id: number;
  created_at?: string;
}

// 切换收藏状态
export async function toggleFavorite(user_uuid: string, resource_id: number) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 检查是否已收藏
    const { data: existing } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_uuid", user_uuid)
      .eq("resource_id", resource_id)
      .single();

    if (existing) {
      // 取消收藏
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_uuid", user_uuid)
        .eq("resource_id", resource_id);

      if (error) throw error;
      return { action: 'removed' };
    } else {
      // 添加收藏
      const { error } = await supabase
        .from("user_favorites")
        .insert({ user_uuid, resource_id });

      if (error) throw error;
      return { action: 'added' };
    }
  });
}
```

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
基于现有首页结构 (`app/[locale]/(default)/page.tsx`)，调整内容：

**保留现有组件结构**：
```typescript
// 复用现有的页面组件架构
import Hero from "@/components/blocks/hero";
import Feature from "@/components/blocks/feature";
import Stats from "@/components/blocks/stats";
import CTA from "@/components/blocks/cta";

// 新增资源相关组件
import ResourceCategories from "@/components/blocks/resource-categories";
import FeaturedResources from "@/components/blocks/featured-resources";
import LatestResources from "@/components/blocks/latest-resources";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const page = await getLandingPage(locale);

  return (
    <>
      {/* 保留现有 Hero，调整文案 */}
      {page.hero && <Hero hero={page.hero} />}

      {/* 新增：资源分类导航 */}
      <ResourceCategories />

      {/* 新增：精选资源展示 */}
      <FeaturedResources />

      {/* 新增：最新资源 */}
      <LatestResources />

      {/* 保留现有统计和CTA */}
      {page.stats && <Stats section={page.stats} />}
      {page.cta && <CTA section={page.cta} />}
    </>
  );
}
```

**更新国际化文件**：
- 修改 `i18n/pages/landing/zh.json` 中的 hero 文案
- 将 "Ship Any AI Startups" 改为 "文明资源共享平台"
- 调整描述为资源站相关内容

#### 3.2 资源列表页面
创建 `app/[locale]/(default)/resources/page.tsx`，复用现有架构：

```typescript
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import ResourceList from "@/components/blocks/resource-list";
import ResourceFilter from "@/components/blocks/resource-filter";
import { Skeleton } from "@/components/ui/skeleton";

// 复用现有的页面布局模式
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    tags?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const t = await getTranslations();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{t("resources.title")}</h1>
        <p className="text-muted-foreground">{t("resources.description")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* 筛选侧边栏 */}
        <div className="lg:col-span-1">
          <ResourceFilter />
        </div>

        {/* 资源列表 */}
        <div className="lg:col-span-3">
          <Suspense fallback={<ResourceListSkeleton />}>
            <ResourceList searchParams={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// 复用现有的 Skeleton 组件模式
function ResourceListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}
```

**功能特性**：
- 实现资源列表展示 (卡片/列表视图切换)
- 添加筛选功能 (分类、标签、评分、文件类型)
- 添加搜索功能 (全文搜索)
- 添加排序功能 (最新、最热、评分、下载量)
- 实现分页功能 (复用现有分页组件)
- 响应式设计 (移动端适配)

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
基于现有API架构模式，创建资源管理接口：

**`app/api/resources/route.ts`** - 资源列表和创建
```typescript
import { respData, respErr } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { log } from "@/lib/logger";

// GET /api/resources - 获取资源列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tags = searchParams.get('tags');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'created_at';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 复用现有的分页逻辑
    const offset = (page - 1) * limit;

    const resources = await getResourcesList({
      category,
      tags: tags?.split(','),
      search,
      sort,
      offset,
      limit
    });

    log.info("资源列表查询成功", {
      category, tags, search, sort, page,
      count: resources.length
    });

    return respData({
      resources,
      pagination: {
        page,
        limit,
        hasMore: resources.length === limit
      }
    });
  } catch (error) {
    log.error("获取资源列表失败", error as Error);
    return respErr("获取资源列表失败");
  }
}

// POST /api/resources - 创建资源
export async function POST(request: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respErr("用户未登录", 401);
    }

    const body = await request.json();
    const resource = await createResource({
      ...body,
      author_id: user_uuid
    });

    log.info("资源创建成功", {
      resourceId: resource.uuid,
      author: user_uuid
    });

    return respData(resource);
  } catch (error) {
    log.error("创建资源失败", error as Error);
    return respErr("创建资源失败");
  }
}
```

**`app/api/resources/[id]/route.ts`** - 资源详情和操作
```typescript
// GET /api/resources/[id] - 获取资源详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const resource = await findResourceByUuid(id);

    if (!resource) {
      return respErr("资源不存在", 404);
    }

    // 增加浏览量
    await incrementResourceViews(id);

    return respData(resource);
  } catch (error) {
    log.error("获取资源详情失败", error as Error);
    return respErr("获取资源详情失败");
  }
}

// PUT /api/resources/[id] - 更新资源
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respErr("用户未登录", 401);
    }

    const { id } = await params;
    const body = await request.json();

    // 验证权限：只有作者或管理员可以编辑
    const resource = await findResourceByUuid(id);
    if (!resource) {
      return respErr("资源不存在", 404);
    }

    const isAdmin = await isUserAdmin();
    if (resource.author_id !== user_uuid && !isAdmin) {
      return respErr("无权限编辑此资源", 403);
    }

    const updatedResource = await updateResource(id, body);
    return respData(updatedResource);
  } catch (error) {
    log.error("更新资源失败", error as Error);
    return respErr("更新资源失败");
  }
}
```

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
开发 `components/blocks/resource-card.tsx`，基于现有组件架构：

```typescript
"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Download, Eye, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Resource } from "@/types/resource";

interface ResourceCardProps {
  resource: Resource;
  variant?: "default" | "compact";
  showAuthor?: boolean;
  className?: string;
}

export default function ResourceCard({
  resource,
  variant = "default",
  showAuthor = true,
  className
}: ResourceCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFavorite = async () => {
    setIsLoading(true);
    try {
      // 调用收藏API
      const response = await fetch(`/api/resources/${resource.uuid}/favorite`, {
        method: 'POST',
      });

      if (response.ok) {
        setIsFavorited(!isFavorited);
        toast.success(isFavorited ? "已取消收藏" : "已添加收藏");
      }
    } catch (error) {
      toast.error("操作失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn("group hover:shadow-lg transition-shadow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {resource.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {resource.description}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavorite}
            disabled={isLoading}
            className="ml-2 shrink-0"
          >
            <Heart
              className={cn(
                "h-4 w-4",
                isFavorited && "fill-red-500 text-red-500"
              )}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* 标签 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {resource.tags?.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {resource.tags?.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{resource.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{resource.rating_avg.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{resource.download_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{resource.view_count}</span>
          </div>
        </div>
      </CardContent>

      {showAuthor && (
        <CardFooter className="pt-3 border-t">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={resource.author?.avatar_url} />
              <AvatarFallback className="text-xs">
                {resource.author?.nickname?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {resource.author?.nickname}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(resource.created_at))}
            </span>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
```

**特性**：
- 复用现有 Shadcn UI 组件 (Card, Badge, Button等)
- 响应式设计 (Tailwind 断点)
- 交互状态管理 (收藏、加载状态)
- 无障碍支持 (键盘导航、屏幕阅读器)
- 主题适配 (明暗主题)

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
基于现有管理后台架构 (`app/[locale]/(admin)/`) 扩展功能：

**更新管理后台导航** (`app/[locale]/(admin)/layout.tsx`)：
```typescript
const sidebar: Sidebar = {
  brand: {
    title: "文明资源站",
    logo: { src: "/logo.png", alt: "文明资源站" },
    url: "/admin",
  },
  nav: {
    items: [
      // 保留现有菜单
      { title: "Users", url: "/admin/users", icon: "RiUserLine" },
      { title: "Orders", url: "/admin/paid-orders", icon: "RiOrderPlayLine" },

      // 新增资源管理菜单
      {
        title: "资源管理",
        icon: "RiFileList3Line",
        is_expand: true,
        children: [
          { title: "资源列表", url: "/admin/resources" },
          { title: "待审核资源", url: "/admin/resources/pending" },
          { title: "分类管理", url: "/admin/categories" },
          { title: "标签管理", url: "/admin/tags" },
        ],
      },

      // 保留现有菜单
      { title: "Posts", url: "/admin/posts", icon: "RiArticleLine" },
      { title: "Feedbacks", url: "/admin/feedbacks", icon: "RiMessage2Line" },
      { title: "邮件服务管理", url: "/admin/email", icon: "RiMailLine" },
    ],
  },
  // 保留现有社交链接
  social: { /* ... */ },
};
```

**创建资源管理页面** (`app/[locale]/(admin)/admin/resources/page.tsx`)：
```typescript
import { getUserUuid, getUserEmail, isUserAdmin } from "@/services/user";
import { redirect } from "next/navigation";
import Header from "@/components/dashboard/header";
import ResourceManagementTable from "@/components/dashboard/resource-management-table";

export default async function AdminResourcesPage() {
  const user_uuid = await getUserUuid();
  const user_email = await getUserEmail();

  // 复用现有的权限验证逻辑
  if (!user_uuid) {
    redirect("/auth/signin?callbackUrl=/admin/resources");
  }

  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  const crumb = {
    items: [
      { title: "Admin", url: "/admin" },
      { title: "资源管理", is_active: true }
    ]
  };

  return (
    <>
      <Header crumb={crumb} />
      <div className="w-full px-4 md:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium">资源管理</h1>
            <p className="text-sm text-muted-foreground">
              管理用户上传的资源，进行审核和分类
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/resources/pending">
                待审核资源
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/categories">
                分类管理
              </Link>
            </Button>
          </div>
        </div>

        <ResourceManagementTable />
      </div>
    </>
  );
}
```

**资源管理表格组件** (`components/dashboard/resource-management-table.tsx`)：
```typescript
"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function ResourceManagementTable() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await fetch('/api/admin/resources');
      const data = await response.json();
      if (data.code === 0) {
        setResources(data.data);
      }
    } catch (error) {
      toast.error("获取资源列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/admin/resources/${resourceId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success("资源已审核通过");
        fetchResources();
      }
    } catch (error) {
      toast.error("审核失败");
    }
  };

  const handleReject = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/admin/resources/${resourceId}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success("资源已拒绝");
        fetchResources();
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">待审核</Badge>;
      case 'approved':
        return <Badge variant="default">已发布</Badge>;
      case 'rejected':
        return <Badge variant="destructive">已拒绝</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>资源标题</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>作者</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>上传时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource: any) => (
            <TableRow key={resource.uuid}>
              <TableCell>
                <div>
                  <div className="font-medium">{resource.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {resource.description}
                  </div>
                </div>
              </TableCell>
              <TableCell>{resource.category?.name}</TableCell>
              <TableCell>{resource.author?.nickname}</TableCell>
              <TableCell>{getStatusBadge(resource.status)}</TableCell>
              <TableCell>
                {new Date(resource.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="h-4 w-4 mr-2" />
                      查看详情
                    </DropdownMenuItem>
                    {resource.status === 'pending' && (
                      <>
                        <DropdownMenuItem onClick={() => handleApprove(resource.uuid)}>
                          <Check className="h-4 w-4 mr-2" />
                          审核通过
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleReject(resource.uuid)}>
                          <X className="h-4 w-4 mr-2" />
                          拒绝
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**特性**：
- 复用现有管理后台架构和权限验证
- 保持一致的UI设计风格
- 实现资源审核工作流
- 支持批量操作
- 实时状态更新

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

## � 技术实现关键点

### 架构复用策略
1. **数据库层面**
   - 复用现有 Supabase 连接和配置
   - 使用现有的 `withRetry` 重试机制
   - 保持现有的错误处理模式
   - 复用现有的日志记录系统

2. **API层面**
   - 遵循现有的 RESTful API 设计模式
   - 复用 `respData/respErr` 响应格式
   - 使用现有的用户认证和权限验证
   - 保持现有的错误码体系

3. **组件层面**
   - 100% 复用 Shadcn UI 组件库
   - 保持现有的主题系统和CSS变量
   - 复用现有的布局组件 (Header, Footer, Sidebar)
   - 使用现有的国际化系统

4. **业务逻辑层面**
   - 复用现有的用户管理逻辑
   - 扩展现有的文件存储系统
   - 复用现有的支付和积分系统
   - 保持现有的邮件通知机制

### 性能优化考虑
1. **数据库优化**
   - 为新表添加适当的索引
   - 使用现有的连接池管理
   - 实现查询缓存策略
   - 优化复杂查询性能

2. **前端优化**
   - 使用 React Suspense 和 Skeleton 加载
   - 实现图片懒加载
   - 优化组件渲染性能
   - 使用现有的缓存策略

3. **文件处理优化**
   - 复用现有的 Cloudflare R2 配置
   - 实现文件压缩和优化
   - 添加文件类型和大小验证
   - 优化上传进度显示

### 安全性考虑
1. **权限控制**
   - 复用现有的用户认证系统
   - 实现细粒度的资源权限控制
   - 添加管理员审核机制
   - 防止恶意文件上传

2. **数据验证**
   - 使用现有的 Zod 验证库
   - 实现前后端双重验证
   - 防止 SQL 注入和 XSS 攻击
   - 添加文件安全扫描

3. **API安全**
   - 复用现有的认证中间件
   - 实现请求频率限制
   - 添加敏感操作日志记录
   - 保护管理员接口

### 可维护性设计
1. **代码组织**
   - 保持现有的目录结构
   - 遵循现有的命名规范
   - 使用 TypeScript 严格模式
   - 添加完整的类型定义

2. **测试策略**
   - 为新功能添加单元测试
   - 实现API接口测试
   - 添加组件测试
   - 保持现有的测试覆盖率

3. **文档维护**
   - 更新API文档
   - 添加组件使用说明
   - 维护数据库文档
   - 记录配置变更

## �📚 相关文档

- [第一阶段实施指南](./implementation-guide-phase1.md)
- [数据模型详细设计](./data-model-design.md)
- [API接口规范](./api-specification.md)
- [组件开发指南](./component-development-guide.md)
- [部署和运维指南](./deployment-guide.md)
- [测试策略文档](./testing-strategy.md)

## 🎯 成功标准

### 技术指标
- [ ] 页面加载时间 < 3秒
- [ ] API 响应时间 < 500ms
- [ ] 文件上传成功率 > 99%
- [ ] 移动端性能评分 > 90
- [ ] 代码测试覆盖率 > 80%

### 功能指标
- [ ] 资源上传流程完整可用
- [ ] 搜索和筛选功能正常
- [ ] 用户交互功能稳定
- [ ] 管理后台功能完善
- [ ] 多语言支持正常

### 用户体验指标
- [ ] 界面风格与现有系统一致
- [ ] 响应式设计适配良好
- [ ] 无障碍功能支持完整
- [ ] 错误处理友好
- [ ] 加载状态反馈及时

---

**注意**: 此计划基于对当前系统深入的技术分析制定，将最大化复用现有架构和组件，确保改造过程中系统的稳定性和一致性。所有新功能都将遵循现有的技术规范和最佳实践。
