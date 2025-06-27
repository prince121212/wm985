import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import TagsCloudWrapper from "@/components/blocks/tags-cloud-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function TagsPage() {
  const t = await getTranslations();

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

        {/* 标签云 - 只保留标签云部分 */}
        <Suspense fallback={<TagsCloudSkeleton />}>
          <TagsCloudWrapper />
        </Suspense>
      </div>
    </div>
  );
}

function TagsCloudSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>热门标签</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className={`h-8 rounded-full ${
                i % 4 === 0 ? 'w-20' : 
                i % 4 === 1 ? 'w-16' : 
                i % 4 === 2 ? 'w-24' : 'w-12'
              }`} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export async function generateMetadata() {
  const t = await getTranslations();

  return {
    title: "资源标签 - 文明资源站",
    description: "通过标签快速找到相关资源，浏览热门标签和主题",
    keywords: "资源标签,标签云,热门标签,资源主题",
  };
}
