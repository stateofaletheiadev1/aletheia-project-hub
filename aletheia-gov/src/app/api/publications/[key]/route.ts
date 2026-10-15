import { NextResponse, type NextRequest } from "next/server";
import { findPublication } from "@/server/services/publications";

// GET /api/publications/{idempotencyKey}: the authoritative state of an earlier publication, so
// the workbench can reconcile an unclear answer before it retries (aletheia-ops ADR 0003).

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const answer = await findPublication((await params).key, request.headers.get("authorization"));
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
