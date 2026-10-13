import { env } from "@/lib/config/env";
import { masterKey } from "@/server/crypto/subject-keys";
import { recordStoreStatus } from "@/server/services/readiness";

// Readiness (brief §21): whether this deployment can reach AletheiaDB with its key, whether the
// database has been set up (scripts/db-bootstrap.mjs), and whether the secrets that personal
// data and sign-in need are present. Never exposes values, hosts or errors.
export const dynamic = "force-dynamic";

export async function GET() {
  let config;
  try {
    config = env();
  } catch {
    return Response.json({ status: "unavailable", checks: { config: "invalid" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const checks = {
    config: "ok",
    recordStore: await recordStoreStatus(),
    encryption: masterKey() ? "configured" : "not_configured",
    sessions: config.AUTH_SECRET ? "configured" : "not_configured",
    mailer: "not_configured",
  } as const;
  const ready = checks.recordStore === "ok" && checks.encryption === "configured" && checks.sessions === "configured";
  return Response.json({ status: ready ? "ok" : "degraded", checks }, { headers: { "Cache-Control": "no-store" } });
}
