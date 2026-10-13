// Switches off the authenticator code for one officer, so they sign in with username and
// password only (e.g. an officer created before the code became optional, or one who lost
// their phone). Recorded in the audit trail.
//   ALETHEIADB_URL=aletheiadb://… node scripts/db/officer-code-off.mjs SEC-OFFICER-0001
import { AletheiaDB } from '@aletheia/aletheiadb';

const officerId = process.argv[2]?.trim().toUpperCase();
if (!officerId || !process.env.ALETHEIADB_URL) {
  console.error('usage: ALETHEIADB_URL=<aletheiadb://…> officer-code-off.mjs <officer ID>');
  process.exit(2);
}
const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const officer = await db.collection('officers').findOne({ officerId });
if (!officer) {
  console.error(`No officer ${officerId}.`);
  process.exit(1);
}
await db.collection('officers').updateOne(officer._id, officer._rev, { $set: { totpSecret: null, totpPending: null, failedSignIns: 0, lockedUntil: null } });
const now = new Date().toISOString();
await db.collection('audit_events').insertOne({ at: now, day: now.slice(0, 10), category: 'Security', actor: 'operator', actorId: null, action: `Authenticator code switched off for ${officerId} (operator script)`, subjectAccountId: null, outcome: 'success', hash: '' });
console.log(`${officerId} now signs in with username and password only.`);
