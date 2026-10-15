// Runs a local AletheiaDB for development, from the binary built in ../aletheia-db
// (cargo build). Data lives in .data/aletheiadb (git-ignored). The root secret is generated once
// into .env.local as LOCAL_DB_ROOT_SECRET. Never used for staging or production.
//   node scripts/local-db.mjs
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env.local");
const text = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
let secret = /^LOCAL_DB_ROOT_SECRET=(.+)$/m.exec(text)?.[1]?.trim();
if (!secret) {
  secret = randomBytes(32).toString("base64url");
  appendFileSync(envFile, `${text && !text.endsWith("\n") ? "\n" : ""}# Local development database only (scripts/local-db.mjs)\nLOCAL_DB_ROOT_SECRET=${secret}\nLOCAL_DB_URL=http://127.0.0.1:7791\n`);
  console.log("Generated a local root secret in .env.local");
}

const exe = ["aletheiadb.exe", "aletheiadb"].map((f) => path.resolve(root, "../aletheia-db/target/debug", f)).find(existsSync);
if (!exe) {
  console.error("Build AletheiaDB first: cd ../aletheia-db && cargo build");
  process.exit(1);
}
const data = path.join(root, ".data", "aletheiadb");
mkdirSync(data, { recursive: true });
console.log(`AletheiaDB (local) on http://127.0.0.1:7791, data in ${path.relative(root, data)}`);
const child = spawn(exe, ["serve"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ALETHEIADB_LISTEN: "127.0.0.1:7791",
    ALETHEIADB_DATA_DIR: data,
    ALETHEIADB_ROOT_KEY_SHA256: createHash("sha256").update(secret).digest("hex"),
    ALETHEIADB_CACHE_MB: "32",
    RUST_LOG: "warn",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill());
