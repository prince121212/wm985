# 文明知识库微信小程序端

这是文明知识库的小程序前端，采用原生微信小程序结构，后端复用当前 Next.js/Vercel 项目的 `/api/mp/*` 接口。

## 功能范围

- 首页：搜索入口、分类、热门标签、热门资源、最新上传，并展示评分、访问量、分类等核心数据。
- 资源库：搜索、分类、标签、排序、分页加载；展示全部已审核资源。
- 资源详情：资源介绍、标签、上传者统计、资源信息、收藏、评价/评论、分享、访问资源。
- 上传资源：智能填充、链接检查、分类、标签、访问方式、提交审核。
- 我的收藏：搜索、排序、评分/访问量/收藏时间展示、取消收藏。
- 我的上传：搜索、状态筛选、排序、审核状态、浏览/访问/评分、拒绝原因、删除资源。
- 我的积分：余额、积分流水、资源关联信息。
- 邀请记录：分享奖励记录和奖励规则。
- 个人资料：展示用户信息并支持修改昵称、头像。
- 意见反馈：提交满意度和反馈内容。
- 每个页面都支持分享。
- 好友通过分享进入小程序后，分享人与好友各得 20 积分。

## 资源访问策略

按钮文案仍为「访问资源」，点击后复制资源原始链接，不使用 WebView，也不直接跳转第三方外链。积分资源会先扣除积分，再复制链接；小程序端不提供积分充值入口。

这样可以兼容网盘、第三方站点、工具站、博客等任意资源链接。

## 后端接口

小程序专用接口位于：

```text
/api/mp/auth/login
/api/mp/user/me
/api/mp/user/profile
/api/mp/user/avatar
/api/mp/share/record
/api/mp/feedback
/api/mp/categories
/api/mp/tags
/api/mp/resources
/api/mp/resources/[id]
/api/mp/resources/[id]/access
/api/mp/resources/[id]/favorite
/api/mp/resources/[id]/rating
/api/mp/resources/[id]/comments
/api/mp/my/favorites
/api/mp/my/uploads
/api/mp/my/credits
/api/mp/my/invites
```

## 环境变量

后端需要配置：

```text
WECHAT_MP_APPID=
WECHAT_MP_SECRET=
MP_TOKEN_SECRET=
```

`MP_TOKEN_SECRET` 可省略，默认复用 `AUTH_SECRET`。

开发环境未配置微信 AppID/Secret 时，后端会使用 `dev_${code}` 生成临时 openid，方便本地联调。

## 本地开发

1. 启动网站后端：

```bash
npm run dev
```

默认端口是 `3001`。

2. 按需修改：

```text
miniprogram/config.js
```

如果真机预览，需要把 `API_BASE_URL` 改成本机局域网地址，例如：

```text
http://192.168.1.10:3001
```

3. 用微信开发者工具打开：

```text
/Users/huangchangwei/Desktop/gitSpaceC/wm985/miniprogram
```

## 数据库迁移

初始化脚本已加入表：

```text
mp_share_rewards
```

用于分享奖励去重。同一个分享人和同一个好友之间只奖励一次。
