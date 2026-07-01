import { Suspense } from "react";
import { notFound } from "next/navigation";
import ResourceDetail from "@/components/blocks/resource-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { createPageMetadata } from "@/lib/metadata";
import { SITE_NAME, absoluteUrl, stripHtml, truncateText } from "@/lib/seo";
import { findResourceByUuid } from "@/models/resource";
import { getResourceTags } from "@/models/tag";

interface ResourcePageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export default async function ResourcePage({ params }: ResourcePageProps) {
  const { id, locale } = await params;
  const resource = await getResourceForSeo(id);

  if (!resource) {
    notFound();
  }

  const resourceUrl = absoluteUrl(`/resources/${id}`, locale);
  const description = truncateText(
    resource.description || resource.content || `${resource.title}的资源详情、访问方式、评分和相关信息。`,
    220
  );
  const keywords = [
    resource.title,
    resource.category?.name,
    ...(resource.tags || []).map((tag) => tag.name),
    "文明知识库",
    "资源下载",
    "学习资料",
  ].filter(Boolean);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: resource.title,
      description,
      url: resourceUrl,
      inLanguage: locale === "en" ? "en" : "zh-CN",
      datePublished: resource.created_at,
      dateModified: resource.updated_at || resource.created_at,
      isAccessibleForFree: resource.is_free,
      keywords: keywords.join(", "),
      genre: resource.category?.name,
      aggregateRating:
        resource.rating_count > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: resource.rating_avg || 0,
              ratingCount: resource.rating_count,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/ViewAction",
          userInteractionCount: resource.view_count || 0,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/DownloadAction",
          userInteractionCount: resource.access_count || 0,
        },
      ],
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: absoluteUrl("/"),
      },
      author: resource.author?.nickname
        ? {
            "@type": "Person",
            name: resource.author.nickname,
          }
        : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "首页",
          item: absoluteUrl("/", locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "资源库",
          item: absoluteUrl("/resources", locale),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: resource.title,
          item: resourceUrl,
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 移除侧边栏，只保留主要内容 */}
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={<ResourceDetailSkeleton />}>
          <ResourceDetail resourceUuid={id} />
        </Suspense>
      </div>
    </div>
  );
}

function ResourceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-14" />
      </div>
      <Skeleton className="h-12 w-32" />
    </div>
  );
}

// 移除相关资源骨架屏组件

export async function generateMetadata({ params }: ResourcePageProps) {
  const { id, locale } = await params;
  const resource = await getResourceForSeo(id);

  if (!resource) {
    return createPageMetadata({
      title: "资源不存在",
      description: "该资源不存在或暂时无法访问。",
      keywords: "资源不存在,文明知识库",
      url: absoluteUrl(`/resources/${id}`, locale),
      locale: locale === "en" ? "en_US" : "zh_CN",
    });
  }

  const description = truncateText(
    resource.description || resource.content || `查看${resource.title}的资源详情、访问方式、评分和相关信息。`,
    160
  );
  const keywords = [
    resource.title,
    resource.category?.name,
    ...(resource.tags || []).map((tag) => tag.name),
    "文明资源",
    "文化资料",
    "学习资料",
    "资源下载",
  ].filter(Boolean);

  return createPageMetadata({
    title: `${resource.title}${resource.category?.name ? `｜${resource.category.name}` : ""}`,
    description,
    keywords: keywords.join(","),
    url: absoluteUrl(`/resources/${id}`, locale),
    locale: locale === "en" ? "en_US" : "zh_CN",
    type: 'article',
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${stripHtml(resource.title)} - ${SITE_NAME}`,
      },
    ],
  });
}

async function getResourceForSeo(id: string) {
  try {
    const resource = await findResourceByUuid(id);
    if (!resource || resource.status !== "approved") {
      return undefined;
    }

    if (resource.id) {
      const tags = await getResourceTags(resource.id);
      resource.tags = tags
        .filter((tag) => tag.id !== undefined)
        .map((tag) => ({
          id: tag.id!,
          name: tag.name,
          color: tag.color,
        }));
    }

    return resource;
  } catch {
    return undefined;
  }
}
