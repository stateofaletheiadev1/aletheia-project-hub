import "server-only";
import { database } from "@/server/aletheiadb/client";

// Append-only audit events (brief §10.10), written by services, never by clients.
// Never contains secrets or personal values: only ids, references and outcomes.
// Written synchronously for every sensitive action, so a failure to audit fails the action.

export type AuditEvent = {
  at: string;
  actorId: string | null;
  action: string;
  target: { type: string; id: string } | null;
  outcome: "success" | "failure" | "denied";
  details?: Record<string, string | number | boolean>;
};

export async function audit(event: Omit<AuditEvent, "at">): Promise<void> {
  const db = database();
  if (!db) throw new Error("audit log unavailable");
  await db.collection<AuditEvent>("audit_events").insertOne({ at: new Date().toISOString(), ...event });
}

export async function recentAuditEvents(opts: { limit?: number; action?: string } = {}) {
  const db = database();
  if (!db) return [];
  const filter = opts.action ? { action: opts.action } : {};
  const page = await db.collection<AuditEvent>("audit_events").find(filter, { sort: { at: -1 }, limit: Math.min(opts.limit ?? 100, 500) });
  return page.documents;
}
