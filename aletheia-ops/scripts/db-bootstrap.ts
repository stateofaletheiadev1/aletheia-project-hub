// Creates the `workbench` database's collections and indexes (ADR 0002), the audit chain head,
// and, with --create-key, an application key with readWrite access. Safe to run repeatedly.
//
//   Local:  node --import ./scripts/lib/register.mjs scripts/db-bootstrap.ts --local
//   Other:  ALETHEIADB_ROOT_URL=aletheiadb://root:<secret>@db.stateofaletheia.org/workbench \
//           node --import ./scripts/lib/register.mjs scripts/db-bootstrap.ts [--create-key --write-env .env.production.local]
//
// With --local it also writes the application settings into .env.local (never committed).
// --write-env writes them to the named git-ignored file instead of printing the key.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bootstrapDatabase, createAppKey } from "@/adapters/aletheiadb/bootstrap";

const root = path.resolve(import.meta.dirname, "..");
const local = process.argv.includes("--local");
const envFile = path.join(root, ".env.local");
const envText = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const read = (k: string) => new RegExp(`^${k}=(.+)$`, "m").exec(envText)?.[1]?.trim();

let rootUrl = process.env.ALETHEIADB_ROOT_URL;
if (local) {
  const secret = read("LOCAL_DB_ROOT_SECRET");
  if (!secret) throw new Error("Start the local database first: npm run db:local");
  rootUrl = `aletheiadb://root:${secret}@127.0.0.1:7791/workbench?tls=false`;
}
if (!rootUrl) throw new Error("Set ALETHEIADB_ROOT_URL (root key) or use --local");

await bootstrapDatabase(rootUrl, "workbench", console.log);

if (local) {
  const appUrl = read("ALETHEIADB_URL") ?? (await createAppKey(rootUrl, "workbench", `ops-local-${new Date().toISOString().slice(0, 10)}`));
  const lines = envText.split(/\r?\n/).filter((l) => l && !/^(ALETHEIADB_URL|DATA_ENCRYPTION_KEY|EMAIL_INDEX_KEY|APP_BASE_URL)=/.test(l));
  lines.push(
    `ALETHEIADB_URL=${appUrl}`,
    `DATA_ENCRYPTION_KEY=${read("DATA_ENCRYPTION_KEY") ?? randomBytes(32).toString("base64")}`,
    `EMAIL_INDEX_KEY=${read("EMAIL_INDEX_KEY") ?? randomBytes(32).toString("base64")}`,
    "APP_BASE_URL=http://localhost:3300",
  );
  writeFileSync(envFile, `${lines.join("\n")}\n`);
  console.log("Wrote the application settings to .env.local (restart the dev server).");
} else if (process.argv.includes("--create-key")) {
  const appUrl = await createAppKey(rootUrl, "workbench", `ops-app-${new Date().toISOString().slice(0, 10)}`);
  const at = process.argv.indexOf("--write-env");
  const target = at > 0 ? process.argv[at + 1] : undefined;
  if (target) {
    if (!/\.env[\w.-]*\.local$/.test(target)) throw new Error("--write-env must name a git-ignored .env*.local file");
    if (existsSync(target)) throw new Error(`${target} exists; refusing to overwrite it`);
    writeFileSync(
      target,
      [
        `# Created by scripts/db-bootstrap.ts on ${new Date().toISOString()}. Secret: never commit, copy into Vercel.`,
        `ALETHEIADB_URL=${appUrl}`,
        `DATA_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
        `EMAIL_INDEX_KEY=${randomBytes(32).toString("base64")}`,
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    console.log(`Application settings written to ${target} (not printed).`);
  } else {
    console.log("Application connection string (store it in the deployment's secret settings now; it is not shown again):");
    console.log(appUrl);
  }
}
