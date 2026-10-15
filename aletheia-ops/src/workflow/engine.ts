// The workflow engine (brief §22). Pure: given a definition, the facts of a record and an
// attempted action, it says whether the action may happen and what it causes. Services call it
// on the server for every transition; the interface calls `availableActions` only to decide
// what to offer, and the server decides again.

import { can, isFounder, type Actor } from "@/policy/roles";
import type { Action, Attempt, Decision, Guard, RecordFacts, Transition, WorkflowDefinition } from "./types";

type GuardCheck = (facts: RecordFacts, attempt: Attempt, def: WorkflowDefinition) => string | null;

const actorId = (a: Attempt) => (a.actor === "system" ? null : a.actor.id);

/** Approvals on the current version, by distinct officials. */
function approvalsOnVersion(facts: RecordFacts): Set<string> {
  return new Set(facts.approvals.filter((a) => a.versionHash === facts.currentVersionHash).map((a) => a.officialId));
}

const GUARD: Record<Guard, GuardCheck> = {
  actor_is_author: (f, a) => {
    const id = actorId(a);
    return id && (f.authorId === id || f.versionAuthors.includes(id)) ? null : "Only the author of this record can submit it.";
  },
  actor_did_not_author_version: (f, a) => {
    const id = actorId(a);
    return id && f.versionAuthors.includes(id) ? "You wrote or edited this version, so someone else must examine it." : null;
  },
  actor_has_not_approved_version: (f, a) => {
    const id = actorId(a);
    return id && approvalsOnVersion(f).has(id) ? "You have already approved this version. A second approval must come from another officer." : null;
  },
  actor_did_not_approve_version: (f, a) => {
    const id = actorId(a);
    return id && approvalsOnVersion(f).has(id) ? "You approved this version, so another officer must release it to the public record." : null;
  },
  actor_is_second_officer: (f, a) => {
    const id = actorId(a);
    return id && f.endorsedBy === id ? "You recorded the previous stage. Approval must come from a second officer." : null;
  },
  approvals_complete: (f, a, def) => {
    const id = actorId(a);
    const after = approvalsOnVersion(f);
    if (id) after.add(id);
    return after.size >= def.requiredApprovals ? null : "approvals outstanding";
  },
  approvals_outstanding: (f, a, def) => {
    const id = actorId(a);
    const after = approvalsOnVersion(f);
    if (id) after.add(id);
    return after.size < def.requiredApprovals ? null : "approvals complete";
  },
  classification_is_public: (f) => (f.classification === "public" ? null : `This record is classified ${f.classification}. Only public records can be published.`),
  attachments_scanned: (f) =>
    f.attachmentsUnscanned === 0 ? null : `${f.attachmentsUnscanned === 1 ? "One attachment has" : `${f.attachmentsUnscanned} attachments have`} not been scanned. Unscanned files cannot be published.`,
  source_document_linked: (f) => (f.sourceDocument ? null : "Link the source document this finance record is drawn from before submitting it."),
  disclosure_authorised: (f) => (f.disclosureAuthorised ? null : "Publication of the appointee's personal details has not been authorised."),
  reason_given: (_f, a) => (a.reason && a.reason.trim().length >= 3 ? null : "Give a reason. It is recorded with the decision and shown to the author."),
  system_only: (_f, a) => (a.actor === "system" ? null : "This step is recorded by the system when the portal answers."),
  is_on_public_record: (f) => (f.onPublicRecord ? null : "This record is not on aletheiagov.org."),
};

/** Separation of duties (brief §22). Founders act on their own authority over these (ADR 0009). */
export const SOD_GUARDS: readonly Guard[] = ["actor_is_author", "actor_did_not_author_version", "actor_has_not_approved_version", "actor_did_not_approve_version", "actor_is_second_officer"];

/** Guards that select between two transitions for one action; their failures are not reasons. */
const SELECTORS: readonly Guard[] = ["approvals_complete", "approvals_outstanding"];

function permitted(t: Transition, facts: RecordFacts, actor: Actor | "system"): boolean {
  if (actor === "system") return t.permission === null;
  if (t.permission === null) return false;
  return can(actor, t.permission, { institution: facts.institution, classification: facts.classification });
}

export function decide(def: WorkflowDefinition, facts: RecordFacts, attempt: Attempt): Decision {
  const named = def.transitions.filter((t) => t.action === attempt.action);
  if (named.length === 0) return { ok: false, code: "unknown_action", reasons: ["This step does not exist for this register."] };

  const fromHere = named.filter((t) => t.from.includes(facts.state));
  if (fromHere.length === 0) return { ok: false, code: "wrong_state", reasons: ["This step is not available at the record's current stage."] };

  if (!fromHere.some((t) => permitted(t, facts, attempt.actor))) {
    return { ok: false, code: "forbidden", reasons: ["You do not have authority for this step on this record."] };
  }

  let fewest: string[] | null = null;
  for (const t of fromHere.filter((x) => permitted(x, facts, attempt.actor))) {
    const founder = attempt.actor !== "system" && isFounder(attempt.actor);
    const all = t.guards.map((g) => [g, GUARD[g](facts, attempt, def)] as const).filter(([, msg]) => msg !== null);
    const overrides = founder ? all.filter(([g]) => SOD_GUARDS.includes(g)).map(([g]) => g) : [];
    const failures = all.filter(([g]) => !overrides.includes(g));
    if (failures.length === 0) return { ok: true, transition: t, from: facts.state, to: t.to, effects: t.effects, overrides };
    const reasons = failures.filter(([g]) => !SELECTORS.includes(g)).map(([, msg]) => msg as string);
    if (reasons.length > 0 && (fewest === null || reasons.length < fewest.length)) fewest = reasons;
  }
  return { ok: false, code: "guard", reasons: fewest ?? ["This step is not available."] };
}

export type Offer = { action: Action; allowed: true } | { action: Action; allowed: false; reasons: string[] };

/**
 * The steps to show an official for a record: those they have authority for at this stage,
 * each either available or with the reasons it is not (brief §23: "a clear statement of why").
 */
export function availableActions(def: WorkflowDefinition, facts: RecordFacts, actor: Actor): Offer[] {
  const seen = new Set<Action>();
  const offers: Offer[] = [];
  for (const t of def.transitions) {
    if (seen.has(t.action) || !t.from.includes(facts.state) || t.permission === null) continue;
    if (!permitted(t, facts, actor)) continue;
    seen.add(t.action);
    // The reason is supplied in the dialog, so it is not a reason to withhold the button.
    const d = decide(def, facts, { action: t.action, actor, reason: "provided in dialog" });
    offers.push(d.ok ? { action: t.action, allowed: true } : { action: t.action, allowed: false, reasons: d.reasons });
  }
  return offers;
}

/** Each condition for publication, named, satisfied or not (brief §13.2 Publication, §23). */
export function publicationEligibility(def: WorkflowDefinition, facts: RecordFacts): { condition: string; met: boolean }[] {
  const approvals = approvalsOnVersion(facts).size;
  return [
    { condition: `Approved by ${def.requiredApprovals === 1 ? "an officer" : `${def.requiredApprovals} officers`} on this version`, met: approvals >= def.requiredApprovals },
    { condition: "Classified Public", met: facts.classification === "public" },
    { condition: "Every attachment scanned", met: facts.attachmentsUnscanned === 0 },
    ...(def.register === "appointments" ? [{ condition: "Disclosure of personal details authorised", met: Boolean(facts.disclosureAuthorised) }] : []),
    ...(def.register === "finance" ? [{ condition: "Traced to a source document", met: Boolean(facts.sourceDocument) }] : []),
  ];
}

/** Overdue is derived from policy and the time the record entered its state (brief §22). */
export function dueAt(def: WorkflowDefinition, state: RecordFacts["state"], enteredAt: Date): Date | null {
  const days = def.dueDays[state];
  return days === undefined ? null : new Date(enteredAt.getTime() + days * 86_400_000);
}
