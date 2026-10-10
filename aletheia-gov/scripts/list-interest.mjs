// Lists registrations of interest, decrypting personal fields with the server's master key.
// For operators on the server; officers use the workbench, which records every view.
//   node --env-file=.env.local scripts/list-interest.mjs
import { AletheiaDB } from "@aletheia/aletheiadb";
import { decryptFields, master, subjectKey } from "./lib/envelope.mjs";

const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const m = master();
const { documents } = await db.collection("interest_registrations").find({}, { sort: { submittedAt: 1 }, limit: 1000 });
console.log(`${documents.length} registration(s) in ${db.name}\n`);
for (const r of documents) {
  const key = await subjectKey(db, m, r.subject, { create: false });
  const pii = key ? decryptFields(key, r.pii, "interest_registrations") : { fullName: "(key destroyed: erased)", email: "", notes: [] };
  console.log(`${r.reference}   ${r.status}   received ${r.submittedAt.slice(0, 19).replace("T", " ")} UTC   delete after ${r.retainUntil.slice(0, 10)}`);
  console.log(`  name          ${pii.fullName}`);
  console.log(`  email         ${pii.email}`);
  console.log(`  institutions  ${r.institutions.join(", ")}`);
  console.log(`  expertise     ${r.expertise.join(", ")}`);
  console.log(`  CVs           ${r.cvs.length ? r.cvs.map((c) => `${(c.size / 1024).toFixed(0)} KB`).join(", ") : "none"}`);
  for (const n of pii.notes) console.log(`  note          ${n.text}`);
  console.log();
}
