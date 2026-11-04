import { config } from "$lib/config";

export const prerender = true;

const PRIVATE = [
  "/create",
  "/import",
  "/unlock",
  "/recovery",
  "/dashboard",
  "/send",
  "/receive",
  "/assets",
  "/activity",
  "/transactions",
  "/accounts",
  "/address-book",
  "/settings",
  "/dev",
];

export function GET(): Response {
  const body = [
    "User-agent: *",
    "Allow: /",
    ...PRIVATE.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${config.siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
