import { NextResponse, type NextRequest } from "next/server";
import { receiveWithdrawal } from "@/server/services/publications";

// POST /api/withdrawals: the operations workbench withdraws a published record (aletheia-ops
// ADR 0010). Signed requests only. The page stays, with a withdrawal notice.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const answer = await receiveWithdrawal(await request.text(), request.headers.get("authorization"), request.headers.get("idempotency-key"));
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
