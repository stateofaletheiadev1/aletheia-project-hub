// Erases a portal account holder by crypto-shredding: their data key is deleted, so every
// encrypted field and file of theirs (account, applications, registry entry, documents,
// notifications, wallet entries) becomes permanently unreadable, in the database and in any
// backup. Their sessions and passkeys are deleted and the account is suspended. Records the
// State must keep (references, decisions, the audit trail) remain, without the personal data.
//   ALETHEIADB_URL=aletheiadb://… node scripts/db/erase-person.mjs ALE-ID-2026-000001 --yes
import { AletheiaDB } from '@aletheia/aletheiadb';

const [aletheiaId, confirm] = process.argv.slice(2);
if (!aletheiaId || !process.env.ALETHEIADB_URL) {
  console.error('usage: ALETHEIADB_URL=<aletheiadb://…> erase-person.mjs <Aletheia ID> --yes');
  process.exit(2);
}
const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const account = await db.collection('accounts').findOne({ aletheiaId: aletheiaId.toUpperCase() });
if (!account) {
  console.error(`No account ${aletheiaId}.`);
  process.exit(1);
}
if (confirm !== '--yes') {
  console.log(`Would erase ${account.aletheiaId} (status ${account.status}). This cannot be undone. Re-run with --yes.`);
  process.exit(0);
}
const key = await db.collection('subject_keys').findOne({ subject: account.subject });
if (key) await db.collection('subject_keys').deleteOne(key._id, key._rev);
for (const coll of ['sessions', 'passkeys']) {
  const field = coll === 'sessions' ? 'subjectId' : 'accountId';
  const { documents } = await db.collection(coll).find({ [field]: account._id }, { limit: 1000 });
  for (const d of documents) await db.collection(coll).deleteOne(d._id, d._rev);
}
const fresh = await db.collection('accounts').findById(account._id);
await db.collection('accounts').updateOne(fresh._id, fresh._rev, { $set: { status: 'suspended', emailIndex: `erased:${fresh._id}`, publicKey: null } });
const now = new Date().toISOString();
await db.collection('audit_events').insertOne({ at: now, day: now.slice(0, 10), category: 'Accounts', actor: 'erasure', actorId: null, action: `Personal data of ${account.aletheiaId} erased (key shredded)`, subjectAccountId: account._id, outcome: 'success', hash: '' });
console.log(`Erased ${account.aletheiaId}: data key ${key ? 'shredded' : 'was already gone'}, account suspended.`);
