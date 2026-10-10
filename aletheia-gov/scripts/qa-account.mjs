// Creates or removes a QA account for automated end-to-end testing. Demonstration databases
// only (name ending in "_demo"); never usable against the real record. The password is
// written to the file given, never printed. Every use is audited.
//   node --env-file=.env.local scripts/qa-account.mjs create <password-file> [--first-sign-in]
//   node --env-file=.env.local scripts/qa-account.mjs delete
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { AletheiaDB } from "@aletheia/aletheiadb";
import { blindIndex, encryptFields, master, subjectKey } from "./lib/envelope.mjs";

const [command, file, flag] = process.argv.slice(2);
const client = AletheiaDB.connect(process.env.ALETHEIADB_URL);
if (!client.options.database?.endsWith("_demo")) {
  console.error("Refusing: QA accounts exist only in demonstration databases.");
  process.exit(2);
}
const db = client.db();
const m = master();
const EMAIL = "qa-bot@aletheiagov.invalid";
const users = db.collection("staff_users");
const existing = await users.findOne({ emailIndex: blindIndex(m, "staff-email", EMAIL) });
const log = (action, id) => db.collection("audit_events").insertOne({ at: new Date().toISOString(), actorId: null, action, target: { type: "user", id }, outcome: "success", details: { by: "qa-account script" } });

if (command === "create") {
  if (!file) throw new Error("give a file to write the password to");
  if (existing) await users.deleteOne(existing._id, existing._rev);
  const password = randomBytes(18).toString("base64url");
  const subject = blindIndex(m, "staff-person", EMAIL);
  const key = await subjectKey(db, m, subject);
  const u = await users.insertOne({
    emailIndex: blindIndex(m, "staff-email", EMAIL),
    subject,
    pii: encryptFields(key, { name: "QA Bot (automated tests)", email: EMAIL }, "staff_users"),
    passwordHash: await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 }),
    roles: ["administrator", "reviewer"],
    mustChangePassword: flag === "--first-sign-in", // tests the first-password flow
    sessionVersion: 1,
    revokedSessions: [],
    disabled: false,
    failedSignIns: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
    createdBy: "qa-account script",
    lastSignInAt: null,
  });
  writeFileSync(file, JSON.stringify({ email: EMAIL, password }));
  await log("user.qa_create", u._id);
  console.log(`QA account created (${u._id}); credentials written to the given file.`);
} else if (command === "delete") {
  if (existing) {
    await users.deleteOne(existing._id, existing._rev);
    await log("user.qa_delete", existing._id);
  }
  console.log(existing ? "QA account deleted." : "No QA account.");
} else {
  console.error("usage: qa-account.mjs create <password-file> | delete");
  process.exitCode = 2;
}
