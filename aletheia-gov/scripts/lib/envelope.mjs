// The site's envelope encryption for operator scripts: byte-for-byte the same formats as
// src/server/crypto/envelope.ts and subject-keys.ts (tests/unit/envelope.test.ts covers the
// TypeScript side; scripts/README notes that the two must change together).
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

export function master() {
  const b64 = process.env.DATA_ENCRYPTION_MASTER_KEY;
  const key = b64 ? Buffer.from(b64, "base64") : null;
  if (!key || key.length !== 32) throw new Error("DATA_ENCRYPTION_MASTER_KEY (32 bytes, base64) is required");
  return key;
}

export function seal(key, plaintext, aad) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return { v: 1, iv: iv.toString("base64"), ct: ct.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

export function open(key, sealed, aad) {
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(sealed.ct, "base64")), d.final()]);
}

export const encryptFields = (key, fields, context) => seal(key, Buffer.from(JSON.stringify(fields)), `fields:${context}`);
export const decryptFields = (key, sealed, context) => JSON.parse(open(key, sealed, `fields:${context}`).toString("utf8"));

export function blindIndex(m, purpose, value) {
  const k = Buffer.from(hkdfSync("sha256", m, Buffer.alloc(0), `aletheiagov blind index: ${purpose}`, 32));
  return createHmac("sha256", k).update(value.normalize("NFKC").trim().toLowerCase()).digest("hex");
}

/** The subject's key, created if missing (same as subjectKeyFor in subject-keys.ts). */
export async function subjectKey(db, m, subject, { create = true } = {}) {
  const keys = db.collection("subject_keys");
  const found = await keys.findOne({ subject });
  if (found) return open(m, found.wrapped, `subject-key:${subject}`);
  if (!create) return null;
  const key = randomBytes(32);
  await keys.insertOne({ subject, wrapped: seal(m, key, `subject-key:${subject}`), createdAt: new Date().toISOString() });
  return key;
}
