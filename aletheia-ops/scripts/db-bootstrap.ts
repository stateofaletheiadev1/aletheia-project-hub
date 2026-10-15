// Creates the `workbench` database's collections and indexes (ADR 0002), the audit chain head,
// and, with --create-key, an application key with readWrite access. Safe to run repeatedly.
//
//   Local:      node --import ./scripts/lib/register.mjs scripts/db-bootstrap.ts --local
//   Other:      ALETHEIADB_ROOT_URL=aletheiadb://root:<secret>@db.stateofaletheia.org/workbench \
//               node --import ./scripts/lib/register.mjs scripts/db-bootstrap.ts --create-key
//
// With --local it also writes the application settings into .env.local (never committed).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AletheiaDB } from "@aletheia/aletheiadb";
import { SCHEMA } from "@/adapters/schema";
import { AletheiaDBStore } from "@/adapters/aletheiadb/aletheiadb-store";
import { ensureAuditHead } from "@/services/audit";

const root = path.resolve(import.meta.dirname, "..");
const local = process.argv.includes("--local");
const envFile = path.join(root, ".env.local");
const envText = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const read = (k: string) => new RegExp(`^${k}=(.+)$`, "m").exec(envText)?.[1]?.trim();

let rootUrl = process.env.ALETHEIADB_ROOT_URL;
if (local) {
  const secret = read("LOCAL_DB_ROOT_SECRET");
  if (!secret) throw new Error("Start the local database first: node scripts/local-db.mjs");
  rootUrl = `aletheiadb://root:${secret}@127.0.0.1:7791/workbench?tls=false`;
}
if (!rootUrl) throw new Error("Set ALETHEIADB_ROOT_URL (root key) or use --local");

const client = AletheiaDB.connect(rootUrl);
const db = client.db("workbench");
const created = await db.create();
console.log(`database workbench: ${created.created ? "created" : "exists"}`);
for (const spec of SCHEMA) {
  const c = await db.ensureCollection(spec.name, { appendOnly: spec.appendOnly });
  for (const f of spec.unique ?? []) await db.collection(spec.name).createIndex(f, { unique: true });
  for (const f of spec.indexes ?? []) await db.collection(spec.name).createIndex(f);
  console.log(`  ${spec.name}${spec.appendOnly ? " (append-only)" : ""}: ${c.created ? "created" : "ok"}`);
}
await ensureAuditHead(new AletheiaDBStore(rootUrl));
console.log("  audit chain head: ok");

if (local || process.argv.includes("--create-key")) {
  const host = new URL(rootUrl.replace("aletheiadb://", "https://")).host;
  const already = local ? read("ALETHEIADB_URL") : undefined;
  let appUrl = already;
  if (!appUrl) {
    const res = await client.request<{ key: string }>("POST", "/v1/keys", { name: `ops-${local ? "local" : "app"}-${new Date().toISOString().slice(0, 10)}`, database: "workbench", role: "readWrite" });
    const [id, secret] = res.key.split(".");
    appUrl = `aletheiadb://${id}:${secret}@${host}/workbench${local ? "?tls=false" : ""}`;
  }
  if (local) {
    const lines = envText.split(/\r?\n/).filter((l) => l && !/^(ALETHEIADB_URL|DATA_ENCRYPTION_KEY|EMAIL_INDEX_KEY|APP_BASE_URL)=/.test(l));
    lines.push(
      `ALETHEIADB_URL=${appUrl}`,
      `DATA_ENCRYPTION_KEY=${read("DATA_ENCRYPTION_KEY") ?? randomBytes(32).toString("base64")}`,
      `EMAIL_INDEX_KEY=${read("EMAIL_INDEX_KEY") ?? randomBytes(32).toString("base64")}`,
      "APP_BASE_URL=http://localhost:3300",
    );
    writeFileSync(envFile, `${lines.join("\n")}\n`);
    console.log("Wrote the application settings to .env.local (restart the dev server).");
  } else {
    console.log("Application connection string (store it in the deployment's secret settings now; it is not shown again):");
    console.log(appUrl);
  }
}
