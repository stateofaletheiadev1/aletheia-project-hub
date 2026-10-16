import "server-only";
import { randomUUID } from "node:crypto";
import { ConflictError, type AletheiaDB } from "@aletheia/aletheiadb";
import { database } from "@/server/aletheiadb/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { Role } from "@/server/authorization/policies";
import { blindIndex, decryptFields, encryptFields, type Sealed } from "@/server/crypto/envelope";
import { existingSubjectKey, masterKey, subjectKeyFor } from "@/server/crypto/subject-keys";
import { newTotpSecret, verifyTotp } from "@/server/auth/totp";

// Workbench accounts. Personnel data is confidential (brief §8.4): name and email are
// encrypted under the person's key; sign-in finds the account by a blind index of the email.

const COLLECTION = "staff_users";
const LOCK_AFTER = 10;
const LOCK_MINUTES = 15;
const KEEP_REVOKED = 50;

export type StaffUser = {
  emailIndex: string;
  subject: string;
  pii: Sealed;
  passwordHash: string;
  roles: Role[];
  mustChangePassword: boolean;
  sessionVersion: number;
  revokedSessions: string[];
  disabled: boolean;
  failedSignIns: number;
  lockedUntil: string | null;
  createdAt: string;
  createdBy: string;
  lastSignInAt: string | null;
  /** Optional two-step sign-in: the authenticator secret, encrypted under the person's key. */
  totp?: Sealed | null;
  /** A secret being set up, not yet confirmed with a code. */
  totpPending?: Sealed | null;
  totpLastStep?: number | null;
};

type Stored = StaffUser & { _id: string; _rev: number };
export type UserView = { id: string; name: string; email: string; roles: Role[]; disabled: boolean; mustChangePassword: boolean; twoStep: boolean; lastSignInAt: string | null; createdAt: string };

function context(): { db: AletheiaDB; master: Buffer } {
  const db = database();
  const master = masterKey();
  if (!db || !master) throw new Error("the record database or encryption key is not configured");
  return { db, master };
}

const users = (db: AletheiaDB) => db.collection<StaffUser>(COLLECTION);
const emailIndex = (master: Buffer, email: string) => blindIndex(master, "staff-email", email);

async function view(db: AletheiaDB, master: Buffer, u: Stored): Promise<UserView> {
  const key = await existingSubjectKey(db, master, u.subject);
  const pii = key ? decryptFields<{ name: string; email: string }>(key, u.pii, COLLECTION) : { name: "(erased)", email: "" };
  return { id: u._id, name: pii.name, email: pii.email, roles: u.roles, disabled: u.disabled, mustChangePassword: u.mustChangePassword, twoStep: Boolean(u.totp), lastSignInAt: u.lastSignInAt, createdAt: u.createdAt };
}

export async function getUser(id: string): Promise<Stored | null> {
  const { db } = context();
  return /^[0-9a-f]{32}$/.test(id) ? users(db).findById(id) : null;
}

export async function getUserView(id: string): Promise<UserView | null> {
  const { db, master } = context();
  const u = await getUser(id);
  return u ? view(db, master, u) : null;
}

export async function listUsers(): Promise<UserView[]> {
  const { db, master } = context();
  const { documents } = await users(db).find({}, { sort: { createdAt: 1 }, limit: 500 });
  return Promise.all(documents.map((u) => view(db, master, u)));
}

export async function countAdministrators(): Promise<number> {
  const { db } = context();
  return users(db).count({ roles: "administrator", disabled: false });
}

export async function createUser(input: { name: string; email: string; roles: Role[]; temporaryPassword: string; createdBy: string }): Promise<{ id: string } | { error: string }> {
  const { db, master } = context();
  // Staff keys are their own family ("staff-person"), never shared with a registration of
  // interest from the same email: erasing that registration must not lock the account.
  const subject = blindIndex(master, "staff-person", input.email);
  const key = await subjectKeyFor(db, master, subject);
  try {
    const u = await users(db).insertOne({
      emailIndex: emailIndex(master, input.email),
      subject,
      pii: encryptFields(key, { name: input.name, email: input.email.toLowerCase() }, COLLECTION),
      passwordHash: await hashPassword(input.temporaryPassword),
      roles: input.roles,
      mustChangePassword: true,
      sessionVersion: 1,
      revokedSessions: [],
      disabled: false,
      failedSignIns: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      lastSignInAt: null,
    });
    return { id: u._id };
  } catch (e) {
    if (e instanceof ConflictError) return { error: "An account with this email already exists." };
    throw e;
  }
}

export type SignInResult = { ok: true; user: Stored } | { ok: false; reason: "invalid" | "locked" | "disabled"; userId?: string };

/** Checks credentials with uniform timing; records failures and locks after repeated ones. */
export async function checkCredentials(email: string, password: string): Promise<SignInResult> {
  const { db, master } = context();
  const u = await users(db).findOne({ emailIndex: emailIndex(master, email) });
  const ok = await verifyPassword(u?.passwordHash ?? null, password);
  if (!u) return { ok: false, reason: "invalid" };
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return { ok: false, reason: "locked", userId: u._id };
  if (u.disabled) return { ok: false, reason: "disabled", userId: u._id };
  if (!ok) {
    const failed = u.failedSignIns + 1;
    await users(db)
      .updateOne(u._id, u._rev, {
        $set: { failedSignIns: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null },
      })
      .catch(() => undefined);
    return { ok: false, reason: "invalid", userId: u._id };
  }
  const updated = await users(db).updateOne(u._id, u._rev, { $set: { failedSignIns: 0, lockedUntil: null, lastSignInAt: new Date().toISOString() } });
  return { ok: true, user: updated };
}

async function mutate(id: string, change: (u: Stored) => Record<string, unknown>): Promise<Stored> {
  const { db } = context();
  for (let attempt = 0; attempt < 4; attempt++) {
    const u = await users(db).findById(id);
    if (!u) throw new Error("no such user");
    try {
      return await users(db).updateOne(u._id, u._rev, { $set: change(u) });
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error("user record kept changing");
}

export async function setPassword(id: string, password: string, opts: { temporary: boolean }): Promise<void> {
  const passwordHash = await hashPassword(password);
  // Changing a password signs out every other session.
  await mutate(id, (u) => ({ passwordHash, mustChangePassword: opts.temporary, sessionVersion: u.sessionVersion + 1 }));
}

export async function verifyCurrentPassword(id: string, password: string): Promise<boolean> {
  const u = await getUser(id);
  return verifyPassword(u?.passwordHash ?? null, password);
}

export async function setRoles(id: string, roles: Role[]): Promise<void> {
  await mutate(id, (u) => ({ roles, sessionVersion: u.sessionVersion + 1 }));
}

export async function setDisabled(id: string, disabled: boolean): Promise<void> {
  await mutate(id, (u) => ({ disabled, sessionVersion: u.sessionVersion + 1 }));
}

export async function signOutEverywhere(id: string): Promise<number> {
  const u = await mutate(id, (u) => ({ sessionVersion: u.sessionVersion + 1 }));
  return u.sessionVersion;
}

export async function revokeSession(id: string, sid: string): Promise<void> {
  await mutate(id, (u) => ({ revokedSessions: [...u.revokedSessions, sid].slice(-KEEP_REVOKED) }));
}

export const newSessionId = () => randomUUID();

// ------------------------------------------------------------- optional two-step sign-in
// Off until the person turns it on in Account and security; they may turn it off again at any
// time with their password. The secret is encrypted under the person's own key.

const TOTP_CONTEXT = `${COLLECTION}:totp`;

async function personKey(u: Stored): Promise<Buffer> {
  const { db, master } = context();
  const key = await existingSubjectKey(db, master, u.subject);
  if (!key) throw new Error("the account's key is missing");
  return key;
}

/** Starts setting up an authenticator: a new secret, kept pending until a code confirms it. */
export async function beginTwoStep(id: string): Promise<string> {
  const u = await getUser(id);
  if (!u) throw new Error("no such user");
  const secret = newTotpSecret();
  const sealed = encryptFields(await personKey(u), { secret }, TOTP_CONTEXT);
  await mutate(id, () => ({ totpPending: sealed }));
  return secret;
}

/** The secret being set up, if any (to redraw the QR code). */
export async function pendingTwoStep(id: string): Promise<string | null> {
  const u = await getUser(id);
  if (!u?.totpPending) return null;
  return decryptFields<{ secret: string }>(await personKey(u), u.totpPending, TOTP_CONTEXT).secret;
}

/** Confirms the pending secret with a code from the app. Signs out every other session. */
export async function confirmTwoStep(id: string, code: string): Promise<boolean> {
  const u = await getUser(id);
  if (!u?.totpPending) return false;
  const { secret } = decryptFields<{ secret: string }>(await personKey(u), u.totpPending, TOTP_CONTEXT);
  const step = verifyTotp(secret, code, null);
  if (step === null) return false;
  await mutate(id, (x) => ({ totp: x.totpPending, totpPending: null, totpLastStep: step, sessionVersion: x.sessionVersion + 1 }));
  return true;
}

export async function disableTwoStep(id: string): Promise<void> {
  await mutate(id, () => ({ totp: null, totpPending: null, totpLastStep: null }));
}

/** Checks a sign-in code; a used code cannot be used again. Repeated failures lock the account like wrong passwords. */
export async function checkTwoStepCode(id: string, code: string): Promise<boolean> {
  const u = await getUser(id);
  if (!u?.totp || u.disabled) return false;
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return false;
  const { secret } = decryptFields<{ secret: string }>(await personKey(u), u.totp, TOTP_CONTEXT);
  const step = verifyTotp(secret, code, u.totpLastStep ?? null);
  if (step === null) {
    const failed = u.failedSignIns + 1;
    await mutate(id, () => ({ failedSignIns: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null })).catch(() => undefined);
    return false;
  }
  await mutate(id, () => ({ totpLastStep: step, failedSignIns: 0, lastSignInAt: new Date().toISOString() }));
  return true;
}
