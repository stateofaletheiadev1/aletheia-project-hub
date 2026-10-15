import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { deliverAll } from "@/services/records/publication";
import { gateway, requireDeps } from "@/server/runtime";

// The durable retry (brief §31.4): Vercel Cron calls this; it sends every publication still
// pending, and reconciles every unclear one by asking the portal first. Bearer CRON_SECRET only.

export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const g = gateway();
  if (!g) return NextResponse.json({ error: "publication is not configured" }, { status: 503 });
  const handled = await deliverAll(await requireDeps(), g);
  return NextResponse.json({ handled }, { headers: { "Cache-Control": "no-store" } });
}
