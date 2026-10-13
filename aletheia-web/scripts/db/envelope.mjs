// The scripts' copy of lib/server/envelope.ts (same algorithms, same associated data), so
// records written here can be read by the site and the other way round.
import { createCipheriv, createHmac, hkdfSync, randomBytes, createDecipheriv } from 'node:crypto';

export function masterKey() {
  const key = Buffer.from(process.env.DATA_ENCRYPTION_MASTER_KEY ?? '', 'base64');
  if (key.length !== 32) {
    console.error('Set DATA_ENCRYPTION_MASTER_KEY (32 bytes, base64) — the same value the site uses.');
    process.exit(2);
  }
  return key;
}

export function seal(key, plaintext, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function open(key, sealed, aad) {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(sealed.ct, 'base64')), d.final()]);
}

export function blindIndex(master, purpose, value) {
  const key = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `aletheia-web blind index: ${purpose}`, 32));
  return createHmac('sha256', key).update(value.normalize('NFKC').trim().toLowerCase()).digest('hex');
}

/** Creates a subject key and returns it raw. */
export async function newSubjectKey(db, master, subject) {
  const key = randomBytes(32);
  await db.collection('subject_keys').insertOne({ subject, wrapped: seal(master, key, `subject-key:${subject}`), createdAt: new Date().toISOString() });
  return key;
}

export const sealFields = (key, fields, context) => seal(key, Buffer.from(JSON.stringify(fields)), `fields:${context}`);
