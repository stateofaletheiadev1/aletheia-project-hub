import { NextResponse, type NextRequest } from "next/server";
import { apiList } from "@/server/services/applications";

// GET /api/applications: applications for the operations workbench (aletheia-ops ADR 0011).
// Signed requests only; every read is recorded in the audit log against the official.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const answer = await apiList(pathname + search, searchParams, request.headers.get("authorization"));
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
