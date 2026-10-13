import 'server-only';
import { ConflictError } from '@aletheia/aletheiadb';
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { collection } from './db';

// Envelope encryption for personal data, the same scheme as aletheia-gov:
//   * each person (subject) gets a random 256-bit data key;
//   * their fields and files are encrypted with AES-256-GCM under that key;
//   * the data key is stored only wrapped by the master key (DATA_ENCRYPTION_MASTER_KEY),
//     which lives in the server's secret store, never in the database.
// Erasure is crypto-shredding: delete the subject's wrapped key and every copy of their
// ciphertext, in any backup or history, becomes unreadable.

const VERSION = 1;

export type Sealed = { v: number; iv: string; ct: string; tag: string };

function seal(key: Buffer, plaintext: Buffer, aad: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { v: VERSION, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function open(key: Buffer, sealed: Sealed, aad: string): Buffer {
  if (sealed.v !== VERSION) throw new Error(`unsupported envelope version ${sealed.v}`);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ct, 'base64')), decipher.final()]);
}

export class NoMasterKeyError extends Error {
  constructor() {
    super('DATA_ENCRYPTION_MASTER_KEY is not set: personal data cannot be stored');
  }
}

let master: Buffer | null | undefined;
export function masterKey(): Buffer {
  if (master === undefined) {
    const b64 = process.env.DATA_ENCRYPTION_MASTER_KEY;
    master = b64 ? Buffer.from(b64, 'base64') : null;
    if (master && master.length !== 32) throw new Error('DATA_ENCRYPTION_MASTER_KEY must be 32 bytes, base64-encoded');
  }
  if (!master) throw new NoMasterKeyError();
  return master;
}

export function encryptionConfigured(): boolean {
  return Boolean(process.env.DATA_ENCRYPTION_MASTER_KEY);
}

/** A keyed, deterministic hash so an encrypted value (an email) can still be looked up. */
export function blindIndex(purpose: string, value: string): string {
  const key = Buffer.from(hkdfSync('sha256', masterKey(), Buffer.alloc(0), `aletheia-web blind index: ${purpose}`, 32));
  return createHmac('sha256', key).update(value.normalize('NFKC').trim().toLowerCase()).digest('hex');
}

// ---------------------------------------------------------------- subject keys

type SubjectKey = { subject: string; wrapped: Sealed; createdAt: string };
const keys = () => collection<SubjectKey>('subject_keys');

// Unwrapped keys are cached briefly so a page listing many records does not unwrap per row.
const cache = new Map<string, { key: Buffer | null; until: number }>();
const CACHE_MS = 60_000;

function remember(subject: string, key: Buffer | null) {
  if (cache.size > 5000) cache.clear();
  cache.set(subject, { key, until: Date.now() + CACHE_MS });
}

/** The subject's key, creating it on first use. */
export async function subjectKey(subject: string): Promise<Buffer> {
  const hit = cache.get(subject);
  if (hit?.key && hit.until > Date.now()) return hit.key;
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await keys().findOne({ subject });
    if (existing) {
      const key = open(masterKey(), existing.wrapped, `subject-key:${subject}`);
      remember(subject, key);
      return key;
    }
    const key = randomBytes(32);
    try {
      await keys().insertOne({ subject, wrapped: seal(masterKey(), key, `subject-key:${subject}`), createdAt: new Date().toISOString() });
      remember(subject, key);
      return key;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error('could not establish a subject key');
}

/** The subject's key if it still exists; null once it has been shredded. */
export async function existingSubjectKey(subject: string): Promise<Buffer | null> {
  const hit = cache.get(subject);
  if (hit && hit.until > Date.now()) return hit.key;
  const found = await keys().findOne({ subject });
  const key = found ? open(masterKey(), found.wrapped, `subject-key:${subject}`) : null;
  remember(subject, key);
  return key;
}

/** Crypto-shreds a person: their data stays in the database but can never be read again. */
export async function shredSubjectKey(subject: string): Promise<boolean> {
  cache.delete(subject);
  const found = await keys().findOne({ subject });
  if (!found) return false;
  await keys().deleteOne(found._id, found._rev);
  return true;
}

// ---------------------------------------------------------------- fields and bytes

export async function sealFields(subject: string, fields: Record<string, unknown>, context: string): Promise<Sealed> {
  return seal(await subjectKey(subject), Buffer.from(JSON.stringify(fields)), `fields:${context}`);
}

/** Decrypts fields; returns `erased` (with every field shown as erased) after crypto-shredding. */
export async function openFields<T extends Record<string, unknown>>(subject: string, sealed: Sealed, context: string, erased: T): Promise<T> {
  const key = await existingSubjectKey(subject);
  if (!key) return erased;
  return JSON.parse(open(key, sealed, `fields:${context}`).toString('utf8')) as T;
}

export async function sealBytes(subject: string, bytes: Buffer, context: string): Promise<Sealed> {
  return seal(await subjectKey(subject), bytes, `bytes:${context}`);
}

export async function openBytes(subject: string, sealed: Sealed, context: string): Promise<Buffer | null> {
  const key = await existingSubjectKey(subject);
  return key ? open(key, sealed, `bytes:${context}`) : null;
}

export const ERASED = '(erased)';
