// Creates the FIRST workbench administrators (brief §11): one or more email/name pairs, all
// Administrator + Reviewer, all with the same temporary password that each must change at
// first sign-in. Refuses if any administrator already exists: every later account is created
// by an administrator in the workbench.
//   BOOTSTRAP_PASSWORD='…' node --env-file=<env file> scripts/admin-bootstrap.mjs you@example.org "Your Name" [other@example.org "Other Name" …]
import { hash } from "@node-rs/argon2";
import { AletheiaDB } from "@aletheia/aletheiadb";
import { blindIndex, encryptFields, master, subjectKey } from "./lib/envelope.mjs";

const args = process.argv.slice(2);
const password = process.env.BOOTSTRAP_PASSWORD;
const people = [];
for (let i = 0; i + 1 < args.length; i += 2) people.push({ email: args[i].trim().toLowerCase(), name: args[i + 1].trim() });
if (!people.length || args.length % 2 || !password || password.length < 8 || people.some((p) => !p.email.includes("@") || !p.name)) {
  console.error('usage: BOOTSTRAP_PASSWORD=<temporary, 8+ chars> admin-bootstrap.mjs <email> "<full name>" [<email> "<full name>" …]');
  process.exit(2);
}
const db = AletheiaDB.connect(process.env.ALETHEIADB_URL).db();
const users = db.collection("staff_users");
if ((await users.count({ roles: "administrator" })) > 0) {
  console.error("Refusing: an administrator already exists. Add accounts from the workbench.");
  process.exitCode = 1;
} else {
  const m = master();
  for (const p of people) {
    // Argon2id, OWASP minimum: same parameters as src/server/auth/password.ts. Hashed per
    // person, so each account gets its own salt.
    const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 });
    const subject = blindIndex(m, "staff-person", p.email);
    const key = await subjectKey(db, m, subject);
    const user = await users.insertOne({
      emailIndex: blindIndex(m, "staff-email", p.email),
      subject,
      pii: encryptFields(key, { name: p.name, email: p.email }, "staff_users"),
      passwordHash,
      roles: ["administrator", "reviewer"],
      mustChangePassword: true,
      sessionVersion: 1,
      revokedSessions: [],
      disabled: false,
      failedSignIns: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      createdBy: "bootstrap",
      lastSignInAt: null,
    });
    await db.collection("audit_events").insertOne({
      at: new Date().toISOString(),
      actorId: null,
      action: "user.bootstrap",
      target: { type: "user", id: user._id },
      outcome: "success",
      details: { roles: "administrator,reviewer" },
    });
    console.log(`Administrator created: ${p.email} (${user._id}). Must choose a new password at first sign-in.`);
  }
}
