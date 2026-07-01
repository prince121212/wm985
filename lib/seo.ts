export const SITE_NAME = "文明知识库";
export const SITE_SHORT_NAME = "文明";
export const DEFAULT_SITE_URL = "https://wm.292828.xyz";

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_SITE_URL;

  return raw.replace(/\/+$/, "");
}

export function stripHtml(input?: string | null): string {
  if (!input) return "";

  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(text: string, maxLength = 160): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

export function localizedPath(path = "/", locale = "zh"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const cleanPath = normalizedPath === "/" ? "" : normalizedPath;

  return locale === "en" ? `/en${cleanPath}` : cleanPath || "/";
}

export function absoluteUrl(path = "/", locale?: string): string {
  const pathname = locale ? localizedPath(path, locale) : path;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${getSiteUrl()}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function createSeoTitle(pageTitle?: string): string {
  if (!pageTitle) {
    return `${SITE_NAME} - 优质文明资源、文化资料与知识共享平台`;
  }

  return `${pageTitle} - ${SITE_NAME}`;
}
