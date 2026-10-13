// Creates the FIRST administrator of the officer console. Refuses if an administrator already
// exists: every later officer is created by an administrator in the console (Settings).
//   BOOTSTRAP_PASSPHRASE='…12+ chars…' ALETHEIADB_URL=aletheiadb://… DATA_ENCRYPTION_MASTER_KEY=… \
//     node scripts/db/officer-bootstrap.mjs you@example.org "Your Name"
// Prints the officer ID and the authenticator (TOTP) secret: add it to an authenticator app.
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { AletheiaDB } from '@aletheia/aletheiadb';
import { blindIndex, masterKey, newSubjectKey, sealFields } from './envelope.mjs';

const [email, name] = process.argv.slice(2).map((s) => s?.trim());
const passphrase = process.env.BOOTSTRAP_PASSPHRASE ?? '';
if (!email?.includes('@') || !name || passphrase.length < 12 || !process.env.ALETHEIADB_URL) {
  console.error('usage: BOOTSTRAP_PASSPHRASE=<12+ chars> ALETHEIADB_URL=<aletheiadb://…> DATA_ENCRYPTION_MASTER_KEY=<…> officer-bootstrap.mjs <email> "<full name>"');
  process.exit(2);
}
const master = masterKey();

// Same format as lib/server/crypto.ts hashPassword().
const salt = randomBytes(16);
const key = await promisify(scrypt)(passphrase, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$32768$8$1$${salt.toString('base64')}$${key.toString('base64')}`;

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let bits = 0, value = 0, totpSecret = '';
for (const byte of randomBytes(20)) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) { totpSecret += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
}

const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const officers = db.collection('officers');
if ((await officers.count({ role: 'administrator' })) > 0) {
  console.error('Refusing: an administrator already exists. Create officers from the console.');
  process.exit(1);
}

// Officer numbers come from the same counter the console uses.
const counters = db.collection('counters');
let n;
for (;;) {
  const c = await counters.findOne({ name: 'officer' });
  try {
    if (!c) { await counters.insertOne({ name: 'officer', value: 1 }); n = 1; }
    else n = (await counters.updateOne(c._id, c._rev, { $inc: { value: 1 } })).value;
    break;
  } catch (e) {
    if (e?.code !== 'Conflict') throw e;
  }
}
const officerId = `SEC-OFFICER-${String(n).padStart(4, '0')}`;
const subject = randomUUID();
const dataKey = await newSubjectKey(db, master, subject);
const now = new Date().toISOString();
const officer = await officers.insertOne({
  officerId, subject, emailIndex: blindIndex(master, 'officer-email', email),
  pii: sealFields(dataKey, { name, email: email.toLowerCase() }, 'officers'),
  passwordHash, totpSecret, lastTotpCounter: 0,
  role: 'administrator', clearance: 'Administrator', department: 'General Secretariat of State', badgeNumber: '',
  disabled: false, failedSignIns: 0, lockedUntil: null, createdAt: now, createdBy: 'bootstrap', lastSignInAt: null,
});
await db.collection('audit_events').insertOne({
  at: now, day: now.slice(0, 10), category: 'Security', actor: 'bootstrap', actorId: null, action: `Created first administrator ${officerId}`,
  subjectAccountId: null, outcome: 'success', hash: '',
});
console.log(`Administrator created: ${officerId} (${officer._id})`);
console.log(`Authenticator secret (TOTP, SHA-1, 6 digits, 30 s): ${totpSecret}`);
console.log(`otpauth://totp/Aletheia:${officerId}?secret=${totpSecret}&issuer=Aletheia`);
