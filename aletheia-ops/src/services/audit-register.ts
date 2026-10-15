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
  "auth.mfa_disable": "Two-step sign-in turned off",
  "record.create": "Record created",
  "record.edit": "Draft edited",
  "record.reclassify": "Record reclassified",
  "record.submit": "Submitted for review",
  "record.take_for_review": "Taken for review",
  "record.request_revision": "Revision requested",
  "record.reject": "Record rejected",
  "record.adopt": "Adoption recorded",
  "record.verify": "Appointment verified",
  "record.approve": "Version approved",
  "record.authorise_publication": "Publication authorised",
  "record.publish": "Sent for publication",
  "record.confirm_publication": "Publication confirmed",
  "record.fail_publication": "Publication refused",
  "record.retry_publication": "Publication retried",
  "record.start_correction": "Correction started",
  "record.withdraw": "Record withdrawn",
  "record.archive": "Record archived",
  "record.reopen": "Record reopened",
  "record.founder_authority": "Step taken on a founder's authority",
  "reference.issue": "Reference issued",
  "publication.simulated": "Publication simulated (not public)",
  "publication.confirmed": "Published on aletheiagov.org",
  "publication.refused": "Publication refused by the portal",
  "publication.unclear": "Publication answer unclear; to reconcile",
  "record.withdraw_publication": "Withdrawal from the public record requested",
  "withdrawal.confirmed": "Withdrawn from aletheiagov.org",
  "withdrawal.refused": "Withdrawal refused by the portal",
  "withdrawal.unclear": "Withdrawal answer unclear; to reconcile",
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
