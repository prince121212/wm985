import { getUserInfo } from "@/services/user";
import { redirect } from "next/navigation";
import ProfileTabs from "@/components/blocks/profile-tabs";
import { createPageMetadata, PAGE_TITLES, PAGE_DESCRIPTIONS } from "@/lib/metadata";
import { absoluteUrl } from "@/lib/seo";

export default async function UserCenterPage() {
  const userInfo = await getUserInfo();
  if (!userInfo || !userInfo.email || !userInfo.uuid) {
    redirect("/auth/signin");
  }



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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const metadata = createPageMetadata({
    title: PAGE_TITLES.USER_CENTER,
    description: PAGE_DESCRIPTIONS.USER_CENTER,
    keywords: "用户中心,个人资料,我的上传,我的收藏,积分管理",
    url: absoluteUrl("/user-center", locale),
    locale: locale === "en" ? "en_US" : "zh_CN",
  });

  return {
    ...metadata,
    robots: {
      index: false,
      follow: false,
    },
  };
}
