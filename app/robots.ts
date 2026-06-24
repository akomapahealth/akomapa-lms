import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated app areas: nothing for crawlers to index here.
      disallow: [
        "/api/",
        "/dashboard",
        "/admin",
        "/teacher",
        "/settings",
        "/grades",
        "/journal",
        "/community",
        "/learning-path",
        "/courses",
        "/search",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
