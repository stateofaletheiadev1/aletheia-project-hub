// Delivering publications (brief §31.4). The outbox entry was written in the same commit as the
// "publish" step; this sends it, and records the portal's answer. Publication is confirmed only
// on the portal's confirmation. An unclear answer is never taken as failure: the entry is marked
// for reconciliation and the portal is asked, by idempotency key, before anything is retried.

import { randomUUID } from "node:crypto";
import type { PublicationGateway, PublicationOutcome } from "@/ports/publication";
import { StoreConflict, StoreUnavailable, type Doc } from "@/ports/store";
import { commitAudited, type UnitOfWork } from "../audit";
import { step } from "./records";
import type { OutboxDoc, ReceiptDoc, RecordDoc } from "./types";

const OUTBOX = "outbox";

export type DeliveryResult = { state: OutboxDoc["state"]; message: string };

async function settle(uow: UnitOfWork, entry: Doc<OutboxDoc>, outcome: PublicationOutcome): Promise<DeliveryResult> {
  const now = uow.now().toISOString();
  const attempt = { attempts: entry.attempts + 1, lastAttemptAt: now };
  if (outcome.kind === "unknown") {
    await commitAudited(
      uow,
      [{ op: "update", collection: OUTBOX, id: entry._id, expectedRev: entry._rev, update: { $set: { ...attempt, state: "needs_reconciliation", lastError: outcome.reason } } }],
      [{ actorId: null, action: "publication.unclear", outcome: "failure", target: { type: "record", id: entry.recordId }, reason: outcome.reason }],
    );
    return { state: "needs_reconciliation", message: "The portal did not answer clearly. It will be asked what happened before anything is retried." };
  }

  const record = (await uow.store.findOne<RecordDoc>("records", { id: entry.recordId }))!;
  if (outcome.kind === "rejected") {
    await commitAudited(
      uow,
      [{ op: "update", collection: OUTBOX, id: entry._id, expectedRev: entry._rev, update: { $set: { ...attempt, state: "failed", lastError: outcome.reason } } }],
      [{ actorId: null, action: "publication.refused", outcome: "failure", target: { type: "record", id: entry.recordId }, reason: outcome.reason }],
    );
    const fresh = (await uow.store.findOne<RecordDoc>("records", { id: entry.recordId }))!;
    if (fresh.state === "publishing") await step(uow, "system", fresh.id, fresh._rev, "fail_publication", outcome.reason);
    return { state: "failed", message: `The portal refused the publication: ${outcome.reason}` };
  }

  // Confirmed: store the receipt, mark the entry, then move the record to Published.
  const receipt: ReceiptDoc = {
    id: randomUUID(),
    recordId: entry.recordId,
    idempotencyKey: entry.idempotencyKey,
    reference: outcome.reference,
    url: outcome.url,
    publishedAt: outcome.publishedAt,
    contentHash: outcome.contentHash,
    simulated: outcome.simulated,
  };
  await commitAudited(
    uow,
    [
      { op: "update", collection: OUTBOX, id: entry._id, expectedRev: entry._rev, update: { $set: { ...attempt, state: "confirmed", lastError: null } } },
      { op: "insert", collection: "publication_receipts", document: receipt as unknown as Record<string, unknown> },
      { op: "update", collection: "records", id: record._id, expectedRev: record._rev, update: { $set: { publication: { reference: receipt.reference, url: receipt.url, publishedAt: receipt.publishedAt, contentHash: receipt.contentHash, simulated: receipt.simulated } } } },
    ],
    [{ actorId: null, action: outcome.simulated ? "publication.simulated" : "publication.confirmed", target: { type: "record", id: entry.recordId }, details: { reference: receipt.reference, contentHash: receipt.contentHash } }],
  );
  const fresh = (await uow.store.findOne<RecordDoc>("records", { id: entry.recordId }))!;
  if (fresh.state === "publishing") await step(uow, "system", fresh.id, fresh._rev, "confirm_publication");
  return { state: "confirmed", message: outcome.simulated ? "Publication simulated. Nothing was sent to aletheiagov.org." : `Published as ${receipt.reference}.` };
}

/** Records the portal's answer to a withdrawal (ADR 0010). The record is already marked withdrawn. */
async function settleWithdrawal(uow: UnitOfWork, entry: Doc<OutboxDoc>, outcome: PublicationOutcome): Promise<DeliveryResult> {
  const now = uow.now().toISOString();
  const attempt = { attempts: entry.attempts + 1, lastAttemptAt: now };
  if (outcome.kind !== "confirmed") {
    const state = outcome.kind === "rejected" ? "failed" : "needs_reconciliation";
    await commitAudited(
      uow,
      [{ op: "update", collection: OUTBOX, id: entry._id, expectedRev: entry._rev, update: { $set: { ...attempt, state, lastError: outcome.reason } } }],
      [{ actorId: null, action: outcome.kind === "rejected" ? "withdrawal.refused" : "withdrawal.unclear", outcome: "failure", target: { type: "record", id: entry.recordId }, reason: outcome.reason }],
    );
    return { state, message: outcome.kind === "rejected" ? `The portal refused the withdrawal: ${outcome.reason}` : "The portal did not answer clearly. It will be asked again." };
  }
  const record = (await uow.store.findOne<RecordDoc>("records", { id: entry.recordId }))!;
  await commitAudited(
    uow,
    [
      { op: "update", collection: OUTBOX, id: entry._id, expectedRev: entry._rev, update: { $set: { ...attempt, state: "confirmed", lastError: null } } },
      {
        op: "update",
        collection: "records",
        id: record._id,
        expectedRev: record._rev,
        update: { $set: { "publication.withdrawnAt": outcome.publishedAt, "publication.withdrawalReason": entry.withdrawal?.reason ?? "" } },
      },
    ],
    [{ actorId: null, action: "withdrawal.confirmed", target: { type: "record", id: entry.recordId }, details: { reference: outcome.reference } }],
  );
  return { state: "confirmed", message: `Withdrawn from aletheiagov.org. The page now shows the withdrawal notice.` };
}

/** Sends one pending entry, or reconciles one whose earlier answer was unclear. */
export async function deliver(uow: UnitOfWork, gateway: PublicationGateway, outboxId: string): Promise<DeliveryResult> {
  const entry = await uow.store.findOne<OutboxDoc>(OUTBOX, { id: outboxId });
  if (!entry) throw new Error("no such outbox entry");
  if (entry.state === "confirmed") return { state: "confirmed", message: "Already published." };
  if (entry.state === "failed") return { state: "failed", message: entry.lastError ?? "Refused by the portal." };
  try {
    const finish = entry.kind === "withdraw" ? settleWithdrawal : settle;
    if (entry.state === "needs_reconciliation") {
      const known = await gateway.lookup(entry.idempotencyKey);
      if (known.kind !== "absent") return await finish(uow, entry, known);
    }
    const outcome = entry.kind === "withdraw" && entry.withdrawal ? await gateway.withdraw(entry.withdrawal, entry.idempotencyKey) : await gateway.publish(entry.payload, entry.idempotencyKey);
    return await finish(uow, entry, outcome);
  } catch (e) {
    if (e instanceof StoreConflict) return { state: entry.state, message: "Another delivery of this entry is in progress." };
    if (e instanceof StoreUnavailable) return { state: entry.state, message: "The database did not answer; the entry is still queued." };
    throw e;
  }
}

/** For the scheduled job: everything still pending or unclear, oldest first. */
export async function deliverAll(uow: UnitOfWork, gateway: PublicationGateway): Promise<number> {
  const due = (await uow.store.find<OutboxDoc>(OUTBOX, { state: { $in: ["pending", "needs_reconciliation"] } }, { sort: { createdAt: 1 }, limit: 50 })).documents;
  for (const e of due) await deliver(uow, gateway, e.id);
  return due.length;
}
