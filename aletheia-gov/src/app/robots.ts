import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Staging and local builds are never indexed (brief §8.6, §18).
  if (process.env.APP_ENV !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/workbench", "/account", "/api"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
