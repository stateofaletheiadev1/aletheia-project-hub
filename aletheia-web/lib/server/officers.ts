import 'server-only';
import { ConflictError, type Doc } from '@aletheia/aletheiadb';
import type { NextRequest } from 'next/server';
import { collection } from './db';
import { base32Encode, hashPassword, matchTotp, verifyPassword } from './crypto';
import { randomBytes, randomUUID } from 'node:crypto';
import { blindIndex, ERASED, openFields, sealFields, type Sealed } from './envelope';
import { fail, retryOnConflict } from './http';
import { readSession } from './sessions';
import { audit, nextNumber } from './records';

// Officer accounts for the administration console. Officers sign in with a username (their
// officer ID or email) and a passphrase. Each officer can switch on a six-digit code from an
// authenticator app (TOTP) in Settings; once on, sign-in also asks for it. Administrators
// create officers; the first administrator comes from scripts/db/officer-bootstrap.mjs.

export type OfficerRole = 'administrator' | 'officer';

// Officers' name and email are personal data, encrypted like everyone else's.
export type Officer = {
  officerId: string;
  subject: string;
  emailIndex: string;
  pii: Sealed;
  passwordHash: string;
  /** Set once the officer has switched on the authenticator code. */
  totpSecret: string | null;
  /** A secret being set up, until the officer confirms it with a first code. */
  totpPending?: string | null;
  lastTotpCounter: number;
  role: OfficerRole;
  clearance: string;
  department: string;
  badgeNumber: string;
  disabled: boolean;
  failedSignIns: number;
  lockedUntil: string | null;
  createdAt: string;
  createdBy: string;
  lastSignInAt: string | null;
};

export type StoredOfficer = Doc<Officer>;

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

export const officers = () => collection<Officer>('officers');

export async function officerPii(o: Pick<Officer, 'subject' | 'pii'>): Promise<{ name: string; email: string }> {
  return openFields(o.subject, o.pii, 'officers', { name: ERASED, email: '' });
}

export async function officerView(o: StoredOfficer) {
  const { name, email } = await officerPii(o);
  return {
    id: o.officerId,
    officerId: o._id,
    name,
    email,
    role: o.role === 'administrator' ? 'Administrator' : 'Registry Officer',
    isAdministrator: o.role === 'administrator',
    clearance: o.clearance,
    department: o.department,
    badgeNumber: o.badgeNumber,
    tokenType: o.totpSecret ? 'Passphrase + authenticator code' : 'Passphrase',
    twoStep: Boolean(o.totpSecret),
    disabled: o.disabled,
    lastSignInAt: o.lastSignInAt,
    createdAt: o.createdAt,
  };
}
export type OfficerView = Awaited<ReturnType<typeof officerView>>;

export async function createOfficer(input: {
  name: string;
  email: string;
  role: OfficerRole;
  clearance: string;
  department: string;
  badgeNumber: string;
  temporaryPassword: string;
  createdBy: string;
}): Promise<{ officer: StoredOfficer }> {
  const emailIndex = blindIndex('officer-email', input.email);
  if (await officers().findOne({ emailIndex })) fail(409, 'An officer with this email already exists.');
  const n = await nextNumber('officer');
  const subject = randomUUID();
  try {
    const officer = await officers().insertOne({
      officerId: `SEC-OFFICER-${String(n).padStart(4, '0')}`,
      subject,
      emailIndex,
      pii: await sealFields(subject, { name: input.name, email: input.email.toLowerCase() }, 'officers'),
      passwordHash: await hashPassword(input.temporaryPassword),
      totpSecret: null,
      lastTotpCounter: 0,
      role: input.role,
      clearance: input.clearance,
      department: input.department,
      badgeNumber: input.badgeNumber,
      disabled: false,
      failedSignIns: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      lastSignInAt: null,
    });
    return { officer };
  } catch (e) {
    if (e instanceof ConflictError) fail(409, 'That officer ID or email is taken; please try again.');
    throw e;
  }
}

export class CodeRequired extends Error {}

/** Username is the officer ID or the email. Asks for the authenticator code only if the officer switched it on. */
export async function checkOfficerCredentials(username: string, password: string, code: string): Promise<StoredOfficer> {
  const u = username.trim();
  const o = u.includes('@') ? await officers().findOne({ emailIndex: blindIndex('officer-email', u) }) : await officers().findOne({ officerId: u.toUpperCase() });
  const ok = await verifyPassword(o?.passwordHash, password);
  if (!o) return fail(401, 'The username or passphrase is not correct.');
  if (o.lockedUntil && Date.parse(o.lockedUntil) > Date.now()) return fail(423, 'This officer account is locked for 15 minutes after repeated failed sign-ins.');
  if (o.disabled) return fail(403, 'This officer account is disabled.');
  // Right passphrase, code switched on but not given yet: ask for it (not a failed attempt).
  if (ok && o.totpSecret && !code) throw new CodeRequired();
  // A code is accepted once: replaying an observed code within its window is refused.
  const step = ok && o.totpSecret ? matchTotp(o.totpSecret, code) : -1;
  const passed = ok && (!o.totpSecret || step > o.lastTotpCounter);
  if (!passed) {
    const failed = o.failedSignIns + 1;
    await officers()
      .updateOne(o._id, o._rev, {
        $set: { failedSignIns: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null },
      })
      .catch(() => undefined);
    await audit({ category: 'Security', actor: o.officerId, actorId: o._id, outcome: 'failure', action: `Failed officer sign-in for ${o.officerId}${failed >= LOCK_AFTER ? ' (account locked)' : ''}` });
    return fail(401, ok ? 'The authenticator code is not correct.' : 'The username or passphrase is not correct.');
  }
  return officers().updateOne(o._id, o._rev, {
    $set: { failedSignIns: 0, lockedUntil: null, ...(o.totpSecret ? { lastTotpCounter: step } : {}), lastSignInAt: new Date().toISOString() },
  });
}

/** Starts switching on the authenticator code: a new secret, kept pending until confirmed. */
export async function beginTotp(officer: StoredOfficer): Promise<{ secret: string; uri: string }> {
  const secret = base32Encode(randomBytes(20));
  await retryOnConflict(async () => {
    const cur = (await officers().findById(officer._id))!;
    await officers().updateOne(cur._id, cur._rev, { $set: { totpPending: secret } });
  });
  return { secret, uri: `otpauth://totp/Aletheia:${officer.officerId}?secret=${secret}&issuer=Aletheia` };
}

/** Confirms the pending secret with a first code from the app; from then on sign-in asks for it. */
export async function confirmTotp(officer: StoredOfficer, code: string): Promise<StoredOfficer> {
  const cur = (await officers().findById(officer._id))!;
  if (!cur.totpPending) return fail(409, 'Start setting up the authenticator first.');
  const step = matchTotp(cur.totpPending, code);
  if (step < 0) return fail(400, 'That code is not correct. Check the time on your phone and try again.');
  const updated = await officers().updateOne(cur._id, cur._rev, { $set: { totpSecret: cur.totpPending, totpPending: null, lastTotpCounter: step } });
  await audit({ category: 'Security', actor: officer.officerId, actorId: officer._id, action: `Authenticator code switched on for ${officer.officerId}` });
  return updated;
}

/** Switches the code off again (the passphrase is asked for again first). */
export async function disableTotp(officer: StoredOfficer, password: string): Promise<StoredOfficer> {
  if (!(await verifyPassword(officer.passwordHash, password))) return fail(401, 'Your passphrase is not correct.');
  const updated = await retryOnConflict(async () => {
    const cur = (await officers().findById(officer._id))!;
    return officers().updateOne(cur._id, cur._rev, { $set: { totpSecret: null, totpPending: null } });
  });
  await audit({ category: 'Security', actor: officer.officerId, actorId: officer._id, action: `Authenticator code switched off for ${officer.officerId}` });
  return updated;
}

/** The signed-in officer, or a 401; `administrator` also requires that role (403 otherwise). */
export async function requireOfficer(req: NextRequest, opts: { administrator?: boolean } = {}): Promise<{ officer: StoredOfficer; sessionId: string }> {
  const s = await readSession('officer', req);
  if (!s) return fail(401, 'Please sign in.');
  const officer = await officers().findById(s.subjectId);
  if (!officer || officer.disabled) return fail(401, 'Please sign in.');
  if (opts.administrator && officer.role !== 'administrator') return fail(403, 'Only administrators can do this.');
  return { officer, sessionId: s._id };
}

export type Settings = { name: string; sessionTimeoutMinutes: number; updatedBy: string | null };
const DEFAULT_SETTINGS = { sessionTimeoutMinutes: 30 };

export async function getSettings(): Promise<{ sessionTimeoutMinutes: number }> {
  const s = await collection<Settings>('settings').findOne({ name: 'console' });
  return { sessionTimeoutMinutes: s?.sessionTimeoutMinutes ?? DEFAULT_SETTINGS.sessionTimeoutMinutes };
}

export async function saveSettings(input: { sessionTimeoutMinutes: number }, by: string): Promise<void> {
  const settings = collection<Settings>('settings');
  const s = await settings.findOne({ name: 'console' });
  if (s) await settings.updateOne(s._id, s._rev, { $set: { sessionTimeoutMinutes: input.sessionTimeoutMinutes, updatedBy: by } });
  else await settings.insertOne({ name: 'console', sessionTimeoutMinutes: input.sessionTimeoutMinutes, updatedBy: by });
}

/** Disables or re-enables an officer. An administrator cannot disable themselves or the last administrator. */
export async function setOfficerDisabled(officerId: string, disabled: boolean, by: StoredOfficer): Promise<StoredOfficer> {
  const target = await officers().findOne({ officerId: officerId.toUpperCase() });
  if (!target) return fail(404, 'No such officer.');
  if (disabled && target._id === by._id) return fail(400, 'You cannot disable your own account.');
  if (disabled && target.role === 'administrator' && (await officers().count({ role: 'administrator', disabled: false })) <= 1) {
    return fail(400, 'The last active administrator cannot be disabled.');
  }
  const updated = await retryOnConflict(async () => {
    const cur = (await officers().findById(target._id))!;
    return officers().updateOne(cur._id, cur._rev, { $set: { disabled } });
  });
  await audit({ category: 'Security', actor: by.officerId, actorId: by._id, action: `${disabled ? 'Disabled' : 'Re-enabled'} officer ${target.officerId}` });
  return updated;
}
