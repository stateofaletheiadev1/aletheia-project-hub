// The officer console has its own address: adss.oiss.stateofaletheia.org. The public site and
// the Citizen Portal stay on stateofaletheia.org (and www.). proxy.ts sends each request to the
// right address; this happens by itself on those domains, so no setting is needed. Anywhere
// else (local development, tests, Vercel preview links) everything stays on one address.
// ADMIN_HOST overrides the console's address; ADMIN_HOST=off turns the split off.

export const SITE_DOMAIN = 'stateofaletheia.org';
export const CONSOLE_PREFIX = 'adss.oiss.';
export const CONSOLE_DOMAIN = `${CONSOLE_PREFIX}${SITE_DOMAIN}`;

/**
 * For the console: the public site's home page. On the console's own address this is the main
 * domain; elsewhere it is "/". Call after hydration (it reads the browser's address).
 */
export function siteHome(): string {
  if (typeof window === 'undefined') return '/';
  const host = window.location.hostname;
  return host.startsWith(CONSOLE_PREFIX) ? `${window.location.protocol}//${host.slice(CONSOLE_PREFIX.length)}/` : '/';
}
