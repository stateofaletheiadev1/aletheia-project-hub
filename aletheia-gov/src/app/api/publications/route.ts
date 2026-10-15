import { NextResponse, type NextRequest } from "next/server";
import { receivePublication } from "@/server/services/publications";

// POST /api/publications: the operations workbench publishes an approved record (aletheia-ops
// ADR 0003). Signed requests only; everything is checked again before it is written.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const answer = await receivePublication(await request.text(), request.headers.get("authorization"), request.headers.get("idempotency-key"));
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
