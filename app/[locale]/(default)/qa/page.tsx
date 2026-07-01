import { createPageMetadata } from "@/lib/metadata";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

const zhFaqs = [
  {
    question: "文明知识库适合用来找什么资料？",
    answer:
      "文明知识库适合查找历史、文化、文明史、纪录片、电子书、课程课件、文档模板和学习资料，面向学习者、教师、研究者和内容创作者。",
  },
  {
    question: "如何在文明知识库找到世界文明史学习资源？",
    answer:
      "可以先进入资源库，按分类、标签、关键词搜索和热门排序筛选资源；如果目标明确，可以直接搜索古埃及、两河文明、希腊文明、中国文明、文明史纪录片等关键词。",
  },
  {
    question: "文明知识库的资源是否免费？",
    answer:
      "平台同时支持免费资源和积分资源。资源详情页会展示资源类型、访问方式、评分、浏览量和相关说明，用户可以根据页面提示访问。",
  },
  {
    question: "教师和内容创作者如何使用文明知识库？",
    answer:
      "教师可以用于备课、课件素材整理和拓展阅读推荐；内容创作者可以查找选题资料、纪录片线索、文化背景资料和知识型内容素材。",
  },
  {
    question: "我可以上传自己的资源吗？",
    answer:
      "可以。用户可以通过上传资源页面提交合法、有效、有价值的资源链接和说明。资源会经过审核，审核通过后公开展示。",
  },
];

const enFaqs = [
  {
    question: "What can I find on Civilization Knowledge Base?",
    answer:
      "You can discover curated resources about history, culture, civilization studies, documentaries, ebooks, courseware, document templates, and learning materials.",
  },
  {
    question: "Who is Civilization Knowledge Base for?",
    answer:
      "It is designed for learners, teachers, researchers, lecturers, and content creators who need structured cultural and civilization-related resources.",
  },
  {
    question: "Are the resources free?",
    answer:
      "The platform supports both free and credit-based resources. Each resource detail page shows access information, ratings, views, and related metadata.",
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return createPageMetadata({
    title: locale === "en" ? "FAQ" : "常见问题",
    description:
      locale === "en"
        ? "Frequently asked questions about Civilization Knowledge Base and how to find history, culture, and civilization resources."
        : "文明知识库常见问题：如何查找历史文化资料、世界文明史资源、纪录片、电子书、课件，以及如何上传和使用资源。",
    keywords:
      locale === "en"
        ? "Civilization Knowledge Base FAQ,history resources,cultural resources,learning resources"
        : "文明知识库常见问题,历史资料,文化资料,世界文明史资源,纪录片资源,课件资源",
    url: absoluteUrl("/qa", locale),
    locale: locale === "en" ? "en_US" : "zh_CN",
  });
}

export default async function QAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";
  const faqs = isEn ? enFaqs : zhFaqs;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm font-medium text-primary">{SITE_NAME}</p>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
          {isEn ? "Frequently Asked Questions" : "文明知识库常见问题"}
        </h1>
        <p className="mb-10 text-muted-foreground">
          {isEn
            ? "Quick answers for finding and using history, culture, and civilization resources."
            : "围绕历史文化资料、世界文明史资源、纪录片、电子书、课件和资源上传整理的常见问题。"}
        </p>

        <div className="space-y-5">
          {faqs.map((faq) => (
            <section key={faq.question} className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold">{faq.question}</h2>
              <p className="leading-7 text-muted-foreground">{faq.answer}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
