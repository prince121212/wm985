import { Suspense } from "react";
import TagsCloudDanmakuWrapper from "@/components/blocks/tags-cloud-danmaku-wrapper";
import { createPageMetadata, PAGE_TITLES, PAGE_DESCRIPTIONS } from "@/lib/metadata";

export default async function TagsPage() {

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 - 参考原型图简化设计 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4">标签云</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            通过标签快速找到您感兴趣的资源类型
          </p>
        </div>

        {/* 弹幕标签云 */}
        <Suspense fallback={<TagsCloudSkeleton />}>
          <TagsCloudDanmakuWrapper />
        </Suspense>
      </div>
    </div>
  );
}



function TagsCloudSkeleton() {
  return (
    <div className="w-full h-96 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted-foreground">正在加载弹幕标签云...</p>
      </div>
    </div>
  );
}

export async function generateMetadata() {
  return createPageMetadata({
    title: PAGE_TITLES.TAGS,
    description: PAGE_DESCRIPTIONS.TAGS,
    keywords: "资源标签,标签云,热门标签,资源主题",
    url: `${process.env.NEXT_PUBLIC_WEB_URL || 'https://wm985.com'}/tags`,
    locale: 'zh_CN',
  });
}
