import { getUserInfo } from "@/services/user";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import MyUploadsList from "@/components/blocks/my-uploads-list";

export default async function MyUploadsPage() {
  const userInfo = await getUserInfo();
  if (!userInfo || !userInfo.email) {
    redirect("/auth/signin");
  }

  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">我的上传</h3>
        <p className="text-sm text-muted-foreground">
          管理您上传的资源，查看审核状态和下载统计
        </p>
      </div>
      <div className="border-t pt-6">
        <MyUploadsList />
      </div>
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations();

  return {
    title: "我的上传 - 文明资源站",
    description: "管理您上传的资源，查看审核状态和下载统计",
  };
}
