// Reading the audit register for people (brief §26): events in plain words, with names.
// Never shows secrets or personal data beyond the names officials sign with.

import type { AuditEvent, UnitOfWork } from "./audit";
import type { Official } from "./identity/types";

const LABEL: Record<string, string> = {
  "official.bootstrap": "Founding administrator created",
  "official.invite": "Official invited",
  "official.activate": "Invitation accepted",
  "official.suspend": "Official suspended",
  "official.reinstate": "Official reinstated",
  "official.revoke": "Access revoked",
  "official.preferences": "Preferences changed",
  "auth.mfa_enrol": "Authenticator set up",
  "auth.password": "Password checked",
  "auth.mfa": "Authenticator code checked",
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "auth.lock": "Account locked after repeated failures",
  "auth.password_change": "Password changed",
  "auth.session_revoke": "Session ended",
  "role.grant": "Role granted",
  "role.remove": "Role removed",
  "role.propose": "Privileged role change proposed",
  "role.confirm": "Privileged role change confirmed",
  "role.reject": "Privileged role change rejected",
};

export type AuditRow = { seq: number; at: string; label: string; actorName: string; outcome: AuditEvent["outcome"]; reason?: string };

export async function listAuditEvents(uow: UnitOfWork, opts: { before?: number; limit: number }): Promise<{ events: AuditRow[]; nextBefore: number | null }> {
  const filter = opts.before ? { seq: { $lt: opts.before } } : {};
  const page = await uow.store.find<AuditEvent>("audit_events", filter, { sort: { seq: -1 }, limit: opts.limit });
  const ids = [...new Set(page.documents.flatMap((e) => [e.actorId, e.target?.type === "official" ? e.target.id : null]).filter((x): x is string => Boolean(x)))];
  const people = ids.length ? (await uow.store.find<Official>("officials", { id: { $in: ids } }, { limit: ids.length })).documents : [];
  const name = new Map(people.map((p) => [p.id, p.name]));
  const events = page.documents.map((e) => {
    const subject = e.target?.type === "official" && e.target.id !== e.actorId ? name.get(e.target.id) : undefined;
    const base = LABEL[e.action] ?? e.action;
    return {
      seq: e.seq,
      at: e.at,
      label: subject ? `${base}: ${subject}` : base,
      actorName: e.actorId ? (name.get(e.actorId) ?? "An official") : e.action === "official.bootstrap" ? "System (bootstrap)" : "Unknown visitor",
      outcome: e.outcome,
      reason: e.reason,
    };
  });
  const last = page.documents.at(-1);
  return { events, nextBefore: page.hasMore && last ? last.seq : null };
}
