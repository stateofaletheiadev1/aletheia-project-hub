// Prepares isolated data for one end-to-end run (brief §38: tests run against isolated data):
// a fresh database in the local AletheiaDB, its schema, an application key, and a cast of
// officials created through the real services, including the two-person rule for privileged
// roles. Writes .env.e2e.local (for the test server) and tests/e2e/.state.json (for the tests).
//
//   node --import ./scripts/lib/register.mjs tests/e2e/setup.ts      (npm run e2e does this)

import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bootstrapDatabase, createAppKey } from "@/adapters/aletheiadb/bootstrap";
import { AletheiaDBStore } from "@/adapters/aletheiadb/aletheiadb-store";
import { open } from "@/lib/crypto";
import { currentCode } from "@/lib/totp";
import type { Grant } from "@/policy/roles";
import { bootstrapAdministrators, choosePassword, confirmAuthenticator, decideAccessChange, inviteOfficial, toActor, type IdentityDeps } from "@/services/identity/identity";
import type { Official, PendingChange } from "@/services/identity/types";

const root = path.resolve(import.meta.dirname, "../..");
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const secret = /^LOCAL_DB_ROOT_SECRET=(.+)$/m.exec(env)?.[1]?.trim();
if (!secret) throw new Error("Start the local database first: npm run db:local");

const database = `e2e${Date.now().toString(36)}`;
const rootUrl = `aletheiadb://root:${secret}@127.0.0.1:7791/${database}?tls=false`;
await bootstrapDatabase(rootUrl, database);
const appUrl = await createAppKey(rootUrl, database, `e2e-${database}`);
const keys = { data: randomBytes(32), index: randomBytes(32) };
const store = new AletheiaDBStore(appUrl);
const deps: IdentityDeps = { store, now: () => new Date(), correlationId: randomUUID(), keys };
const PASSWORD = "harbour lantern quiet evening";

async function official(email: string) {
  const all = await store.find<Official>("officials", {}, { limit: 100 });
  for (const o of all.documents) {
    if (open(keys.data, o.emailSealed, `official:${o.id}:email`) === email) return o;
  }
  throw new Error(`no official ${email}`);
}

async function accept(token: string): Promise<string> {
  const { secret: totp } = await choosePassword(deps, token, PASSWORD);
  await confirmAuthenticator(deps, token, currentCode(totp), "e2e setup");
  return totp;
}

const people: Record<string, { name: string; email: string; password: string; totp: string }> = {};
const [a, b, c] = await bootstrapAdministrators(deps, [
  { name: "Ada Founder", email: "ada@e2e.example" },
  { name: "Ben Founder", email: "ben@e2e.example" },
  { name: "Cleo Founder", email: "cleo@e2e.example" },
]);
people.adminA = { name: "Ada Founder", email: "ada@e2e.example", password: PASSWORD, totp: await accept(a!.token) };
people.adminB = { name: "Ben Founder", email: "ben@e2e.example", password: PASSWORD, totp: await accept(b!.token) };
const adminA = toActor(await official("ada@e2e.example"));
const adminB = toActor(await official("ben@e2e.example"));

const cast: [string, string, string, Grant[]][] = [
  ["author", "Tobias Aldridge", "tobias@e2e.example", [{ role: "author", institution: "treasury", clearance: "internal" }]],
  ["reviewer", "Ilse van der Westhuizen", "ilse@e2e.example", [{ role: "reviewer", institution: "treasury", clearance: "restricted" }]],
  ["approver", "Marie-Thérèse N’Diaye", "marie@e2e.example", [{ role: "approving_officer", institution: "treasury", clearance: "restricted" }]],
  ["publisher", "Kwame Asante-Mensah", "kwame@e2e.example", [{ role: "publishing_officer", institution: "treasury", clearance: "public" }]],
];
for (const [key, name, email, grants] of cast) {
  const inv = await inviteOfficial(deps, adminA, { name, email, grants, reason: "End-to-end test cast" });
  people[key] = { name, email, password: PASSWORD, totp: await accept(inv.token) };
}
// Privileged roles take effect only when a second administrator confirms them.
for (const p of (await store.find<PendingChange>("pending_changes", { status: "pending" }, { limit: 50 })).documents) {
  await decideAccessChange(deps, adminB, p.id, "confirm", "End-to-end test cast");
}

writeFileSync(
  path.join(root, ".env.e2e.local"),
  [
    "APP_ENV=development",
    "APP_BASE_URL=http://localhost:3310",
    `ALETHEIADB_URL=${appUrl}`,
    `DATA_ENCRYPTION_KEY=${keys.data.toString("base64")}`,
    `EMAIL_INDEX_KEY=${keys.index.toString("base64")}`,
    "PUBLICATION_MODE=development",
    "",
  ].join("\n"),
);
writeFileSync(path.join(import.meta.dirname, ".state.json"), JSON.stringify({ database, people, adminInvitation: `http://localhost:3310/invitation/${c!.token}` }, null, 2));
console.log(`E2E data ready in database ${database}: ${Object.keys(people).length} officials, one unused administrator invitation.`);
