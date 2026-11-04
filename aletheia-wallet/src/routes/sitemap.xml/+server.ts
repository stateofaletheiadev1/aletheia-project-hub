// Public pages only; private routes are never listed (wallet prompt 17).
import { config } from "$lib/config";
import { PUBLIC_PAGES } from "$lib/seo";

export const prerender = true;

export function GET(): Response {
  const urls = PUBLIC_PAGES.map(
    (page) => `  <url><loc>${config.siteUrl}${page.path === "/" ? "/" : page.path}</loc></url>`,
  ).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
