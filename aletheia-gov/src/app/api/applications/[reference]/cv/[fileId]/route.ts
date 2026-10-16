import { type NextRequest } from "next/server";
import { apiCv } from "@/server/services/applications";

// GET /api/applications/{reference}/cv/{fileId}?actor=…: a CV for the operations workbench
// (aletheia-ops ADR 0011). Signed requests only; every download audited.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string; fileId: string }> }) {
  const { pathname, search, searchParams } = request.nextUrl;
  const { reference, fileId } = await params;
  const answer = await apiCv(pathname + search, reference, fileId, searchParams.get("actor"), request.headers.get("authorization"));
  if (!answer.bytes) return new Response(answer.error ?? "Not found", { status: answer.status, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(answer.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Length": String(answer.bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" },
  });
}
