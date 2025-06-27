import { getUserInfo } from "@/services/user";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ProfileTabs from "@/components/blocks/profile-tabs";

export default async function UserCenterPage() {
  const userInfo = await getUserInfo();
  if (!userInfo || !userInfo.email || !userInfo.uuid) {
    redirect("/auth/signin");
  }

  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-background">
      <ProfileTabs user={{
        uuid: userInfo.uuid,
        nickname: userInfo.nickname,
        email: userInfo.email,
        avatar_url: userInfo.avatar_url
      }} />
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations();

  return {
    title: "用户中心 - 文明资源站",
    description: "管理您的个人信息、上传资源、收藏内容等",
    keywords: "用户中心,个人资料,我的上传,我的收藏,积分管理",
  };
}
