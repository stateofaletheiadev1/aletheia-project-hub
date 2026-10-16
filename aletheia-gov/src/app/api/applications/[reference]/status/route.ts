import { NextResponse, type NextRequest } from "next/server";
import { apiSetStatus } from "@/server/services/applications";

// POST /api/applications/{reference}/status: the operations workbench changes an application's
// status (aletheia-ops ADR 0011). The same change as this site's staff area makes, with the
// revision checked, so the status is the same in both places.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const answer = await apiSetStatus(request.nextUrl.pathname, (await params).reference, await request.text(), request.headers.get("authorization"));
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
