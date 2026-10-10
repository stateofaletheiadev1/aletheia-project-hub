import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, openSession, REFRESH_AFTER_SECONDS, sealSession, SESSION_COOKIE } from "@/server/auth/session";
import { clientKey, createLimiter } from "@/server/security/rate-limit";

// Search: 60 queries per minute per client address (brief §14).
const searchLimiter = createLimiter({ limit: 60, windowMs: 60_000 });

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/workbench")) return workbench(request);
  return search(request);
}

function search(request: NextRequest) {
  // Only actual queries count; the empty search page and its prefetches do not.
  if (!request.nextUrl.searchParams.get("q")) return NextResponse.next();
  const verdict = searchLimiter(clientKey(request.headers));
  if (verdict.ok) return NextResponse.next();
  return new NextResponse("Too many searches. Please wait a moment and try again.\n", {
    status: 429,
    headers: { "Retry-After": String(verdict.retryAfterSeconds), "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * The workbench: a valid session or a redirect to sign-in; the idle window slides with use;
 * a per-request nonce CSP without 'unsafe-inline' scripts (ADR 0003); never cached or indexed.
 * The pages themselves re-check the user and permissions on the server (current-user.ts).
 */
async function workbench(request: NextRequest) {
  const claims = await openSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname);
    const res = NextResponse.redirect(signIn);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'", // pdf.js renders CV previews in a same-origin worker
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");

  if (Math.floor(Date.now() / 1000) - claims.last > REFRESH_AFTER_SECONDS) {
    const { token } = await sealSession({ uid: claims.uid, sid: claims.sid, sv: claims.sv, iat: claims.iat, exp: claims.exp });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions(Math.max(1, claims.exp - Math.floor(Date.now() / 1000))));
  }
  return res;
}

export const config = {
  matcher: ["/search", "/workbench", "/workbench/:path*"],
};
