import { NextResponse, type NextRequest } from "next/server";
import { apiGet } from "@/server/services/applications";

// GET /api/applications/{reference}?actor=…: one application, decrypted, for the operations
// workbench (aletheia-ops ADR 0011). Signed requests only; audited.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const { pathname, search, searchParams } = request.nextUrl;
  const answer = await apiGet(pathname + search, (await params).reference, searchParams.get("actor"), request.headers.get("authorization"));
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
