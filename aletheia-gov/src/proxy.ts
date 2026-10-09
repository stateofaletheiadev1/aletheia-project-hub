import { NextResponse, type NextRequest } from "next/server";
import { clientKey, createLimiter } from "@/server/security/rate-limit";

// Search: 60 queries per minute per client address (brief §14).
const searchLimiter = createLimiter({ limit: 60, windowMs: 60_000 });

export function proxy(request: NextRequest) {
  // Only actual queries count; the empty search page and its prefetches do not.
  if (!request.nextUrl.searchParams.get("q")) return NextResponse.next();

  const verdict = searchLimiter(clientKey(request.headers));
  if (verdict.ok) return NextResponse.next();

  return new NextResponse("Too many searches. Please wait a moment and try again.\n", {
    status: 429,
    headers: {
      "Retry-After": String(verdict.retryAfterSeconds),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: "/search",
};
