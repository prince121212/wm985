import { Metadata } from "next";
import {
  SITE_NAME,
  absoluteUrl,
  createSeoTitle,
  getSiteUrl,
} from "@/lib/seo";

/**
 * 创建页面标题
 * @param pageTitle 页面标题，如果为空则只显示"文明"
 * @returns 格式化的标题
 */
export const createPageTitle = (pageTitle?: string): string => {
  return pageTitle ? `${pageTitle} - ${SITE_NAME}` : createSeoTitle();
};

/**
 * 创建页面元数据的配置选项
 */
export interface PageMetadataOptions {
  title?: string;
  description: string;
  keywords?: string;
  url?: string;
  locale?: string;
  type?: 'website' | 'article';
  images?: {
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  }[];
}

/**
 * 创建统一的页面元数据
 * @param options 元数据配置选项
 * @returns Next.js Metadata 对象
 */
export const createPageMetadata = (options: PageMetadataOptions): Metadata => {
  const {
    title,
    description,
    keywords,
    url,
    locale = 'zh_CN',
    type = 'website',
    images = [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - 优质资源分享平台`,
      },
    ],
  } = options;

  const formattedTitle = createPageTitle(title);
  const metadataBase = new URL(getSiteUrl());
  const canonicalUrl = url || absoluteUrl("/");

  return {
    metadataBase,
    title: formattedTitle,
    description,
    keywords,
    openGraph: {
      title: formattedTitle,
      description,
      type,
      locale,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: formattedTitle,
      description,
      images: images.map(img => img.url),
    },
    ...(url && {
      alternates: {
        canonical: canonicalUrl,
      },
    }),
  };
};

/**
 * 创建多语言页面的元数据
 * @param options 基础元数据选项
 * @param baseUrl 基础URL
 * @param locale 当前语言
 * @returns 包含多语言链接的元数据
 */
export const createMultilingualMetadata = (
  options: PageMetadataOptions,
  baseUrl: string,
  locale: string
): Metadata => {
  const metadata = createPageMetadata(options);
  
  // 构建多语言链接
  const languages: Record<string, string> = {};
  
  if (locale === 'zh') {
    languages['zh-CN'] = `${baseUrl}/zh${options.url || ''}`;
    languages['en-US'] = `${baseUrl}/en${options.url || ''}`;
  } else {
    languages['en-US'] = `${baseUrl}${options.url || ''}`;
    languages['zh-CN'] = `${baseUrl}/zh${options.url || ''}`;
  }

  return {
    ...metadata,
    alternates: {
      canonical: options.url || absoluteUrl("/"),
      languages,
    },
  };
};

/**
 * 为搜索结果页面创建动态标题
 * @param searchTerm 搜索词
 * @param resultCount 结果数量
 * @returns 搜索结果页面标题
 */
export const createSearchTitle = (searchTerm: string, resultCount?: number): string => {
  const countText = resultCount !== undefined ? ` (${resultCount}条结果)` : '';
  return `"${searchTerm}"搜索结果${countText}`;
};

/**
 * 为分类页面创建标题
 * @param categoryName 分类名称
 * @param resourceCount 资源数量
 * @returns 分类页面标题
 */
export const createCategoryTitle = (categoryName: string, resourceCount?: number): string => {
  const countText = resourceCount !== undefined ? ` (${resourceCount}个资源)` : '';
  return `${categoryName}分类${countText}`;
};

/**
 * 为标签页面创建标题
 * @param tags 标签数组
 * @param resourceCount 资源数量
 * @returns 标签页面标题
 */
export const createTagsTitle = (tags: string[], resourceCount?: number): string => {
  const tagList = tags.slice(0, 3).join('、');
  const countText = resourceCount !== undefined ? ` (${resourceCount}个资源)` : '';
  return `${tagList}标签${countText}`;
};

/**
 * 常用页面标题常量
 */
export const PAGE_TITLES = {
  HOME: '',
  RESOURCES: '资源库',
  CATEGORIES: '资源分类',
  TAGS: '资源标签',
  UPLOAD: '上传资源',
  USER_CENTER: '用户中心',
  MY_FAVORITES: '我的收藏',
  MY_UPLOADS: '我的上传',
  ADMIN: '管理后台',
} as const;

/**
 * 常用页面描述常量
 */
export const PAGE_DESCRIPTIONS = {
  HOME: '文明知识库是一个开放的文明资源共享平台，聚合历史、文化、文明史、纪录片、电子书、课件和文档资料，帮助学习者、教师和创作者高效发现优质资源。',
  RESOURCES: '发现和访问各类优质文明资源，包括历史文化资料、纪录片、电子书、课程课件、文档模板、音频视频素材等。',
  CATEGORIES: '按分类浏览文明知识库资源，快速查找历史、文化、文明史、课程资料、纪录片和文档模板等内容。',
  TAGS: '通过标签快速找到相关文明资源，浏览热门主题、学习资料、纪录片、电子书和文化研究内容。',
  UPLOAD: '上传和分享您的优质资源，帮助更多人获得价值',
  USER_CENTER: '管理您的个人信息、上传资源、收藏内容等',
  MY_FAVORITES: '管理您收藏的资源，快速访问感兴趣的内容',
  MY_UPLOADS: '管理您上传的资源，查看审核状态和访问统计',
} as const;
