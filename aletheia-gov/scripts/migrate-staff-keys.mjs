// One-off, safe to re-run: moves workbench accounts onto their own encryption keys
// ("staff-person"), separate from the keys of registrations of interest ("person-email").
// Before this, one email shared one key, so erasing a registration would also have made a
// colleague's account unreadable.
//   node --env-file=.env.local scripts/migrate-staff-keys.mjs            (dry run)
//   node --env-file=.env.local scripts/migrate-staff-keys.mjs --confirm
import { AletheiaDB } from "@aletheia/aletheiadb";
import { blindIndex, decryptFields, encryptFields, master, subjectKey } from "./lib/envelope.mjs";

const confirm = process.argv[2] === "--confirm";
const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const m = master();
const users = db.collection("staff_users");
const keys = db.collection("subject_keys");
const regs = db.collection("interest_registrations");
const { documents } = await users.find({}, { limit: 1000 });
let moved = 0;
for (const u of documents) {
  const oldKey = await subjectKey(db, m, u.subject, { create: false });
  if (!oldKey) {
    console.log(`${u._id}: no key found, skipped`);
    continue;
  }
  const pii = decryptFields(oldKey, u.pii, "staff_users");
  const subject = blindIndex(m, "staff-person", pii.email);
  if (subject === u.subject) continue; // already moved
  moved++;
  if (!confirm) continue;
  const key = await subjectKey(db, m, subject);
  await users.updateOne(u._id, u._rev, { $set: { subject, pii: encryptFields(key, pii, "staff_users") } });
  // The old key stays only if a registration of interest still uses it.
  if (!(await regs.findOne({ subject: u.subject }))) {
    const k = await keys.findOne({ subject: u.subject });
    if (k) await keys.deleteOne(k._id, k._rev);
  }
}
console.log(`${documents.length} account(s); ${moved} ${confirm ? "moved to their own keys" : "to move (dry run; re-run with --confirm)"}.`);
