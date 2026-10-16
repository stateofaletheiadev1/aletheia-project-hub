import "server-only";
import { createHash } from "node:crypto";
import { ConflictError, type AletheiaDB } from "@aletheia/aletheiadb";
import { z } from "zod";
import { getInstitution } from "@/content/institutions";
import { POSITION_SLUGS } from "@/content/positions";
import { COLLECTION, type RecordKind } from "@/server/records/public-records";
import { publicationHash } from "./canonical";

// The only writer of the public record (aletheia-ops ADR 0003). The workbench asks; this site
// checks everything again (shape, register, reference, content hash, version) and writes the
// record and its receipt in one atomic commit. A request repeated with the same idempotency key
// returns the first receipt and never publishes twice.

const REGISTER: Record<string, { kind: RecordKind; path: string }> = {
  documents: { kind: "document", path: "/documents" },
  decisions: { kind: "decision", path: "/decisions" },
  dispatches: { kind: "dispatch", path: "/dispatches" },
  finance: { kind: "finance", path: "/public-finance" },
  appointments: { kind: "appointment", path: "/appointments" },
  opportunities: { kind: "opportunity", path: "/opportunities" },
  events: { kind: "event", path: "/events" },
};

const text = (max: number) => z.string().max(max);
const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: text(20_000) }),
  z.object({ type: z.literal("heading"), text: text(500) }),
  z.object({ type: z.literal("list"), items: z.array(text(5_000)).max(200) }),
  z.object({ type: z.literal("quote"), text: text(5_000), source: text(500).optional() }),
]);

export const PayloadSchema = z.object({
  register: z.enum(Object.keys(REGISTER) as [string, ...string[]]),
  reference: z.string().regex(/^AGV-(DOC|DEC|DSP|FIN|APT|OPP|EVT)-\d{4}-\d{4,}$/),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  workbenchRecordId: z.string().uuid(),
  version: z.number().int().min(1),
  versionHash: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().min(3).max(240),
  summary: text(600),
  body: z.array(Block).max(500),
  facts: z.array(z.object({ label: text(80), value: text(500) })).max(40),
  institution: z.string().regex(/^[a-z0-9-]{1,80}$/),
  positionType: z.enum(POSITION_SLUGS).optional(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type Payload = z.infer<typeof PayloadSchema>;

const TYPE_FOR: Record<string, string> = { documents: "DOC", decisions: "DEC", dispatches: "DSP", finance: "FIN", appointments: "APT", opportunities: "OPP", events: "EVT" };

export type Receipt = { reference: string; url: string; publishedAt: string; contentHash: string };
type ReceiptDoc = Receipt & { idempotencyKey: string; bodyHash: string; register: string; workbenchRecordId: string; version: number; keyId: string };

export class Rejected extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 | 422,
  ) {
    super(message);
  }
}
/** A race with another write: the caller should ask again by idempotency key. */
export class Retry extends Error {}

export function bodyHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Checks a payload in full; returns it typed, or throws Rejected with the reason. */
export function validate(raw: unknown): Payload {
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) throw new Rejected(`invalid payload: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, 400);
  const p = parsed.data;
  if (!p.reference.startsWith(`AGV-${TYPE_FOR[p.register]}-`)) throw new Rejected("the reference does not belong to this register", 422);
  if (p.slug !== p.reference.toLowerCase()) throw new Rejected("the slug must be the reference in lower case", 422);
  if (publicationHash(p) !== p.contentHash) throw new Rejected("content hash mismatch: the text does not match its hash", 422);
  return p;
}

export async function lookup(db: AletheiaDB, idempotencyKey: string): Promise<Receipt | null> {
  const r = await db.collection<ReceiptDoc>("publications").findOne({ idempotencyKey });
  return r ? { reference: r.reference, url: r.url, publishedAt: r.publishedAt, contentHash: r.contentHash } : null;
}

export async function publish(db: AletheiaDB, p: Payload, idempotencyKey: string, raw: string, keyId: string, baseUrl: string, now: Date): Promise<{ receipt: Receipt; replayed: boolean }> {
  const receipts = db.collection<ReceiptDoc>("publications");
  const hash = bodyHash(raw);
  const prior = await receipts.findOne({ idempotencyKey });
  if (prior) {
    if (prior.bodyHash !== hash) throw new Rejected("this idempotency key was already used for a different publication", 409);
    return { receipt: { reference: prior.reference, url: prior.url, publishedAt: prior.publishedAt, contentHash: prior.contentHash }, replayed: true };
  }

  const reg = REGISTER[p.register]!;
  const collection = COLLECTION[reg.kind];
  const existing = await db.collection<Record<string, unknown> & { workbenchRecordId?: string; version?: number }>(collection).findOne({ reference: p.reference });
  if (existing && existing.workbenchRecordId !== p.workbenchRecordId) throw new Rejected("this reference is already used by another record", 409);
  if (existing && (existing.version ?? 0) >= p.version) throw new Rejected(`version ${p.version} is not newer than the published version ${existing.version}`, 409);

  const publishedAt = now.toISOString();
  const url = `${baseUrl.replace(/\/$/, "")}${reg.path}/${p.slug}`;
  const fields = {
    reference: p.reference,
    slug: p.slug,
    title: p.title,
    summary: p.summary || undefined,
    issuer: getInstitution(p.institution)?.name ?? p.institution,
    positionType: p.positionType,
    closingDate: p.closingDate,
    body: p.body,
    facts: p.facts,
    version: p.version,
    contentHash: p.contentHash,
    workbenchRecordId: p.workbenchRecordId,
    visibility: "public",
  };
  const receipt: ReceiptDoc = { reference: p.reference, url, publishedAt, contentHash: p.contentHash, idempotencyKey, bodyHash: hash, register: p.register, workbenchRecordId: p.workbenchRecordId, version: p.version, keyId };
  try {
    await db.db().commit(
      [
        existing
          ? {
              op: "update",
              collection,
              id: existing._id as string,
              expectedRev: existing._rev as number,
              // A correction: the reference and first publication date stay; the text and hash change.
              update: { $set: { ...JSON.parse(JSON.stringify(fields)), correctedAt: publishedAt } },
            }
          : { op: "insert", collection, document: JSON.parse(JSON.stringify({ ...fields, publication: { state: "published", publishedAt } })) },
        { op: "insert", collection: "publications", document: receipt },
      ],
      { idempotencyKey: `publication:${idempotencyKey}` },
    );
  } catch (e) {
    if (e instanceof ConflictError) throw new Retry(e.message);
    throw e;
  }
  return { receipt: { reference: receipt.reference, url, publishedAt, contentHash: receipt.contentHash }, replayed: false };
}

// ---------------------------------------------------------------- withdrawal

export const WithdrawalSchema = z.object({
  register: z.enum(Object.keys(REGISTER) as [string, ...string[]]),
  reference: z.string().regex(/^AGV-(DOC|DEC|DSP|FIN|APT|OPP|EVT)-\d{4}-\d{4,}$/),
  workbenchRecordId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
});
export type Withdrawal = z.infer<typeof WithdrawalSchema>;

export function validateWithdrawal(raw: unknown): Withdrawal {
  const parsed = WithdrawalSchema.safeParse(raw);
  if (!parsed.success) throw new Rejected(`invalid withdrawal: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, 400);
  return parsed.data;
}

/**
 * Withdraws a published record (aletheia-ops ADR 0010): the page stays at its address with a
 * withdrawal notice; its text is removed; it leaves every list. Only the workbench record that
 * published it may withdraw it. Repeated requests return the first receipt.
 */
export async function withdraw(db: AletheiaDB, w: Withdrawal, idempotencyKey: string, raw: string, keyId: string, baseUrl: string, now: Date): Promise<{ receipt: Receipt; replayed: boolean }> {
  const receipts = db.collection<ReceiptDoc>("publications");
  const hash = bodyHash(raw);
  const prior = await receipts.findOne({ idempotencyKey });
  if (prior) {
    if (prior.bodyHash !== hash) throw new Rejected("this idempotency key was already used for a different request", 409);
    return { receipt: { reference: prior.reference, url: prior.url, publishedAt: prior.publishedAt, contentHash: prior.contentHash }, replayed: true };
  }
  const reg = REGISTER[w.register]!;
  const collection = COLLECTION[reg.kind];
  const record = await db.collection<Record<string, unknown> & { workbenchRecordId?: string; contentHash?: string; publication?: { state: string } }>(collection).findOne({ reference: w.reference });
  if (!record) throw new Rejected("there is no published record with this reference", 422);
  if (record.workbenchRecordId !== w.workbenchRecordId) throw new Rejected("this record was not published by this workbench record", 409);
  const at = now.toISOString();
  const url = `${baseUrl.replace(/\/$/, "")}${reg.path}/${record.slug as string}`;
  const receipt: ReceiptDoc = { reference: w.reference, url, publishedAt: at, contentHash: record.contentHash ?? "", idempotencyKey, bodyHash: hash, register: w.register, workbenchRecordId: w.workbenchRecordId, version: Number(record.version ?? 0), keyId };
  try {
    await db.db().commit(
      [
        {
          op: "update",
          collection,
          id: record._id as string,
          expectedRev: record._rev as number,
          update: { $set: { "publication.state": "withdrawn", "publication.withdrawnAt": at, "publication.withdrawalReason": w.reason, body: [], facts: [] }, $unset: ["summary"] },
        },
        { op: "insert", collection: "publications", document: { ...receipt, kind: "withdrawal" } },
      ],
      { idempotencyKey: `withdrawal:${idempotencyKey}` },
    );
  } catch (e) {
    if (e instanceof ConflictError) throw new Retry(e.message);
    throw e;
  }
  return { receipt: { reference: receipt.reference, url, publishedAt: at, contentHash: receipt.contentHash }, replayed: false };
}
