// Handles a request to erase a person's data (docs/data-governance.md).
// Crypto-shreds first (deletes the person's key, so every copy of their encrypted data, in
// any history or backup, becomes unreadable), then deletes their registration and CVs.
//   node --env-file=.env.local scripts/erase-person.mjs person@example.org            (dry run)
//   node --env-file=.env.local scripts/erase-person.mjs person@example.org --confirm
import { AletheiaDB } from "@aletheia/aletheiadb";
import { blindIndex, master } from "./lib/envelope.mjs";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("usage: erase-person.mjs <email> [--confirm]");
  process.exit(2);
}
const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const subject = blindIndex(master(), "person-email", email);
const regs = db.collection("interest_registrations");
const keys = db.collection("subject_keys");
const chunks = db.collection("attachments");

const reg = await regs.findOne({ subject });
const key = await keys.findOne({ subject });
console.log(`${reg ? `Registration ${reg.reference} (${reg.institutions.length} institution(s), ${reg.cvs.length} CV(s))` : "No registration"}; ${key ? "1 key" : "no key"}.`);
if (flag !== "--confirm") {
  console.log("Dry run. Re-run with --confirm to erase.");
  process.exit(0);
}
if (key) await keys.deleteOne(key._id, key._rev);
if (reg) {
  for (const cv of reg.cvs) {
    const { documents } = await chunks.find({ fileId: cv.fileId }, { limit: 100 });
    for (const c of documents) await chunks.deleteOne(c._id, c._rev);
  }
  await regs.deleteOne(reg._id, reg._rev);
}
console.log("Erased: key destroyed, registration and CVs deleted.");
