// Brief §14: fail if any NEXT_PUBLIC_ variable looks like a secret, or if the value
// of any server secret appears in the client bundle. Run after `next build`.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE|MASTER_KEY|DSN|CREDENTIAL|ACCESS_KEY)/i;
const SERVER_SECRETS = ["ALETHEIADB_API_KEY", "AUTH_SECRET", "DATA_ENCRYPTION_MASTER_KEY", "MAIL_API_KEY", "MAIL_SMTP_URL", "S3_SECRET_KEY", "S3_ACCESS_KEY"];

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

for (const name of Object.keys(process.env)) {
  if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name)) fail(`secret-like public variable: ${name}`);
}
for (const file of readdirSync(".").filter((f) => f.startsWith(".env"))) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const name = line.split("=")[0]?.trim() ?? "";
    if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name)) fail(`secret-like public variable in ${file}: ${name}`);
  }
}

const values = SERVER_SECRETS.map((k) => process.env[k]).filter((v) => v && v.length >= 8);
const dir = path.join(".next", "static");
if (values.length && existsSync(dir)) {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : [path.join(d, f)]));
  for (const file of walk(dir).filter((f) => /\.(js|css|html|json)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    if (values.some((v) => text.includes(v))) fail(`server secret value found in client bundle: ${file}`);
  }
}

if (failed) process.exit(1);
console.log("✓ no secret-like public variables; no server secret values in the client bundle");
