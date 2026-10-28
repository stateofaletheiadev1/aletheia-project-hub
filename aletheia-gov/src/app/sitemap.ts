import type { MetadataRoute } from "next";
import { institutions } from "@/content/institutions";
import { programmes } from "@/content/programmes";
import { site } from "@/lib/site";
import { listPublished, type RecordKind } from "@/server/records/public-records";

// Records are published from AletheiaDB, so the sitemap is refreshed hourly.
export const revalidate = 3600;

const STATIC = [
  "", "/government", "/institutions", "/founding-programme", "/projects", "/opportunities", "/appointments",
  "/directory", "/documents", "/decisions", "/public-finance", "/dispatches", "/events", "/development",
  "/build-aletheia", "/register-interest", "/search", "/contact", "/privacy", "/terms", "/accessibility", "/image-credits",
];

const RECORD_PATH: Record<RecordKind, string> = {
  opportunity: "/opportunities",
  document: "/documents",
  decision: "/decisions",
  dispatch: "/dispatches",
  finance: "/public-finance",
  appointment: "/appointments",
  event: "/events",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // An unavailable database yields no records, never a failed sitemap.
  const listings = await Promise.all(
    (Object.keys(RECORD_PATH) as RecordKind[]).map((kind) => listPublished(kind, { limit: 100 })),
  );
  return [
    ...STATIC.map((p) => ({ url: `${site.url}${p}` })),
    ...institutions.map((i) => ({ url: `${site.url}/institutions/${i.slug}` })),
    ...programmes.map((p) => ({ url: `${site.url}/projects/${p.slug}` })),
    ...listings.flatMap((l) =>
      l.items.map((r) => ({ url: `${site.url}${RECORD_PATH[l.kind]}/${r.slug}`, lastModified: new Date(r.publishedAt) })),
    ),
  ];
}
