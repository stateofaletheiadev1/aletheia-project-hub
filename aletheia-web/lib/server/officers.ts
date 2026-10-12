import 'server-only';
import { ConflictError, type Doc } from '@aletheia/aletheiadb';
import type { NextRequest } from 'next/server';
import { collection } from './db';
import { base32Encode, hashPassword, matchTotp, verifyPassword } from './crypto';
import { randomBytes } from 'node:crypto';
import { fail } from './http';
import { readSession } from './sessions';
import { audit, nextNumber } from './records';

// Officer accounts for the administration console. Every officer signs in with an officer ID,
// a passphrase and a six-digit code from an authenticator app (TOTP). Administrators can
// also create officers; the first administrator comes from scripts/officer-bootstrap.mjs.

export type OfficerRole = 'administrator' | 'officer';

export type Officer = {
  officerId: string;
  name: string;
  email: string;
  passwordHash: string;
  totpSecret: string;
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

export function officerView(o: StoredOfficer) {
  return {
    id: o.officerId,
    officerId: o._id,
    name: o.name,
    email: o.email,
    role: o.role === 'administrator' ? 'Administrator' : 'Registry Officer',
    isAdministrator: o.role === 'administrator',
    clearance: o.clearance,
    department: o.department,
    badgeNumber: o.badgeNumber,
    tokenType: 'Passphrase + authenticator code (TOTP)',
    disabled: o.disabled,
    lastSignInAt: o.lastSignInAt,
    createdAt: o.createdAt,
  };
}
export type OfficerView = ReturnType<typeof officerView>;

export async function createOfficer(input: {
  name: string;
  email: string;
  role: OfficerRole;
  clearance: string;
  department: string;
  badgeNumber: string;
  temporaryPassword: string;
  createdBy: string;
}): Promise<{ officer: StoredOfficer; totpSecret: string }> {
  const n = await nextNumber('officer');
  const totpSecret = base32Encode(randomBytes(20));
  try {
    const officer = await officers().insertOne({
      officerId: `SEC-OFFICER-${String(n).padStart(4, '0')}`,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.temporaryPassword),
      totpSecret,
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
    return { officer, totpSecret };
  } catch (e) {
    if (e instanceof ConflictError) fail(409, 'That officer ID is taken; please try again.');
    throw e;
  }
}

export async function checkOfficerCredentials(officerId: string, password: string, code: string): Promise<StoredOfficer> {
  const o = await officers().findOne({ officerId: officerId.trim().toUpperCase() });
  const ok = await verifyPassword(o?.passwordHash, password);
  if (!o) return fail(401, 'The officer ID, passphrase or code is not correct.');
  if (o.lockedUntil && Date.parse(o.lockedUntil) > Date.now()) return fail(423, 'This officer account is locked for 15 minutes after repeated failed sign-ins.');
  if (o.disabled) return fail(403, 'This officer account is disabled.');
  // A code is accepted once: replaying an observed code within its window is refused.
  const step = ok ? matchTotp(o.totpSecret, code) : -1;
  const codeOk = step > o.lastTotpCounter;
  if (!codeOk) {
    const failed = o.failedSignIns + 1;
    await officers()
      .updateOne(o._id, o._rev, {
        $set: { failedSignIns: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null },
      })
      .catch(() => undefined);
    await audit({ category: 'Security', actor: o.name, actorId: o._id, outcome: 'failure', action: `Failed officer sign-in for ${o.officerId}${failed >= LOCK_AFTER ? ' (account locked)' : ''}` });
    return fail(401, 'The officer ID, passphrase or code is not correct.');
  }
  return officers().updateOne(o._id, o._rev, {
    $set: { failedSignIns: 0, lockedUntil: null, lastTotpCounter: step, lastSignInAt: new Date().toISOString() },
  });
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
