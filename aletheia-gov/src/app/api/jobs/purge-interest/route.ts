import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { purgeExpiredInterest } from "@/server/services/interest";

// Scheduled daily by Vercel Cron (vercel.json). Refuses without the shared secret.
export const dynamic = "force-dynamic";

function authorised(header: string | null): boolean {
  const secret = env().CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await purgeExpiredInterest();
    console.log(`retention: deleted ${result.deleted} expired registration(s) and their keys`);
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("retention job failed:", (e as Error).message);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
