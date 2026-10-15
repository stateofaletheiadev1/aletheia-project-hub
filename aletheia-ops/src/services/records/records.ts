// Records and their workflow (brief §18.3, §20–23). Every function checks authority itself;
// every change is one atomic commit with its transition event and audit events (ADR 0002).

import { randomUUID } from "node:crypto";
import { ContentSchema, contentProblems, type Content } from "@/domain/content";
import { CLASSIFICATION_RANK, type Classification, type RecordState } from "@/domain/glossary";
import { formatReference, REGISTER, type Register } from "@/domain/registers";
import { publicationHash, versionHash } from "@/lib/content-hash";
import { can, canSee, institutionsWhere, type Actor } from "@/policy/roles";
import { StoreConflict, type Doc, type Operation } from "@/ports/store";
import { DEFINITIONS, definitionById } from "@/workflow/definitions";
import { availableActions, decide, type Offer } from "@/workflow/engine";
import type { Action, RecordFacts } from "@/workflow/types";
import { commitAudited, type AuditInput, type UnitOfWork } from "../audit";
import { Refused } from "../identity/identity";
import type { ApprovalDoc, OutboxDoc, PublicationPayload, RecordDoc, TransitionDoc, VersionDoc } from "./types";

const RECORDS = "records";
const VERSIONS = "record_versions";
const APPROVALS = "approvals";
const TRANSITIONS = "transitions";
const OUTBOX = "outbox";
const EDITABLE: RecordState[] = ["draft", "revision_requested", "correction_in_progress"];

export const STALE = "This record changed while you were working on it. Reload it, check the changes and try again.";

export type Actorish = { actor: Actor; official: { id: string } };

// ---------------------------------------------------------------- reading

async function load(uow: UnitOfWork, id: string): Promise<Doc<RecordDoc> | null> {
  return uow.store.findOne<RecordDoc>(RECORDS, { id });
}

/** A record the actor may see, or null exactly as if it did not exist (brief §25). */
export async function getRecord(uow: UnitOfWork, actor: Actor, id: string): Promise<Doc<RecordDoc> | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await load(uow, id);
  return r && canSee(actor, r) ? r : null;
}

export async function recordFacts(uow: UnitOfWork, r: RecordDoc): Promise<RecordFacts> {
  const approvals = r.currentVersion ? (await uow.store.find<ApprovalDoc>(APPROVALS, { recordId: r.id }, { limit: 500 })).documents : [];
  return {
    state: r.state,
    institution: r.institution,
    classification: r.classification,
    versionAuthors: r.state === "draft" || EDITABLE.includes(r.state) ? [...new Set([...r.versionAuthors, ...r.draftEditors])] : r.versionAuthors,
    authorId: r.authorId,
    approvals: approvals.map((a) => ({ officialId: a.officialId, versionHash: a.versionHash })),
    currentVersionHash: r.currentVersion?.hash ?? "",
    endorsedBy: r.endorsedBy ?? undefined,
    attachmentsUnscanned: r.attachmentsUnscanned,
    // The working copy is frozen once submitted, so it always equals what is under review.
    sourceDocument: r.draft.sourceDocument,
    disclosureAuthorised: r.draft.disclosureAuthorised,
  };
}

export async function offersFor(uow: UnitOfWork, actor: Actor, r: RecordDoc): Promise<Offer[]> {
  const def = definitionById(r.workflowId);
  if (!def) return [];
  return availableActions(def, await recordFacts(uow, r), actor);
}

export type ListFilter = { register?: Register; institution?: string; state?: RecordState; classification?: Classification; q?: string };

/** Records the actor may see, newest first. Filtering by clearance happens here, never in the page. */
export async function listRecords(uow: UnitOfWork, actor: Actor, f: ListFilter, page = 1, pageSize = 25): Promise<{ rows: Doc<RecordDoc>[]; total: number }> {
  const where = institutionsWhere(actor, "record.read");
  if (where !== "*" && where.length === 0) return { rows: [], total: 0 };
  const filter: Record<string, unknown> = {};
  if (f.register) filter.register = f.register;
  if (f.state) filter.state = f.state;
  if (f.classification) filter.classification = f.classification;
  if (f.institution) filter.institution = where === "*" || where.includes(f.institution) ? f.institution : "__none__";
  else if (where !== "*") filter.institution = { $in: where };
  const all = (await uow.store.find<RecordDoc>(RECORDS, filter, { sort: { updatedAt: -1 }, limit: 1000 })).documents.filter((r) => canSee(actor, r));
  const q = f.q?.trim().toLowerCase();
  const matched = q ? all.filter((r) => r.reference?.toLowerCase() === q || r.draft.title.toLowerCase().includes(q) || r.reference?.toLowerCase().includes(q)) : all;
  return { rows: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length };
}

export async function versionsOf(uow: UnitOfWork, recordId: string): Promise<Doc<VersionDoc>[]> {
  return (await uow.store.find<VersionDoc>(VERSIONS, { recordId }, { sort: { number: -1 }, limit: 200 })).documents;
}

export async function transitionsOf(uow: UnitOfWork, recordId: string): Promise<Doc<TransitionDoc>[]> {
  return (await uow.store.find<TransitionDoc>(TRANSITIONS, { recordId }, { sort: { at: 1 }, limit: 500 })).documents;
}

export async function approvalsOf(uow: UnitOfWork, recordId: string): Promise<Doc<ApprovalDoc>[]> {
  return (await uow.store.find<ApprovalDoc>(APPROVALS, { recordId }, { sort: { at: 1 }, limit: 500 })).documents;
}

/** Records waiting for something the actor may do now (brief §18.2), most urgent first. */
export async function queueFor(uow: UnitOfWork, actor: Actor): Promise<{ record: Doc<RecordDoc>; offers: Offer[] }[]> {
  const { rows } = await listRecords(uow, actor, {}, 1, 1000);
  const open = rows.filter((r) => !["published", "archived", "withdrawn", "rejected", "publishing"].includes(r.state));
  const out: { record: Doc<RecordDoc>; offers: Offer[] }[] = [];
  for (const r of open) {
    const offers = (await offersFor(uow, actor, r)).filter((o) => o.allowed && o.action !== "withdraw");
    // An author's own draft is "waiting for them" only while it is theirs to move on.
    if (offers.length) out.push({ record: r, offers });
  }
  return out.sort((a, b) => (a.record.stateEnteredAt < b.record.stateEnteredAt ? -1 : 1));
}

// ---------------------------------------------------------------- writing

function checkContent(raw: unknown): Content {
  const c = ContentSchema.safeParse(raw);
  if (!c.success) throw new Refused("The record could not be read. Reload the page and try again.");
  return c.data;
}

export type NewRecord = { register: Register; institution: string; classification: Classification; content: Content };

export async function createDraft(uow: UnitOfWork, who: Actorish, input: NewRecord): Promise<string> {
  const { actor } = who;
  if (!can(actor, "record.create", { institution: input.institution, classification: input.classification })) {
    throw new Refused("You cannot create records for that institution at that classification.");
  }
  const content = checkContent(input.content);
  if (content.title.trim().length < 3) throw new Refused("Give the record a title.");
  const now = uow.now().toISOString();
  const def = DEFINITIONS[input.register];
  const r: RecordDoc = {
    id: randomUUID(),
    register: input.register,
    institution: input.institution,
    classification: input.classification,
    priority: "routine",
    workflowId: def.id,
    state: "draft",
    stateEnteredAt: now,
    draft: content,
    draftEditors: [actor.id],
    versionCount: 0,
    currentVersion: null,
    versionAuthors: [],
    authorId: actor.id,
    endorsedBy: null,
    attachmentsUnscanned: 0,
    publication: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor.id,
  };
  await commitAudited(uow, [{ op: "insert", collection: RECORDS, document: r as unknown as Record<string, unknown> }], [
    { actorId: actor.id, action: "record.create", target: { type: "record", id: r.id }, institution: r.institution, details: { register: r.register, classification: r.classification } },
  ]);
  return r.id;
}

/** Saves the working copy. Only while the record is being written or revised. */
export async function saveDraft(uow: UnitOfWork, who: Actorish, id: string, expectedRev: number, content: Content, classification: Classification): Promise<number> {
  const { actor } = who;
  const r = await getRecord(uow, actor, id);
  if (!r) throw new Refused("No such record.");
  if (!EDITABLE.includes(r.state)) throw new Refused("This record cannot be edited at its current stage.");
  if (!can(actor, "record.edit", { institution: r.institution, classification: r.classification }) || !can(actor, "record.edit", { institution: r.institution, classification })) {
    throw new Refused("You cannot edit this record at that classification.");
  }
  if (r._rev !== expectedRev) throw new Refused(STALE);
  const c = checkContent(content);
  const editors = r.draftEditors.includes(actor.id) ? r.draftEditors : [...r.draftEditors, actor.id];
  try {
    const [doc] = (await commitAudited(
      uow,
      [{ op: "update", collection: RECORDS, id: r._id, expectedRev: r._rev, update: { $set: { draft: c, draftEditors: editors, classification, updatedAt: uow.now().toISOString(), updatedBy: actor.id } } }],
      [
        { actorId: actor.id, action: "record.edit", target: { type: "record", id: r.id }, institution: r.institution },
        ...(classification !== r.classification ? [{ actorId: actor.id, action: "record.reclassify", target: { type: "record", id: r.id }, institution: r.institution, details: { from: r.classification, to: classification } }] : []),
      ],
    )).results;
    return (doc as unknown as Doc<RecordDoc>)._rev;
  } catch (e) {
    if (e instanceof StoreConflict) throw new Refused(STALE);
    throw e;
  }
}

/** Allocates the next reference in the same commit as the step that issues it (ADR 0002). */
async function referenceOps(uow: UnitOfWork, r: RecordDoc): Promise<{ reference: string; ops: Operation[] }> {
  const type = REGISTER[r.register].referenceType;
  const year = uow.now().getUTCFullYear();
  const name = `ref:${type}:${year}`;
  const counter = await uow.store.findOne<{ name: string; value: number }>("counters", { name });
  if (!counter) return { reference: formatReference(type, year, 1), ops: [{ op: "insert", collection: "counters", document: { name, value: 1 } }] };
  return {
    reference: formatReference(type, year, counter.value + 1),
    ops: [{ op: "update", collection: "counters", id: counter._id, expectedRev: counter._rev, update: { $inc: { value: 1 } } }],
  };
}

export function payloadFor(r: RecordDoc, version: VersionDoc, reference: string): PublicationPayload {
  const base = {
    register: r.register,
    reference,
    slug: reference.toLowerCase(),
    workbenchRecordId: r.id,
    version: version.number,
    versionHash: version.hash,
    title: version.content.title,
    summary: version.content.summary,
    body: version.content.body,
    facts: version.content.facts,
    institution: r.institution,
  };
  return { ...base, contentHash: publicationHash(base) };
}

export type StepResult = { to: RecordState; outboxId?: string };

/**
 * Takes one workflow step (brief §22): validated on the server against the record's state and
 * revision, the definition's guards, the actor's authority and separation of duties. The state
 * change, its event, approval, reference, outbox entry and audit event commit together.
 */
export async function step(uow: UnitOfWork, who: Actorish | "system", id: string, expectedRev: number, action: Action, reason?: string): Promise<StepResult> {
  const actor = who === "system" ? "system" : who.actor;
  const actorId = who === "system" ? null : who.actor.id;
  const r = who === "system" ? await load(uow, id) : await getRecord(uow, who.actor, id);
  if (!r) throw new Refused("No such record.");
  if (r._rev !== expectedRev) throw new Refused(STALE);
  const def = definitionById(r.workflowId);
  if (!def) throw new Error(`unknown workflow ${r.workflowId}`);

  const now = uow.now().toISOString();
  let facts = await recordFacts(uow, r);
  const set: Record<string, unknown> = { updatedAt: now, updatedBy: actorId ?? "system" };
  const ops: Operation[] = [];
  let version = r.currentVersion;
  let versionDoc: VersionDoc | null = null;

  // Submitting freezes the working copy into a new version, unless nothing changed since.
  if (action === "submit") {
    const problems = contentProblems(r.draft, r.register);
    if (problems.length) throw new Refused(problems.map((p) => p.message).join(" "));
    const number = r.versionCount + 1;
    const hash = versionHash(r.register, number, r.draft);
    const unchanged = r.currentVersion && (await uow.store.findOne<VersionDoc>(VERSIONS, { recordId: r.id, number: r.currentVersion.number }))?.content;
    if (!unchanged || JSON.stringify(unchanged) !== JSON.stringify(r.draft)) {
      const authors = [...new Set(r.draftEditors.length ? r.draftEditors : [r.authorId])];
      versionDoc = { id: randomUUID(), recordId: r.id, number, hash, content: r.draft, authors, createdAt: now, createdBy: actorId ?? "system" };
      ops.push({ op: "insert", collection: VERSIONS, document: versionDoc as unknown as Record<string, unknown> });
      version = { number, hash };
      Object.assign(set, { versionCount: number, currentVersion: version, versionAuthors: authors, draftEditors: [], endorsedBy: null });
      facts = { ...facts, currentVersionHash: hash, versionAuthors: authors };
    }
  }

  const decision = decide(def, facts, { action, actor, reason });
  if (!decision.ok) {
    if (decision.code === "forbidden" && actorId) {
      await commitAudited(uow, [], [{ actorId, action: `record.${action}`, outcome: "denied", target: { type: "record", id: r.id }, institution: r.institution }]);
    }
    throw new Refused(decision.reasons.join(" "));
  }

  set.state = decision.to;
  if (decision.to !== r.state) set.stateEnteredAt = now;
  const events: AuditInput[] = [];
  let outboxId: string | undefined;

  for (const effect of decision.effects) {
    if (effect === "record_approval" && version && actorId) {
      const a: ApprovalDoc = { id: randomUUID(), recordId: r.id, versionHash: version.hash, versionNumber: version.number, officialId: actorId, at: now };
      ops.push({ op: "insert", collection: APPROVALS, document: a as unknown as Record<string, unknown> });
    }
    if (effect === "issue_reference" && !r.reference) {
      const ref = await referenceOps(uow, r);
      ops.push(...ref.ops);
      set.reference = ref.reference;
      events.push({ actorId, action: "reference.issue", target: { type: "record", id: r.id }, institution: r.institution, details: { reference: ref.reference } });
    }
    if (effect === "enqueue_publication") {
      const reference = (set.reference as string | undefined) ?? r.reference;
      const v = await uow.store.findOne<VersionDoc>(VERSIONS, { recordId: r.id, number: version?.number ?? 0 });
      if (!reference || !v) throw new Error("publication needs a reference and a version");
      const key = `${r.id}:v${v.number}`;
      const existing = await uow.store.findOne<OutboxDoc>(OUTBOX, { idempotencyKey: key });
      if (existing) {
        // A retry reuses the entry and its idempotency key, so the portal cannot publish twice.
        ops.push({ op: "update", collection: OUTBOX, id: existing._id, expectedRev: existing._rev, update: { $set: { state: "pending", lastError: null } } });
        outboxId = existing.id;
      } else {
        const entry: OutboxDoc = { id: randomUUID(), recordId: r.id, idempotencyKey: key, payload: payloadFor(r, v, reference), state: "pending", attempts: 0, createdAt: now, lastAttemptAt: null, lastError: null };
        ops.push({ op: "insert", collection: OUTBOX, document: entry as unknown as Record<string, unknown> });
        outboxId = entry.id;
      }
    }
  }
  if (action === "adopt" || action === "verify") set.endorsedBy = actorId;
  if (action === "start_correction" || action === "reopen") set.draftEditors = [];

  const transition: TransitionDoc = {
    id: randomUUID(),
    recordId: r.id,
    workflowId: r.workflowId,
    action,
    from: r.state,
    to: decision.to,
    actorId,
    reason: reason?.trim() || null,
    versionNumber: version?.number ?? null,
    versionHash: version?.hash ?? null,
    at: now,
    correlationId: uow.correlationId,
  };
  ops.unshift({ op: "update", collection: RECORDS, id: r._id, expectedRev: r._rev, update: { $set: set } });
  ops.push({ op: "insert", collection: TRANSITIONS, document: transition as unknown as Record<string, unknown> });
  if (decision.overrides.length) {
    events.push({
      actorId,
      action: "record.founder_authority",
      target: { type: "record", id: r.id },
      institution: r.institution,
      reason: "Taken on a founder's authority, over rules that bind other officials (ADR 0009).",
      details: { step: action, rules: decision.overrides.join(", ") },
    });
  }
  events.unshift({
    actorId,
    action: `record.${action}`,
    target: { type: "record", id: r.id },
    institution: r.institution,
    reason: reason?.trim() || undefined,
    versionHash: version?.hash,
    details: { from: r.state, to: decision.to },
  });
  try {
    await commitAudited(uow, ops, events);
  } catch (e) {
    if (e instanceof StoreConflict) throw new Refused(STALE);
    throw e;
  }
  return { to: decision.to, outboxId };
}

/** Whether a classification is within what the actor may create in an institution. */
export function classificationsFor(actor: Actor, institution: string): Classification[] {
  const all: Classification[] = ["public", "internal", "restricted", "confidential"];
  return all.filter((c) => can(actor, "record.create", { institution, classification: c }) || can(actor, "record.edit", { institution, classification: c })).sort((a, b) => CLASSIFICATION_RANK[a] - CLASSIFICATION_RANK[b]);
}
