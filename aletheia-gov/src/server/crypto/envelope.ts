import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// Envelope encryption for personal data (brief §8.4).
//
// AletheiaDB will mirror its history to Git, and Git history is permanent, so personal
// data is encrypted here, before it is written:
//   * each person (subject) gets a random 256-bit data key;
//   * their fields are encrypted with AES-256-GCM under that key;
//   * the data key is stored only wrapped (encrypted) by the master key, which lives in the
//     server's secret store, never in the database or in Git.
// Erasure is crypto-shredding: delete the subject's wrapped key and every copy of their
// ciphertext, in any history, becomes unreadable.

const VERSION = 1;

export type Sealed = { v: number; iv: string; ct: string; tag: string };

function b64(buf: Buffer) {
  return buf.toString("base64");
}

function seal(key: Buffer, plaintext: Buffer, aad: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { v: VERSION, iv: b64(iv), ct: b64(ct), tag: b64(cipher.getAuthTag()) };
}

function open(key: Buffer, sealed: Sealed, aad: string): Buffer {
  if (sealed.v !== VERSION) throw new Error(`unsupported envelope version ${sealed.v}`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ct, "base64")), decipher.final()]);
}

export function masterKeyFrom(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("master key must be 32 bytes");
  return key;
}

/** A new subject data key, returned both raw (for immediate use) and wrapped (for storage). */
export function newSubjectKey(master: Buffer, subject: string): { key: Buffer; wrapped: Sealed } {
  const key = randomBytes(32);
  return { key, wrapped: seal(master, key, `subject-key:${subject}`) };
}

export function unwrapSubjectKey(master: Buffer, subject: string, wrapped: Sealed): Buffer {
  return open(master, wrapped, `subject-key:${subject}`);
}

/** Encrypts a JSON object. `context` (e.g. the collection) is bound to the ciphertext. */
export function encryptFields(key: Buffer, fields: Record<string, unknown>, context: string): Sealed {
  return seal(key, Buffer.from(JSON.stringify(fields)), `fields:${context}`);
}

export function decryptFields<T = Record<string, unknown>>(key: Buffer, sealed: Sealed, context: string): T {
  return JSON.parse(open(key, sealed, `fields:${context}`).toString("utf8")) as T;
}

/** Encrypts raw bytes (e.g. a file chunk). `context` binds what and where the bytes are. */
export function sealBytes(key: Buffer, bytes: Buffer, context: string): Sealed {
  return seal(key, bytes, `bytes:${context}`);
}

export function openBytes(key: Buffer, sealed: Sealed, context: string): Buffer {
  return open(key, sealed, `bytes:${context}`);
}

/**
 * A keyed, deterministic hash ("blind index") so encrypted values can still be matched,
 * e.g. to find a person's records or prevent duplicates, without storing them in clear.
 */
export function blindIndex(master: Buffer, purpose: string, value: string): string {
  const key = Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), `aletheiagov blind index: ${purpose}`, 32));
  return createHmac("sha256", key).update(value.normalize("NFKC").trim().toLowerCase()).digest("hex");
}
