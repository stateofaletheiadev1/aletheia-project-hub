import 'server-only';
import { ConflictError, type Doc } from '@aletheia/aletheiadb';
import type { NextRequest } from 'next/server';
import { collection } from './db';
import { hashPassword, verifyPassword } from './crypto';
import { fail } from './http';
import { readSession } from './sessions';
import { audit, nextReference } from './records';

// Citizen portal accounts (applicants, e-residents and citizens).

export type AccountStatus = 'registered' | 'e-resident' | 'citizen' | 'suspended';

export type Account = {
  aletheiaId: string;
  email: string;
  name: string;
  passwordHash: string;
  status: AccountStatus;
  nationality: string | null;
  dob: string | null;
  foreignPassport: string | null;
  publicKey: string | null;
  keyRotatedAt: string | null;
  residency: { validFrom: string; validUntil: string } | null;
  nationalId: string | null;
  passportNumber: string | null;
  balanceCents: number;
  /** Ids of the latest transfers debited from this account (see wallet.ts). */
  appliedDebits?: string[];
  notifyEmail: boolean;
  notifyLedger: boolean;
  failedSignIns: number;
  lockedUntil: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export type StoredAccount = Doc<Account>;

const LOCK_AFTER = 10;
const LOCK_MINUTES = 15;

export const accounts = () => collection<Account>('accounts');

const STATUS_LABEL: Record<AccountStatus, string> = {
  registered: 'Registered · Application stage',
  'e-resident': 'E-Resident · Verified',
  citizen: 'Citizen of Aletheia',
  suspended: 'Suspended',
};

export function initials(name: string): string {
  return name
    .replace(/^(dr|mr|mrs|ms|prof|capt|cmdr)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** What the portal may see about the signed-in person. */
export function accountView(a: StoredAccount) {
  return {
    id: a.aletheiaId,
    accountId: a._id,
    name: a.name,
    email: a.email,
    status: a.status,
    statusLabel: STATUS_LABEL[a.status],
    role: a.status === 'citizen' ? 'Citizen' : a.status === 'e-resident' ? 'E-Resident' : 'Applicant',
    avatarInitials: initials(a.name) || 'A',
    did: `did:aletheia:${a.aletheiaId.toLowerCase()}`,
    publicKey: a.publicKey,
    keyRotatedAt: a.keyRotatedAt,
    nationality: a.nationality,
    dob: a.dob,
    residency: a.residency,
    nationalId: a.nationalId,
    passportNumber: a.passportNumber,
    balance: a.balanceCents / 100,
    notifyEmail: a.notifyEmail,
    notifyLedger: a.notifyLedger,
    createdAt: a.createdAt,
    lastSignInAt: a.lastSignInAt,
  };
}
export type AccountView = ReturnType<typeof accountView>;

export async function registerAccount(input: { name: string; email: string; password: string }): Promise<StoredAccount> {
  const email = input.email.toLowerCase();
  if (await accounts().findOne({ email })) fail(409, 'An account with this email already exists. Sign in instead.');
  const aletheiaId = await nextReference('ALE-ID');
  try {
    return await accounts().insertOne({
      aletheiaId,
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      status: 'registered',
      nationality: null,
      dob: null,
      foreignPassport: null,
      publicKey: null,
      keyRotatedAt: null,
      residency: null,
      nationalId: null,
      passportNumber: null,
      balanceCents: 0,
      notifyEmail: true,
      notifyLedger: true,
      failedSignIns: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      lastSignInAt: null,
    });
  } catch (e) {
    if (e instanceof ConflictError) fail(409, 'An account with this email already exists. Sign in instead.');
    throw e;
  }
}

/** Finds by Aletheia ID or email; checks the passphrase with uniform timing; locks after repeated failures. */
export async function checkAccountCredentials(identifier: string, password: string): Promise<StoredAccount> {
  const id = identifier.trim();
  const a = id.includes('@') ? await accounts().findOne({ email: id.toLowerCase() }) : await accounts().findOne({ aletheiaId: id.toUpperCase() });
  const ok = await verifyPassword(a?.passwordHash, password);
  if (!a) return fail(401, 'The ID or passphrase is not correct.');
  if (a.lockedUntil && Date.parse(a.lockedUntil) > Date.now()) return fail(423, 'This account is locked for 15 minutes after repeated failed sign-ins.');
  if (a.status === 'suspended') return fail(403, 'This account is suspended. Contact the General Secretariat.');
  if (!ok) {
    const failed = a.failedSignIns + 1;
    await accounts()
      .updateOne(a._id, a._rev, {
        $set: { failedSignIns: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null },
      })
      .catch(() => undefined);
    await audit({ category: 'Security', actor: a.name, actorId: a._id, subjectAccountId: a._id, outcome: 'failure', action: `Failed portal sign-in for ${a.aletheiaId}${failed >= LOCK_AFTER ? ' (account locked)' : ''}` });
    return fail(401, 'The ID or passphrase is not correct.');
  }
  return accounts().updateOne(a._id, a._rev, { $set: { failedSignIns: 0, lockedUntil: null, lastSignInAt: new Date().toISOString() } });
}

/** The signed-in portal account, or a 401. */
export async function requireAccount(req: NextRequest): Promise<{ account: StoredAccount; sessionId: string }> {
  const s = await readSession('citizen', req);
  if (!s) return fail(401, 'Please sign in.');
  const account = await accounts().findById(s.subjectId);
  if (!account || account.status === 'suspended') return fail(401, 'Please sign in.');
  return { account, sessionId: s._id };
}
