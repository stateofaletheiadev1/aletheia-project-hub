// The audit register (brief §26) and the unit of work every change goes through.
//
// Each event is hashed with the hash of the event before it (SHA-256 over canonical JSON), so
// any edit, removal or reordering is detectable. Events are in an append-only collection that
// AletheiaDB refuses to change for any key. The chain head is updated in the same commit as the
// change it records. This is tamper-evident, not tamper-proof: someone with access to the
// database server's files could rewrite the whole chain consistently. No external anchor exists.

import { randomUUID } from "node:crypto";
import { canonicalJson, sha256hex } from "@/lib/crypto";
import { StoreConflict, type Doc, type DocumentStore, type Operation } from "@/ports/store";

export const GENESIS = "0".repeat(64);
const HEAD = "audit_head";
const EVENTS = "audit_events";

export type AuditInput = {
  actorId: string | null;
  action: string;
  target?: { type: string; id: string } | null;
  outcome?: "success" | "failure" | "denied";
  institution?: string;
  reason?: string;
  versionHash?: string;
  details?: Record<string, string | number | boolean | null>;
};

export type AuditEvent = Required<Pick<AuditInput, "actorId" | "action" | "outcome">> &
  Omit<AuditInput, "actorId" | "action" | "outcome"> & {
    id: string;
    seq: number;
    at: string;
    correlationId: string;
    prevHash: string;
    hash: string;
  };

type Head = { name: "head"; seq: number; hash: string };

export function hashEvent(e: Omit<AuditEvent, "hash">): string {
  return sha256hex(canonicalJson(e));
}

/** Creates the chain head once. Safe to call repeatedly. */
export async function ensureAuditHead(store: DocumentStore): Promise<void> {
  if (await store.findOne(HEAD, { name: "head" })) return;
  try {
    await store.commit([{ op: "insert", collection: HEAD, document: { name: "head", seq: 0, hash: GENESIS } }]);
  } catch (e) {
    if (!(e instanceof StoreConflict)) throw e;
  }
}

export type UnitOfWork = {
  store: DocumentStore;
  now: () => Date;
  correlationId: string;
};

export type CommitResult = { replayed: boolean; results: (Doc<Record<string, unknown>> | null)[]; events: AuditEvent[] };

/**
 * Commits `operations` together with their audit events, all or nothing (ADR 0002).
 * `requestKey` makes a repeated request (a double submit, a retried form) return without acting
 * twice. When only the audit head moved (another change was recorded first), the commit is
 * rebuilt and retried; a real conflict on the caller's own documents is raised as StoreConflict.
 */
export async function commitAudited(uow: UnitOfWork, operations: Operation[], events: AuditInput[], requestKey?: string): Promise<CommitResult> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const head = await uow.store.findOne<Head>(HEAD, { name: "head" });
    if (!head) throw new Error("the audit register is not initialised (run the database bootstrap)");
    const at = uow.now().toISOString();
    let { seq, hash } = head;
    const built: AuditEvent[] = events.map((input) => {
      seq += 1;
      const base: Omit<AuditEvent, "hash"> = {
        id: randomUUID(),
        seq,
        at,
        correlationId: uow.correlationId,
        prevHash: hash,
        actorId: input.actorId,
        action: input.action,
        outcome: input.outcome ?? "success",
        ...(input.target ? { target: input.target } : {}),
        ...(input.institution ? { institution: input.institution } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.versionHash ? { versionHash: input.versionHash } : {}),
        ...(input.details ? { details: input.details } : {}),
      };
      hash = hashEvent(base);
      return { ...base, hash };
    });
    const ops: Operation[] = [
      ...operations,
      ...(requestKey ? [{ op: "insert" as const, collection: "requests", document: { key: requestKey, at } }] : []),
      ...built.map((e) => ({ op: "insert" as const, collection: EVENTS, document: e as unknown as Record<string, unknown> })),
      ...(built.length ? [{ op: "update" as const, collection: HEAD, id: head._id, expectedRev: head._rev, update: { $set: { seq, hash } } }] : []),
    ];
    try {
      const results = await uow.store.commit(ops, { correlationId: uow.correlationId });
      return { replayed: false, results: results.slice(0, operations.length), events: built };
    } catch (e) {
      if (!(e instanceof StoreConflict)) throw e;
      if (requestKey && (await uow.store.findOne("requests", { key: requestKey }))) return { replayed: true, results: [], events: [] };
      const moved = await uow.store.findOne<Head>(HEAD, { name: "head" });
      if (!moved || moved._rev === head._rev) throw e; // the conflict is on the caller's documents
    }
  }
  throw new StoreConflict("the audit register is busy; try again");
}

/** Records events that accompany no other change (sign-in failures, denials, views). */
export function audit(uow: UnitOfWork, ...events: AuditInput[]): Promise<CommitResult> {
  return commitAudited(uow, [], events);
}

export type ChainReport = { ok: true; checked: number; headSeq: number } | { ok: false; checked: number; brokenAt: number; problem: string };

/** Walks the whole chain from the first event and checks every link and the head (brief §26). */
export async function verifyChain(store: DocumentStore): Promise<ChainReport> {
  const head = await store.findOne<Head>(HEAD, { name: "head" });
  if (!head) return { ok: false, checked: 0, brokenAt: 0, problem: "The chain head is missing." };
  let prev = GENESIS;
  let expected = 1;
  let checked = 0;
  for (;;) {
    const page = await store.find<AuditEvent>(EVENTS, { seq: { $gte: expected } }, { sort: { seq: 1 }, limit: 500 });
    for (const doc of page.documents) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- store metadata is not part of the hash
      const { _id, _rev, _createdAt, _updatedAt, hash, ...rest } = doc;
      if (doc.seq !== expected) return { ok: false, checked, brokenAt: expected, problem: `Event ${expected} is missing.` };
      if (doc.prevHash !== prev) return { ok: false, checked, brokenAt: doc.seq, problem: `Event ${doc.seq} does not follow from event ${doc.seq - 1}.` };
      if (hashEvent(rest) !== hash) return { ok: false, checked, brokenAt: doc.seq, problem: `Event ${doc.seq} has been altered.` };
      prev = hash;
      expected += 1;
      checked += 1;
    }
    if (!page.hasMore) break;
  }
  if (head.seq !== checked || head.hash !== prev) return { ok: false, checked, brokenAt: checked + 1, problem: "Events after the last one found are missing, or the head was altered." };
  return { ok: true, checked, headSeq: head.seq };
}
