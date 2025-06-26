import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import CategoriesList from "@/components/blocks/categories-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CategoriesPage() {
  const t = await getTranslations();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">资源分类</h1>
          <p className="text-muted-foreground">
            浏览不同类别的资源，快速找到您需要的内容
          </p>
        </div>

        {/* 分类列表 */}
        <Suspense fallback={<CategoriesListSkeleton />}>
          <CategoriesList />
        </Suspense>
      </div>
    </div>
  );
}

function CategoriesListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 9 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations();

  return {
    title: "资源分类 - 文明资源站",
    description: "浏览不同类别的资源，包括设计素材、开发工具、文档模板等",
    keywords: "资源分类,分类浏览,设计素材,开发工具,文档模板",
  };
}
