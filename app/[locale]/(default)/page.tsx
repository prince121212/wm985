import FAQ from "@/components/blocks/faq";
import Feature from "@/components/blocks/feature";
import Feature1 from "@/components/blocks/feature1";
import Feature2 from "@/components/blocks/feature2";
import Feature3 from "@/components/blocks/feature3";
import Hero from "@/components/blocks/hero";
import Pricing from "@/components/blocks/pricing";
import Showcase from "@/components/blocks/showcase";
import Stats from "@/components/blocks/stats";
import ResourceCategories from "@/components/blocks/resource-categories";
import PopularResources from "@/components/blocks/popular-resources";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getLandingPage } from "@/services/page";
import {
  SITE_NAME,
  absoluteUrl,
  getSiteUrl,
  localizedPath,
} from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const canonicalUrl = absoluteUrl("/", locale);

  return {
    alternates: {
      canonical: canonicalUrl,
      languages: {
        zh: absoluteUrl("/"),
        en: absoluteUrl("/", "en"),
        "x-default": absoluteUrl("/"),
      },
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getLandingPage(locale);
  const baseUrl = getSiteUrl();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: "文明",
      url: baseUrl,
      inLanguage: locale === "en" ? "en" : "zh-CN",
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}${localizedPath("/resources", locale)}?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
      description:
        "文明知识库是一个开放的文明资源共享平台，聚合历史、文化、文明史、纪录片、电子书、课件和文档资料。",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {page.hero && <Hero hero={page.hero} />}

      {/* 新增：资源分类导航 */}
      <ResourceCategories />

      {/* 新增：热门资源展示 */}
      <PopularResources />

      {/* CTA 区域 - 参考原型图设计 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="p-8 lg:p-12 text-center bg-gradient-to-r from-orange-500 to-red-500 text-white border-none rounded-xl shadow-lg">
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">分享您的知识和资源</h2>
            <p className="text-base lg:text-lg mb-8 max-w-2xl mx-auto opacity-90">
              通过上传资源，您可以让更多学人获取知识，同时也能获得社区的认可和支持。
            </p>
            <Button
              size="lg"
              className="bg-white text-orange-500 font-bold px-6 lg:px-8 py-3 lg:py-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              asChild
            >
              <Link href="/upload">
                上传资源
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 保留现有统计和CTA */}
      {page.stats && <Stats section={page.stats} />}

      {/* 可选：保留部分原有组件作为补充内容 */}
    </>
  );
}
