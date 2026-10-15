// Creates the collections and indexes the government platform needs (brief §20: database
// bootstrap is idempotent, non-destructive, a separate step, and logged).
// Needs an admin-role key for the target database:
//   ALETHEIADB_ADMIN_URL=aletheiadb://<id>:<secret>@db.stateofaletheia.org/gov node scripts/db-bootstrap.mjs
import { AletheiaDB } from "@aletheia/aletheiadb";

const url = process.env.ALETHEIADB_ADMIN_URL;
if (!url) {
  console.error("Set ALETHEIADB_ADMIN_URL to an admin key's aletheiadb:// connection string.");
  process.exit(2);
}
const db = AletheiaDB.connect(url).db();

const PUBLIC_RECORDS = ["opportunities", "documents", "decisions", "dispatches", "finance", "appointments", "events"];
const PLAN = [
  ...PUBLIC_RECORDS.map((c) => ({ collection: c, indexes: [["slug", true], ["reference", true], ["publication.state", false]] })),
  // First format of registrations (superseded by interest_registrations; kept empty, as
  // AletheiaDB cannot drop collections yet).
  { collection: "interest", indexes: [["dedupeKey", true], ["subject", false], ["institution", false]] },
  { collection: "interest_registrations", indexes: [["subject", true], ["reference", true], ["institutions", false], ["status", false]] },
  { collection: "attachments", indexes: [["fileId", false]] },
  { collection: "staff_users", indexes: [["emailIndex", true], ["roles", false]] },
  { collection: "audit_events", indexes: [["action", false], ["actorId", false]] },
  { collection: "subject_keys", indexes: [["subject", true]] },
  { collection: "counters", indexes: [["name", true]] },
  // Receipts of publications from the operations workbench (aletheia-ops ADR 0003).
  { collection: "publications", indexes: [["idempotencyKey", true], ["reference", false]] },
];

console.log(`bootstrap: database ${db.name}`);
for (const { collection, indexes } of PLAN) {
  const c = await db.ensureCollection(collection);
  console.log(`  ${c.created ? "created" : "exists "} collection ${collection}`);
  for (const [field, unique] of indexes) {
    const i = await db.collection(collection).createIndex(field, { unique });
    console.log(`  ${i.created ? "created" : "exists "}   index ${collection}.${field}${unique ? " (unique)" : ""}`);
  }
}
console.log("bootstrap: done");
