import "@/app/globals.css";

import { getMessages, getTranslations } from "next-intl/server";

import { AppContextProvider } from "@/contexts/app";
import { Inter as FontSans } from "next/font/google";
import { Metadata } from "next";
import { NextAuthSessionProvider } from "@/auth/session";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "@/providers/theme";
import { cn } from "@/lib/utils";
import { SITE_NAME, absoluteUrl, getSiteUrl } from "@/lib/seo";


const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations();

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      template: `%s`,
      default: t("metadata.title") || "",
    },
    description: t("metadata.description") || "",
    keywords: t("metadata.keywords") || "",
    alternates: {
      canonical: locale === "en" ? absoluteUrl("/", "en") : absoluteUrl("/"),
      languages: {
        zh: absoluteUrl("/"),
        en: absoluteUrl("/", "en"),
        "x-default": absoluteUrl("/"),
      },
    },
    openGraph: {
      title: t("metadata.title") || "",
      description: t("metadata.description") || "",
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      siteName: SITE_NAME,
      url: locale === "en" ? absoluteUrl("/", "en") : absoluteUrl("/"),
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - 优质资源分享平台`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t("metadata.title") || "",
      description: t("metadata.description") || "",
      images: ['/og-image.jpg'],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased overflow-x-hidden",
          fontSans.variable
        )}
      >
        <NextIntlClientProvider messages={messages}>
          <NextAuthSessionProvider>
            <AppContextProvider>
              <ThemeProvider attribute="class" disableTransitionOnChange>
                {children}
              </ThemeProvider>
            </AppContextProvider>
          </NextAuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
