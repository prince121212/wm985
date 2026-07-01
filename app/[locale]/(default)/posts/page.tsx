import Blog from "@/components/blocks/blog";
import { Blog as BlogType } from "@/types/blocks/blog";
import { getPostsByLocale } from "@/models/post";
import { getTranslations } from "next-intl/server";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();
  const canonicalUrl = absoluteUrl("/posts", locale);

  return {
    title: t("blog.title"),
    description: t("blog.description"),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        zh: absoluteUrl("/posts"),
        en: absoluteUrl("/posts", "en"),
      },
    },
  };
}

export default async function ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const posts = await getPostsByLocale(locale);

  const blog: BlogType = {
    title: t("blog.title"),
    description: t("blog.description"),
    items: posts,
    read_more_text: t("blog.read_more_text"),
  };

  return <Blog blog={blog} />;
}
