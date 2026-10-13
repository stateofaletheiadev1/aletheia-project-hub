import 'server-only';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { Doc } from '@aletheia/aletheiadb';
import type { NextRequest } from 'next/server';
import { collection } from './db';
import { fail } from './http';
import { accounts, checkUsable, recordFailure, signedIn, type StoredAccount } from './accounts';
import { audit } from './records';

// Passkeys (WebAuthn) for the portal: a person registers one from Keys & Security while signed
// in, then signs in with it alone (no ID or passphrase). The private key stays in their device
// or password manager; the server keeps the public key and a signature counter.
// Challenges are stored, single-use and valid for five minutes.

export type Passkey = {
  credentialId: string;
  accountId: string;
  publicKey: string; // base64url COSE key
  counter: number;
  transports: AuthenticatorTransportFuture[];
  label: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type Challenge = { challenge: string; purpose: 'register' | 'login'; accountId: string | null; expiresAt: string };

const passkeys = () => collection<Passkey>('passkeys');
const challenges = () => collection<Challenge>('webauthn_challenges');
const TTL_MS = 5 * 60_000;

/** The site's origin and WebAuthn relying-party ID: PUBLIC_SITE_URL if set, else the request's own. */
function relyingParty(req: NextRequest): { origin: string; rpID: string } {
  const configured = process.env.PUBLIC_SITE_URL;
  if (configured) {
    const u = new URL(configured);
    return { origin: u.origin, rpID: process.env.WEBAUTHN_RP_ID ?? u.hostname };
  }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return { origin: `${proto}://${host}`, rpID: process.env.WEBAUTHN_RP_ID ?? host.split(':')[0]! };
}

async function saveChallenge(c: Omit<Challenge, 'expiresAt'>) {
  await challenges().insertOne({ ...c, expiresAt: new Date(Date.now() + TTL_MS).toISOString() });
}

/** Finds and deletes the challenge the browser signed (from its clientDataJSON). */
async function takeChallenge(clientDataJSON: string, purpose: Challenge['purpose']): Promise<Doc<Challenge>> {
  let challenge = '';
  try {
    challenge = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')).challenge;
  } catch {
    return fail(400, 'The passkey response is malformed.');
  }
  const c = typeof challenge === 'string' && challenge.length < 200 ? await challenges().findOne({ challenge }) : null;
  if (!c || c.purpose !== purpose) return fail(400, 'This passkey request has expired. Please try again.');
  await challenges().deleteOne(c._id, c._rev).catch(() => undefined);
  if (Date.parse(c.expiresAt) < Date.now()) return fail(400, 'This passkey request has expired. Please try again.');
  return c;
}

export async function registrationOptions(req: NextRequest, account: StoredAccount) {
  const { rpID } = relyingParty(req);
  const { documents: existing } = await passkeys().find({ accountId: account._id }, { limit: 50 });
  const options = await generateRegistrationOptions({
    rpName: 'Aletheia Citizen Portal',
    rpID,
    userName: account.aletheiaId,
    userID: new TextEncoder().encode(account._id),
    attestationType: 'none',
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  await saveChallenge({ challenge: options.challenge, purpose: 'register', accountId: account._id });
  return options;
}

export async function register(req: NextRequest, account: StoredAccount, response: RegistrationResponseJSON, label: string): Promise<Doc<Passkey>> {
  const c = await takeChallenge(response?.response?.clientDataJSON, 'register');
  if (c.accountId !== account._id) return fail(400, 'This passkey request belongs to another session.');
  const { origin, rpID } = relyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  } catch (e) {
    return fail(400, `The passkey could not be verified: ${(e as Error).message}`);
  }
  if (!verification.verified || !verification.registrationInfo) return fail(400, 'The passkey could not be verified.');
  const { credential, credentialBackedUp } = verification.registrationInfo;
  const saved = await passkeys().insertOne({
    credentialId: credential.id,
    accountId: account._id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports ?? response.response.transports ?? [],
    label: label || 'Passkey',
    backedUp: credentialBackedUp,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  });
  await audit({ category: 'Security', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Passkey registered for ${account.aletheiaId}` });
  return saved;
}

export async function loginOptions(req: NextRequest) {
  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred', allowCredentials: [] });
  await saveChallenge({ challenge: options.challenge, purpose: 'login', accountId: null });
  return options;
}

export async function login(req: NextRequest, response: AuthenticationResponseJSON): Promise<StoredAccount> {
  const c = await takeChallenge(response?.response?.clientDataJSON, 'login');
  const pk = typeof response?.id === 'string' ? await passkeys().findOne({ credentialId: response.id }) : null;
  if (!pk) return fail(401, 'This passkey is not registered with the portal.');
  const account = await accounts().findById(pk.accountId);
  if (!account) return fail(401, 'This passkey is not registered with the portal.');
  checkUsable(account);
  const { origin, rpID } = relyingParty(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: pk.credentialId, publicKey: new Uint8Array(Buffer.from(pk.publicKey, 'base64url')), counter: pk.counter, transports: pk.transports },
      requireUserVerification: false,
    });
  } catch {
    verification = { verified: false } as const;
  }
  if (!verification.verified) {
    await recordFailure(account, 'passkey');
    return fail(401, 'The passkey could not be verified.');
  }
  await passkeys()
    .updateOne(pk._id, pk._rev, { $set: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() } })
    .catch(() => undefined);
  return signedIn(account);
}

export async function listPasskeys(accountId: string) {
  const { documents } = await passkeys().find({ accountId }, { sort: { createdAt: 1 }, limit: 50 });
  return documents.map((p) => ({ id: p._id, label: p.label, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt, backedUp: p.backedUp }));
}

export async function removePasskey(account: StoredAccount, id: string): Promise<void> {
  const pk = await passkeys().findById(id);
  if (!pk || pk.accountId !== account._id) return fail(404, 'No such passkey.');
  await passkeys().deleteOne(pk._id, pk._rev);
  await audit({ category: 'Security', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Passkey removed for ${account.aletheiaId}` });
}
