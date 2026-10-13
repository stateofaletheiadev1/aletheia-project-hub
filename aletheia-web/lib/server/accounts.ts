import 'server-only';
import { ConflictError, type Doc } from '@aletheia/aletheiadb';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { collection } from './db';
import { hashPassword, verifyPassword } from './crypto';
import { blindIndex, ERASED, openFields, sealFields, type Sealed } from './envelope';
import { fail, retryOnConflict } from './http';
import { readSession } from './sessions';
import { audit, nextReference } from './records';

// Citizen portal accounts (applicants, e-residents and citizens). Personal details are
// encrypted under the person's own key (envelope.ts); sign-in finds the account by a blind
// index of the email, or by the Aletheia ID, which is a State-issued identifier.

export type AccountStatus = 'registered' | 'e-resident' | 'citizen' | 'suspended';

export type AccountPii = { name: string; email: string; dob: string | null; nationality: string | null; foreignPassport: string | null };
const PII = 'accounts';
const ERASED_PII: AccountPii = { name: ERASED, email: '', dob: null, nationality: null, foreignPassport: null };

export type Account = {
  aletheiaId: string;
  /** Owner of the data key that encrypts everything personal about this person. */
  subject: string;
  emailIndex: string;
  pii: Sealed;
  passwordHash: string;
  status: AccountStatus;
  publicKey: string | null;
  keyRotatedAt: string | null;
  residency: { validFrom: string; validUntil: string } | null;
  /** Citizenship granted, oath not yet taken: the national ID is reserved. */
  oathPending: { nationalId: string; grantedAt: string } | null;
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
export const emailIndex = (email: string) => blindIndex('account-email', email);

export function accountPii(a: Pick<Account, 'subject' | 'pii'>): Promise<AccountPii> {
  return openFields(a.subject, a.pii, PII, ERASED_PII);
}

export function sealAccountPii(subject: string, pii: AccountPii): Promise<Sealed> {
  return sealFields(subject, pii, PII);
}

/** Decrypts, changes and re-encrypts the personal fields of an account (retrying on conflicts). */
export async function updateAccountPii(id: string, change: Partial<AccountPii>, extra: Record<string, unknown> = {}): Promise<StoredAccount> {
  return retryOnConflict(async () => {
    const a = (await accounts().findById(id))!;
    const pii = { ...(await accountPii(a)), ...change };
    return accounts().updateOne(a._id, a._rev, { $set: { ...extra, pii: await sealAccountPii(a.subject, pii) } });
  });
}

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
export async function accountView(a: StoredAccount) {
  const pii = await accountPii(a);
  return {
    id: a.aletheiaId,
    accountId: a._id,
    name: pii.name,
    email: pii.email,
    status: a.status,
    statusLabel: a.oathPending ? 'Citizenship granted · Oath pending' : STATUS_LABEL[a.status],
    role: a.status === 'citizen' ? 'Citizen' : a.status === 'e-resident' ? 'E-Resident' : 'Applicant',
    avatarInitials: initials(pii.name) || 'A',
    did: `did:aletheia:${a.aletheiaId.toLowerCase()}`,
    publicKey: a.publicKey,
    keyRotatedAt: a.keyRotatedAt,
    nationality: pii.nationality,
    dob: pii.dob,
    residency: a.residency,
    oathPending: a.oathPending,
    nationalId: a.nationalId,
    passportNumber: a.passportNumber,
    balance: a.balanceCents / 100,
    notifyEmail: a.notifyEmail,
    notifyLedger: a.notifyLedger,
    createdAt: a.createdAt,
    lastSignInAt: a.lastSignInAt,
  };
}
export type AccountView = Awaited<ReturnType<typeof accountView>>;

/** The person's name, for records that show it (decrypted on demand). */
export async function accountName(accountId: string): Promise<string> {
  const a = await accounts().findById(accountId);
  return a ? (await accountPii(a)).name : ERASED;
}

export async function registerAccount(input: { name: string; email: string; password: string }): Promise<StoredAccount> {
  const email = input.email.toLowerCase();
  const index = emailIndex(email);
  if (await accounts().findOne({ emailIndex: index })) fail(409, 'An account with this email already exists. Sign in instead.');
  const aletheiaId = await nextReference('ALE-ID');
  const subject = randomUUID();
  try {
    return await accounts().insertOne({
      aletheiaId,
      subject,
      emailIndex: index,
      pii: await sealAccountPii(subject, { name: input.name, email, dob: null, nationality: null, foreignPassport: null }),
      passwordHash: await hashPassword(input.password),
      status: 'registered',
      publicKey: null,
      keyRotatedAt: null,
      residency: null,
      oathPending: null,
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

export async function findAccount(identifier: string): Promise<StoredAccount | null> {
  const id = identifier.trim();
  return id.includes('@') ? accounts().findOne({ emailIndex: emailIndex(id) }) : accounts().findOne({ aletheiaId: id.toUpperCase() });
}

/** Finds by Aletheia ID or email; checks the passphrase with uniform timing; locks after repeated failures. */
export async function checkAccountCredentials(identifier: string, password: string): Promise<StoredAccount> {
  const a = await findAccount(identifier);
  const ok = await verifyPassword(a?.passwordHash, password);
  if (!a) return fail(401, 'The ID or passphrase is not correct.');
  checkUsable(a);
  if (!ok) {
    await recordFailure(a, 'passphrase');
    return fail(401, 'The ID or passphrase is not correct.');
  }
  return signedIn(a);
}

/** Refuses locked and suspended accounts. */
export function checkUsable(a: StoredAccount): void {
  if (a.lockedUntil && Date.parse(a.lockedUntil) > Date.now()) fail(423, 'This account is locked for 15 minutes after repeated failed sign-ins.');
  if (a.status === 'suspended') fail(403, 'This account is suspended. Contact the General Secretariat.');
}

export async function recordFailure(a: StoredAccount, what: string): Promise<void> {
  const failed = a.failedSignIns + 1;
  await accounts()
    .updateOne(a._id, a._rev, {
      $set: { failedSignIns: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null },
    })
    .catch(() => undefined);
  await audit({ category: 'Security', actor: a.aletheiaId, actorId: a._id, subjectAccountId: a._id, outcome: 'failure', action: `Failed portal sign-in (${what}) for ${a.aletheiaId}${failed >= LOCK_AFTER ? ' (account locked)' : ''}` });
}

export async function signedIn(a: StoredAccount): Promise<StoredAccount> {
  return retryOnConflict(async () => {
    const cur = (await accounts().findById(a._id))!;
    return accounts().updateOne(cur._id, cur._rev, { $set: { failedSignIns: 0, lockedUntil: null, lastSignInAt: new Date().toISOString() } });
  });
}

/** The signed-in portal account, or a 401. */
export async function requireAccount(req: NextRequest): Promise<{ account: StoredAccount; sessionId: string }> {
  const s = await readSession('citizen', req);
  if (!s) return fail(401, 'Please sign in.');
  const account = await accounts().findById(s.subjectId);
  if (!account || account.status === 'suspended') return fail(401, 'Please sign in.');
  return { account, sessionId: s._id };
}
