import type { MetadataRoute } from "next";
import { getSupabaseClient } from "@/models/db";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;
export const runtime = "nodejs";

type SitemapEntry = MetadataRoute.Sitemap[number];

type ResourceSitemapRow = {
  uuid: string;
  updated_at?: string | null;
  created_at?: string | null;
  top?: boolean | null;
};

type PostSitemapRow = {
  slug: string;
  locale?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function toDate(value?: string | null): Date {
  return value ? new Date(value) : new Date();
}

async function getResourceUrls(): Promise<SitemapEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resources")
      .select("uuid, updated_at, created_at, top")
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error) return [];

    return ((data || []) as ResourceSitemapRow[]).map((resource) => ({
      url: absoluteUrl(`/resources/${resource.uuid}`),
      lastModified: toDate(resource.updated_at || resource.created_at),
      changeFrequency: resource.top ? "daily" as const : "weekly" as const,
      priority: resource.top ? 0.9 : 0.7,
    }));
  } catch {
    return [];
  }
}

async function getPostUrls(): Promise<SitemapEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("posts")
      .select("slug, locale, updated_at, created_at")
      .eq("status", "online")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (error) return [];

    return ((data || []) as PostSitemapRow[]).map((post) => ({
      url: absoluteUrl(`/posts/${post.slug}`, post.locale || "zh"),
      lastModified: toDate(post.updated_at || post.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticUrls: SitemapEntry[] = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/resources"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/categories"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/tags"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/qa"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/posts"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/", "en"), lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: absoluteUrl("/resources", "en"), lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: absoluteUrl("/qa", "en"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const [resourceUrls, postUrls] = await Promise.all([getResourceUrls(), getPostUrls()]);

  return [...staticUrls, ...resourceUrls, ...postUrls];
}
