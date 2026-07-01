import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*?*q=",
          "/*?*search=",
          "/api/",
          "/admin/",
          "/user-center/",
          "/my-credits/",
          "/my-favorites/",
          "/my-invites/",
          "/my-orders/",
          "/my-uploads/",
          "/profile/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
