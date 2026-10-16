import "server-only";
import { ConflictError, type AletheiaDB } from "@aletheia/aletheiadb";
import { ANY_INSTITUTION, type InterestInput } from "@/features/interest/schema";
import { database } from "@/server/aletheiadb/client";
import { blindIndex, decryptFields, encryptFields, type Sealed } from "@/server/crypto/envelope";
import { existingSubjectKey, masterKey, shredSubjectKey, subjectKeyFor } from "@/server/crypto/subject-keys";
import { nextReference } from "@/server/records/sequence";
import { deleteAttachment, readAttachment, storeAttachment, type AttachmentMeta } from "@/server/storage/attachments";

// Registrations of interest: one record per person (keyed by a blind index of their email),
// covering any number of institutions and kinds of position (founding, permanent, …).
// Registrations made before kinds of position existed were all for founding roles. Personal fields and CVs are encrypted under the
// person's key before they reach AletheiaDB (brief §8.4). A repeat registration adds
// institutions, a note or a CV; it never overwrites what is already there.

const COLLECTION = "interest_registrations";
const RETENTION_MONTHS = 12;
const MAX_CVS = 3;

export type InterestStatus = "new" | "contacted" | "archived";
export type Pii = { fullName: string; email: string; notes: { text: string; at: string }[] };

export type Registration = {
  reference: string;
  subject: string;
  /** Kinds of position (content/positions.ts). Missing on early records: read as ["founding"]. */
  positionTypes?: string[];
  /** Published opportunities applied for, by reference, oldest first. */
  opportunities?: { reference: string; appliedAt: string }[];
  institutions: string[];
  expertise: string[];
  pii: Sealed;
  cvs: AttachmentMeta[];
  status: InterestStatus;
  visibility: "confidential";
  source: "website";
  submittedAt: string;
  updatedAt: string;
  retainUntil: string;
};

export type InterestOutcome =
  | { ok: true; reference: string; positionTypes: string[]; institutions: string[]; cv: boolean }
  | { ok: false; reason: "not_configured" | "unavailable" };

export function interestConfigured(): boolean {
  return Boolean(database() && masterKey());
}

export function registrations(db: AletheiaDB) {
  return db.collection<Registration>(COLLECTION);
}

/** The kinds of position a registration covers; early registrations were all for founding roles. */
export function positionTypesOf(r: Pick<Registration, "positionTypes">): string[] {
  return r.positionTypes?.length ? r.positionTypes : ["founding"];
}

function retainUntil(from = new Date()): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + RETENTION_MONTHS);
  return d.toISOString();
}

export async function registerInterest(
  input: InterestInput,
  cv: { bytes: Uint8Array; name: string } | null,
  opts: { idempotencyKey?: string } = {},
): Promise<InterestOutcome> {
  const db = database();
  const master = masterKey();
  if (!db || !master) return { ok: false, reason: "not_configured" };

  try {
    const subject = blindIndex(master, "person-email", input.email);
    const key = await subjectKeyFor(db, master, subject);
    const cvMeta = cv ? await storeAttachment(db, subject, key, { bytes: cv.bytes, name: cv.name, contentType: "application/pdf" }) : null;
    const now = new Date().toISOString();
    const note = input.note ? [{ text: input.note, at: now }] : [];
    const regs = registrations(db);

    for (let attempt = 0; attempt < 4; attempt++) {
      const existing = await regs.findOne({ subject });
      if (!existing) {
        const reference = await nextReference(db, "EOI");
        try {
          await regs.insertOne(
            {
              reference,
              subject,
              positionTypes: input.positionTypes,
              ...(input.opportunity ? { opportunities: [{ reference: input.opportunity, appliedAt: now }] } : {}),
              institutions: input.institutions,
              expertise: [input.expertise],
              pii: encryptFields(key, { fullName: input.fullName, email: input.email, notes: note } satisfies Pii, COLLECTION),
              cvs: cvMeta ? [cvMeta] : [],
              status: "new",
              visibility: "confidential",
              source: "website",
              submittedAt: now,
              updatedAt: now,
              retainUntil: retainUntil(),
            },
            { idempotencyKey: opts.idempotencyKey },
          );
          return { ok: true, reference, positionTypes: input.positionTypes, institutions: input.institutions, cv: Boolean(cvMeta) };
        } catch (e) {
          if (e instanceof ConflictError) continue; // registered concurrently: merge instead
          throw e;
        }
      }

      // Merge: add, never overwrite. The name on record stays as first given.
      const pii = decryptFields<Pii>(key, existing.pii, COLLECTION);
      const cvs = cvMeta ? [...existing.cvs, cvMeta] : existing.cvs;
      const dropped = cvs.slice(0, Math.max(0, cvs.length - MAX_CVS));
      try {
        await regs.updateOne(existing._id, existing._rev, {
          $set: {
            positionTypes: [...new Set([...positionTypesOf(existing), ...input.positionTypes])],
            ...(input.opportunity && !(existing.opportunities ?? []).some((o) => o.reference === input.opportunity)
              ? { opportunities: [...(existing.opportunities ?? []), { reference: input.opportunity, appliedAt: now }] }
              : {}),
            institutions: [...new Set([...existing.institutions, ...input.institutions])],
            expertise: [...new Set([...existing.expertise, input.expertise])],
            pii: encryptFields(key, { ...pii, notes: [...pii.notes, ...note] }, COLLECTION),
            cvs: cvs.slice(-MAX_CVS),
            updatedAt: now,
            retainUntil: retainUntil(),
          },
        });
        for (const old of dropped) await deleteAttachment(db, old.fileId);
        return { ok: true, reference: existing.reference, positionTypes: input.positionTypes, institutions: input.institutions, cv: Boolean(cvMeta) };
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e; // changed meanwhile: read again
      }
    }
    throw new Error("registration kept conflicting");
  } catch (e) {
    console.error("registerInterest failed:", (e as Error).message);
    return { ok: false, reason: "unavailable" };
  }
}

/** Removes a registration with its CVs, then shreds the person's key (nothing else is kept under it). */
export async function eraseRegistration(db: AletheiaDB, reg: Registration & { _id: string; _rev: number }): Promise<void> {
  await shredSubjectKey(db, reg.subject); // first: from here on, every copy is unreadable
  for (const cv of reg.cvs) await deleteAttachment(db, cv.fileId);
  await registrations(db).deleteOne(reg._id, reg._rev);
}

/** Retention (docs/data-governance.md): deletes registrations past `retainUntil`. */
export async function purgeExpiredInterest(now = new Date()): Promise<{ deleted: number }> {
  const db = database();
  if (!db) return { deleted: 0 };
  let deleted = 0;
  for (;;) {
    const page = await registrations(db).find({ retainUntil: { $lt: now.toISOString() } }, { limit: 100 });
    if (!page.documents.length) break;
    for (const reg of page.documents) {
      await eraseRegistration(db, reg);
      deleted++;
    }
  }
  return { deleted };
}

export async function decryptRegistration(db: AletheiaDB, reg: Registration): Promise<Pii | null> {
  const master = masterKey();
  if (!master) return null;
  const key = await existingSubjectKey(db, master, reg.subject);
  return key ? decryptFields<Pii>(key, reg.pii, COLLECTION) : null;
}

/** A CV's decrypted bytes, or null when the registration, file or key does not exist. */
export async function readCv(reference: string, fileId: string): Promise<Buffer | null> {
  const db = database();
  const master = masterKey();
  if (!db || !master) return null;
  const reg = await registrations(db).findOne({ reference });
  const meta = reg?.cvs.find((c) => c.fileId === fileId);
  if (!reg || !meta) return null;
  const key = await existingSubjectKey(db, master, reg.subject);
  return key ? readAttachment(db, key, meta) : null;
}

export const ANY = ANY_INSTITUTION;
