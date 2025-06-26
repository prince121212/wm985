import { getUserInfo } from "@/services/user";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import MyFavoritesList from "@/components/blocks/my-favorites-list";

export default async function MyFavoritesPage() {
  const userInfo = await getUserInfo();
  if (!userInfo || !userInfo.email) {
    redirect("/auth/signin");
  }

  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">我的收藏</h3>
        <p className="text-sm text-muted-foreground">
          管理您收藏的资源，快速访问感兴趣的内容
        </p>
      </div>
      <div className="border-t pt-6">
        <MyFavoritesList />
      </div>
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations();

  return {
    title: "我的收藏 - 文明资源站",
    description: "管理您收藏的资源，快速访问感兴趣的内容",
  };
}
