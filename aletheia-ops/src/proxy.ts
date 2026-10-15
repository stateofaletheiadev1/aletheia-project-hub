import { NextResponse, type NextRequest } from "next/server";

// Runs before every page (brief §27): a fresh nonce Content Security Policy, a correlation id
// for logs and audit events, and a redirect to sign-in when no session cookie is present.
// The page itself then checks the session against the database (server/session.ts).

const PUBLIC = [/^\/sign-in(\/|$)/, /^\/invitation(\/|$)/, /^\/api\/health(\/|$)/, /^\/design(\/|$)/];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => p.test(pathname));
  if (!isPublic && !request.cookies.get("__Host-agv_ops")) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used for a few computed widths; no style elements are injected.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only where the site is served over HTTPS; a production build run on localhost for tests is not.
    ...(process.env.APP_ENV === "production" || process.env.APP_ENV === "staging" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const correlation = crypto.randomUUID();
  const forwarded = new Headers(request.headers);
  forwarded.set("x-nonce", nonce);
  forwarded.set("x-correlation-id", correlation);
  forwarded.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: forwarded } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Correlation-Id", correlation);
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|icon.svg|brand/|contours/).*)" }],
};
