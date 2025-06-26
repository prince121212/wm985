# 文明资源站 (Civilization Resources Platform)

一个现代化的资源分享平台，基于 Next.js 14、TypeScript 和 Tailwind CSS 构建。用户可以上传、下载、收藏和评价各种类型的数字资源。

## ✨ 主要功能

### 🎯 核心功能
- **资源管理** - 上传、下载、分类管理各种数字资源
- **用户系统** - 完整的用户注册、登录、个人中心功能
- **搜索筛选** - 强大的资源搜索和多维度筛选功能
- **评价系统** - 资源评分、评论、收藏功能
- **分类标签** - 灵活的分类体系和标签系统

### 🛠 技术特性
- 🚀 **Next.js 14** - 使用最新的 App Router
- 🎨 **Tailwind CSS** - 现代化的样式系统
- 🔐 **NextAuth.js** - 完整的身份认证系统
- 💾 **SQLite/PostgreSQL** - 灵活的数据库支持
- 📧 **Resend** - 邮件服务集成
- 🌐 **国际化** - 中英文双语支持
- 📱 **响应式设计** - 完美适配移动端
- 🎯 **SEO优化** - 搜索引擎友好
- 🔒 **TypeScript** - 类型安全保障

### 📋 功能模块

#### 用户端功能
- **首页** - 展示热门资源和平台概览
- **资源库** - 浏览、搜索、筛选资源
- **资源详情** - 查看资源详细信息、下载、评价
- **分类页面** - 按分类浏览资源
- **标签页面** - 标签云和标签筛选
- **上传页面** - 上传和发布资源
- **用户中心** - 个人信息、我的上传、我的收藏
- **订单管理** - 付费资源订单管理
- **积分系统** - 用户积分和邀请奖励

#### 管理后台
- **资源管理** - 资源审核、编辑、删除
- **用户管理** - 用户信息管理
- **分类管理** - 分类层级管理
- **标签管理** - 标签创建和管理
- **订单管理** - 付费订单处理
- **内容管理** - 文章和页面管理
- **邮件管理** - 邮件服务配置

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- SQLite (开发环境) 或 PostgreSQL (生产环境)

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd civilization-resources-platform
```

2. **安装依赖**
```bash
npm install
# 或
yarn install
```

3. **环境配置**
```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，配置必要的环境变量：

```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# NextAuth 配置
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# 存储服务配置 (R2/S3)
STORAGE_ENDPOINT="your-storage-endpoint"
STORAGE_ACCESS_KEY="your-access-key"
STORAGE_SECRET_KEY="your-secret-key"
STORAGE_BUCKET="your-bucket-name"

# 邮件服务配置
RESEND_API_KEY="your-resend-api-key"

# 管理员邮箱
ADMIN_EMAILS="admin@example.com"
```

4. **数据库初始化**
```bash
npm run db:push
# 或
yarn db:push
```

5. **启动开发服务器**
```bash
npm run dev
# 或
yarn dev
```

6. **访问应用**
打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📁 项目结构

```
civilization-resources-platform/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # 国际化路由
│   │   ├── (admin)/             # 管理后台
│   │   ├── (auth)/              # 认证页面
│   │   ├── (default)/           # 主要页面
│   │   │   ├── resources/       # 资源相关页面
│   │   │   ├── categories/      # 分类页面
│   │   │   ├── tags/           # 标签页面
│   │   │   ├── upload/         # 上传页面
│   │   │   └── my-*/           # 用户中心页面
│   │   └── api/                # API 路由
│   │       ├── resources/      # 资源 API
│   │       ├── categories/     # 分类 API
│   │       ├── tags/          # 标签 API
│   │       ├── favorites/     # 收藏 API
│   │       └── ratings/       # 评分 API
├── components/                  # React 组件
│   ├── blocks/                 # 业务组件
│   ├── dashboard/              # 后台组件
│   ├── layout/                 # 布局组件
│   └── ui/                     # 基础 UI 组件
├── lib/                        # 工具库
├── models/                     # 数据模型
├── types/                      # TypeScript 类型
├── i18n/                       # 国际化配置
└── docs/                       # 项目文档
```

## 🔧 配置说明

### 数据库配置

项目支持 SQLite（开发环境）和 PostgreSQL（生产环境）：

```env
# SQLite (开发环境)
DATABASE_URL="file:./dev.db"

# PostgreSQL (生产环境)
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
```

### 存储服务配置

支持 Cloudflare R2 或 AWS S3 兼容的存储服务：

```env
STORAGE_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
STORAGE_ACCESS_KEY="your-access-key"
STORAGE_SECRET_KEY="your-secret-key"
STORAGE_BUCKET="your-bucket-name"
```

### 邮件服务配置

使用 Resend 作为邮件服务提供商：

```env
RESEND_API_KEY="re_your_api_key"
```

## 📚 API 文档

### 资源相关 API

#### 获取资源列表
```http
GET /api/resources?category=1&tags=design&search=ui&sort=latest&limit=20&offset=0
```

#### 获取资源详情
```http
GET /api/resources/{uuid}
```

#### 上传资源
```http
POST /api/resources
Content-Type: application/json

{
  "title": "资源标题",
  "description": "资源描述",
  "file_url": "https://example.com/resource",
  "category_id": 1,
  "tags": ["tag1", "tag2"],
  "is_free": true,
  "credits": 0
}
```

### 用户交互 API

#### 收藏资源
```http
POST /api/favorites
Content-Type: application/json

{
  "resource_id": 1
}
```

#### 评分资源
```http
POST /api/ratings
Content-Type: application/json

{
  "resource_id": 1,
  "rating": 5
}
```

详细的 API 文档请参考 [API 文档](docs/api.md)

## 🎨 主题定制

项目使用 Tailwind CSS，支持深度定制：

1. **颜色主题** - 修改 `tailwind.config.js` 中的颜色配置
2. **组件样式** - 在 `components/ui/` 中自定义基础组件
3. **布局样式** - 在 `components/layout/` 中调整布局组件

## 🌐 国际化

项目支持中英文双语：

1. **添加翻译** - 在 `i18n/messages/` 中添加翻译文件
2. **使用翻译** - 使用 `useTranslations()` Hook
3. **语言切换** - 通过 URL 路径切换语言 (`/zh/` 或 `/en/`)

## 📱 移动端适配

- **响应式设计** - 所有页面完美适配移动端
- **触摸友好** - 优化的触摸交互体验
- **移动端导航** - 专门的移动端导航组件
- **性能优化** - 图片懒加载和缓存策略

## 🚀 部署指南

### Vercel 部署（推荐）

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### 自托管部署

1. **构建项目**
```bash
npm run build
```

2. **启动生产服务器**
```bash
npm start
```

3. **使用 PM2 管理进程**
```bash
pm2 start npm --name "resources-platform" -- start
```

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 安全性

- **文件上传安全** - 文件类型和大小验证
- **权限控制** - 基于角色的访问控制
- **输入验证** - 严格的输入参数验证
- **SQL 注入防护** - 使用 Prisma ORM
- **XSS 防护** - 输出转义和 CSP 头

## 🧪 测试

运行测试套件：

```bash
# 单元测试
npm run test

# 端到端测试
npm run test:e2e

# 测试覆盖率
npm run test:coverage
```

## 📈 性能优化

- **图片优化** - Next.js Image 组件和懒加载
- **代码分割** - 自动的路由级代码分割
- **缓存策略** - 多层缓存机制
- **CDN 集成** - 静态资源 CDN 加速

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🆘 支持

如果您遇到问题或需要帮助：

1. 查看 [常见问题](docs/faq.md)
2. 搜索 [Issues](../../issues)
3. 创建新的 Issue
4. 联系维护者

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**文明资源站** - 让资源分享更简单 🚀