import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/services/identity/identity";
import { deps } from "@/server/runtime";
import { clearCookies, sessionToken } from "@/server/session";

// Sign out (POST only). A cross-site form cannot sign anyone out: the Origin must be ours
// (brief §27, CSRF on cookie-authenticated mutations outside server actions). Tested in
// tests/e2e/identity.spec.ts.

/** Same-origin check: the Origin header, or the browser's Sec-Fetch-Site when Origin is withheld. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host === request.nextUrl.host;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const d = await deps();
  const token = await sessionToken();
  if (d && token) await signOut(d, token);
  await clearCookies();
  return NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
}
