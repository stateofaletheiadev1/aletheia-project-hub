// One-off migration: registrations of interest from the first format (one record per person
// per institution, collection "interest") to one record per person covering many
// institutions ("interest_registrations"). Keeps references; re-encrypts under the same
// person key; removes the old records. Safe to re-run.
//   node --env-file=.env.local scripts/migrate-interest-v2.mjs
import { AletheiaDB } from "@aletheia/aletheiadb";
import { decryptFields, encryptFields, master, subjectKey } from "./lib/envelope.mjs";

const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const m = master();
const old = db.collection("interest");
const next = db.collection("interest_registrations");
const { documents } = await old.find({}, { sort: { submittedAt: 1 }, limit: 1000 });
console.log(`${documents.length} old registration(s) in ${db.name}`);

for (const r of documents) {
  const key = await subjectKey(db, m, r.subject, { create: false });
  if (!key) {
    console.log(`  ${r.reference}: key already shredded, removing`);
    await old.deleteOne(r._id, r._rev);
    continue;
  }
  const pii = decryptFields(key, r.pii, "interest");
  const existing = await next.findOne({ subject: r.subject });
  const notes = pii.note ? [{ text: pii.note, at: r.submittedAt }] : [];
  if (existing) {
    const merged = decryptFields(key, existing.pii, "interest_registrations");
    await next.updateOne(existing._id, existing._rev, {
      $set: {
        institutions: [...new Set([...existing.institutions, r.institution])],
        expertise: [...new Set([...existing.expertise, r.expertise])],
        pii: encryptFields(key, { ...merged, notes: [...merged.notes, ...notes] }, "interest_registrations"),
      },
    });
    console.log(`  ${r.reference}: merged into ${existing.reference}`);
  } else {
    await next.insertOne({
      reference: r.reference,
      subject: r.subject,
      institutions: [r.institution],
      expertise: [r.expertise],
      pii: encryptFields(key, { fullName: pii.fullName, email: pii.email, notes }, "interest_registrations"),
      cvs: [],
      status: "new",
      visibility: "confidential",
      source: r.source ?? "website",
      submittedAt: r.submittedAt,
      updatedAt: r.submittedAt,
      retainUntil: r.retainUntil,
    });
    console.log(`  ${r.reference}: migrated`);
  }
  await old.deleteOne(r._id, r._rev);
}
console.log("migration: done");
