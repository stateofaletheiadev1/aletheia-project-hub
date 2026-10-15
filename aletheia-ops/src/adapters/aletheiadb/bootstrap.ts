// Creates a workbench database's collections, indexes and audit chain head (ADR 0002), and
// optionally an application key. Used by scripts/db-bootstrap.ts and the end-to-end test setup.
// Needs a root key. Safe to run repeatedly.

import { AletheiaDB } from "@aletheia/aletheiadb";
import { SCHEMA } from "../schema";
import { ensureAuditHead } from "@/services/audit";
import { AletheiaDBStore } from "./aletheiadb-store";

export async function bootstrapDatabase(rootUrl: string, database: string, log: (line: string) => void = () => {}): Promise<void> {
  const client = AletheiaDB.connect(rootUrl);
  const db = client.db(database);
  const created = await db.create();
  log(`database ${database}: ${created.created ? "created" : "exists"}`);
  for (const spec of SCHEMA) {
    const c = await db.ensureCollection(spec.name, { appendOnly: spec.appendOnly });
    for (const f of spec.unique ?? []) await db.collection(spec.name).createIndex(f, { unique: true });
    for (const f of spec.indexes ?? []) await db.collection(spec.name).createIndex(f);
    log(`  ${spec.name}${spec.appendOnly ? " (append-only)" : ""}: ${c.created ? "created" : "ok"}`);
  }
  const rootForDb = rootUrl.replace(/\/[a-z][a-z0-9_-]*(\?|$)/, `/${database}$1`);
  await ensureAuditHead(new AletheiaDBStore(rootForDb));
  log("  audit chain head: ok");
}

/** Creates a readWrite key for one database and returns its aletheiadb:// connection string. */
export async function createAppKey(rootUrl: string, database: string, name: string): Promise<string> {
  const client = AletheiaDB.connect(rootUrl);
  const res = await client.request<{ key: string }>("POST", "/v1/keys", { name, database, role: "readWrite" });
  const [id, secret] = res.key.split(".");
  const u = new URL(rootUrl.replace("aletheiadb://", "https://"));
  return `aletheiadb://${id}:${secret}@${u.host}/${database}${u.search}`;
}
