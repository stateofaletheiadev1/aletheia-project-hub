import "server-only";
import { ConflictError, type AletheiaDB } from "@aletheia/aletheiadb";
import { env } from "@/lib/config/env";
import { masterKeyFrom, newSubjectKey, unwrapSubjectKey, type Sealed } from "./envelope";

// Per-person data keys, stored only wrapped by the master key. One key per person (subject)
// across all their records: deleting it crypto-shreds everything of theirs (brief §8.4).

type SubjectKey = { subject: string; wrapped: Sealed; createdAt: string };

export function masterKey(): Buffer | null {
  const b64 = env().DATA_ENCRYPTION_MASTER_KEY;
  return b64 ? masterKeyFrom(b64) : null;
}

/** The subject's key, creating it on first use. */
export async function subjectKeyFor(db: AletheiaDB, master: Buffer, subject: string): Promise<Buffer> {
  const keys = db.collection<SubjectKey>("subject_keys");
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await keys.findOne({ subject });
    if (existing) return unwrapSubjectKey(master, subject, existing.wrapped);
    const fresh = newSubjectKey(master, subject);
    try {
      await keys.insertOne({ subject, wrapped: fresh.wrapped, createdAt: new Date().toISOString() });
      return fresh.key;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error("could not establish a subject key");
}

/** The subject's key if it still exists; null once it has been shredded. */
export async function existingSubjectKey(db: AletheiaDB, master: Buffer, subject: string): Promise<Buffer | null> {
  const found = await db.collection<SubjectKey>("subject_keys").findOne({ subject });
  return found ? unwrapSubjectKey(master, subject, found.wrapped) : null;
}

export async function shredSubjectKey(db: AletheiaDB, subject: string): Promise<boolean> {
  const keys = db.collection<SubjectKey>("subject_keys");
  const found = await keys.findOne({ subject });
  if (!found) return false;
  await keys.deleteOne(found._id, found._rev);
  return true;
}
