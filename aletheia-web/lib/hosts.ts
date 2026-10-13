// The officer console can live on its own address (ADMIN_HOST, e.g. adss.oiss.stateofaletheia.org)
// while the public site and the Citizen Portal stay on the main one. next.config.mjs copies the
// two origins into the browser bundle at build time; when ADMIN_HOST is not set, both are empty
// and every link stays a plain path on the same site.

export const ADMIN_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN ?? '';
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '';

/** A link into the officer console, e.g. adminHref('/admin/login'). */
export const adminHref = (path: string) => `${ADMIN_ORIGIN}${path}`;

/** A link back to the public site from the console. */
export const siteHref = (path: string) => (ADMIN_ORIGIN ? `${SITE_ORIGIN}${path}` : path);
