// Creates the collections and indexes the portal and administration need. Idempotent and
// non-destructive: run it once per database, and again after the schema grows.
// Needs an admin-role key for the target database:
//   ALETHEIADB_ADMIN_URL=aletheiadb://<id>:<secret>@db.stateofaletheia.org/web npm run db:bootstrap
import fs from 'node:fs';
import { AletheiaDB } from '@aletheia/aletheiadb';

const url = process.env.ALETHEIADB_ADMIN_URL;
if (!url) {
  console.error("Set ALETHEIADB_ADMIN_URL to an admin key's aletheiadb:// connection string.");
  process.exit(2);
}
const schema = JSON.parse(fs.readFileSync(new URL('../../lib/server/schema.json', import.meta.url), 'utf8'));
const db = AletheiaDB.connect(url).db();

console.log(`bootstrap: database ${db.name}`);
for (const [collection, indexes] of Object.entries(schema)) {
  const c = await db.ensureCollection(collection);
  console.log(`  ${c.created ? 'created' : 'exists '} collection ${collection}`);
  for (const [field, unique] of indexes) {
    const i = await db.collection(collection).createIndex(field, { unique });
    console.log(`  ${i.created ? 'created' : 'exists '}   index ${collection}.${field}${unique ? ' (unique)' : ''}`);
  }
}
console.log('bootstrap: done');
