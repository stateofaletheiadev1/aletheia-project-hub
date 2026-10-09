import { env } from "@/lib/config/env";

// Readiness (brief §21). AletheiaDB is not integrated yet, so the record store is
// reported as "not_configured" and the service as degraded, never as healthy.
export const dynamic = "force-dynamic";

export function GET() {
  let configValid = true;
  try {
    env();
  } catch {
    configValid = false;
  }
  const checks = { config: configValid ? "ok" : "invalid", recordStore: "not_configured", mailer: "not_configured" } as const;
  const status = configValid ? "degraded" : "unavailable";
  return Response.json({ status, checks }, { status: configValid ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
