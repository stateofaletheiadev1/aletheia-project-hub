import "server-only";
import { database } from "@/server/aletheiadb/client";

// Whether this deployment reaches AletheiaDB with its key, and whether the database has been
// set up (scripts/db-bootstrap.mjs). Used by /api/health/ready; never exposes errors or hosts.

const REQUIRED = ["interest_registrations", "staff_users", "subject_keys", "audit_events", "attachments", "counters"];

export type RecordStoreStatus = "ok" | "not_configured" | "unreachable" | "not_set_up";

export async function recordStoreStatus(): Promise<RecordStoreStatus> {
  const db = database();
  if (!db) return "not_configured";
  try {
    const signal = AbortSignal.timeout(4000);
    await db.whoami({ signal });
    const names = new Set((await db.db().listCollections({ signal })).map((c) => c.name));
    return REQUIRED.every((n) => names.has(n)) ? "ok" : "not_set_up";
  } catch {
    return "unreachable";
  }
}
