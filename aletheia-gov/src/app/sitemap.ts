import type { MetadataRoute } from "next";
import { institutions } from "@/content/institutions";
import { programmes } from "@/content/programmes";
import { site } from "@/lib/site";

const STATIC = [
  "", "/government", "/institutions", "/founding-programme", "/projects", "/opportunities", "/appointments",
  "/directory", "/documents", "/decisions", "/public-finance", "/dispatches", "/events", "/development",
  "/build-aletheia", "/search", "/contact", "/privacy", "/terms", "/accessibility", "/image-credits",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC.map((p) => ({ url: `${site.url}${p}` })),
    ...institutions.map((i) => ({ url: `${site.url}/institutions/${i.slug}` })),
    ...programmes.map((p) => ({ url: `${site.url}/projects/${p.slug}` })),
  ];
}
