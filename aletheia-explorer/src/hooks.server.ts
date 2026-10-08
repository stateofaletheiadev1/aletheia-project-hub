import type { Handle } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { follower } from "$lib/server/follower";

follower.start();

// Security headers (spec 41A.15). The CSP itself is set by SvelteKit from svelte.config.js.
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  if (!dev) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
};
