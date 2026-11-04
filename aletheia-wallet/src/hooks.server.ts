// Security headers (wallet prompt 14). The CSP itself comes from kit.csp in svelte.config.js.
// No secret ever passes through here: wallet routes render client-side only.
import type { Handle } from "@sveltejs/kit";

const PUBLIC = new Set(["/", "/about", "/security", "/help", "/network", "/sitemap.xml", "/robots.txt"]);

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  const headers = response.headers;
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  if (!PUBLIC.has(event.url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Cache-Control", "no-store");
  }
  return response;
};
