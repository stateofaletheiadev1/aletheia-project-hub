// Identity and access (brief §24, §25, §18.5; ADR 0004). Every function here is called on the
// server; each one checks authority itself, writes its audit events in the same commit as its
// change, and returns plain data. Messages meant for the person are in `Refused`.

import { randomUUID } from "node:crypto";
import { blindIndex, newToken, normaliseEmail, open, seal, sha256hex } from "@/lib/crypto";
import { decoyHash, hashPassword, passwordProblems, verifyPassword } from "@/lib/password";
import { newTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/time";
import { can, institutionsWhere, type Actor, type Grant } from "@/policy/roles";
import { mayConfirm, mayPropose, needsSecondAdministrator, type AccessChange } from "@/policy/two-person";
import { StoreConflict, type Doc, type DocumentStore, type Operation } from "@/ports/store";
import { commitAudited, type AuditInput, type UnitOfWork } from "../audit";
import {
  ABSOLUTE_HOURS,
  IDLE_MINUTES,
  INVITATION_HOURS,
  LOCK_AFTER_FAILURES,
  LOCK_MINUTES,
  MFA_STAGE_MINUTES,
  type Invitation,
  type Official,
  type PendingChange,
  type Session,
} from "./types";

export type IdentityDeps = UnitOfWork & {
  keys: { data: Buffer; index: Buffer };
  /**
   * "off" switches authenticator codes off for a trial (ADR 0007): sign-in is password only, and
   * nobody is asked to enrol. A production environment refuses it (lib/env.ts). Default: required.
   */
  mfa?: "required" | "off";
};

const mfaOff = (deps: { mfa?: "required" | "off" }) => deps.mfa === "off";

/** A refusal the official may read. Never says which of email, password or code was wrong. */
export class Refused extends Error {
  override name = "Refused";
}

export const SIGN_IN_REFUSED = "Those details were not accepted. Check them and try again. After repeated failures an account is locked for 15 minutes.";

const minutes = (n: number) => n * 60_000;
const OFFICIALS = "officials";
const INVITATIONS = "invitations";
const SESSIONS = "sessions";
const CHANGES = "pending_changes";

/** With codes switched off (ADR 0007) the second factor counts as satisfied; otherwise it must be enrolled. */
export function toActor(o: Official, mfaSwitchedOff = false): Actor {
  return { id: o.id, state: o.state, mfa: mfaSwitchedOff || Boolean(o.totpSealed), grants: o.grants };
}

function emailOf(deps: IdentityDeps, o: Official): string {
  return open(deps.keys.data, o.emailSealed, `official:${o.id}:email`);
}

async function officialById(store: DocumentStore, id: string): Promise<Doc<Official> | null> {
  return store.findOne<Official>(OFFICIALS, { id });
}

function sessionDoc(official: Official, stage: Session["stage"], now: Date, device: string): { token: string; doc: Session } {
  const token = newToken();
  return {
    token,
    doc: {
      id: randomUUID(),
      tokenHash: sha256hex(token),
      officialId: official.id,
      stage,
      sessionVersion: official.sessionVersion,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (stage === "mfa" ? minutes(MFA_STAGE_MINUTES) : ABSOLUTE_HOURS * 3_600_000)).toISOString(),
      revokedAt: null,
      device: device.slice(0, 120),
    },
  };
}

function newOfficial(deps: IdentityDeps, input: { name: string; email: string; grants: Grant[]; invitedBy: string | null }): Official {
  const id = randomUUID();
  return {
    id,
    name: input.name.trim(),
    emailIndex: blindIndex(deps.keys.index, input.email),
    emailSealed: seal(deps.keys.data, normaliseEmail(input.email), `official:${id}:email`),
    state: "invited",
    grants: input.grants,
    passwordHash: null,
    totpSealed: null,
    totpLastStep: null,
    failedAttempts: 0,
    lockedUntil: null,
    sessionVersion: 1,
    timezone: DEFAULT_TIMEZONE,
    density: "comfortable",
    invitedBy: input.invitedBy,
    createdAt: deps.now().toISOString(),
    activatedAt: null,
    lastSignInAt: null,
  };
}

function newInvitation(deps: IdentityDeps, officialId: string, invitedBy: string | null): { token: string; doc: Invitation } {
  const token = newToken();
  const now = deps.now();
  return {
    token,
    doc: {
      id: randomUUID(),
      tokenHash: sha256hex(token),
      officialId,
      invitedBy,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITATION_HOURS * 3_600_000).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      passwordHash: null,
      totpSealed: null,
    },
  };
}

const NAME = /^[\p{L}\p{M}][\p{L}\p{M}' ’.-]{1,119}$/u;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

function checkPerson(name: string, email: string): void {
  if (!NAME.test(name.trim())) throw new Refused("Enter the official's full name, using letters, spaces, hyphens and apostrophes.");
  if (!EMAIL.test(normaliseEmail(email))) throw new Refused("Enter a valid email address.");
}

// ---------------------------------------------------------------- bootstrap

/**
 * Creates the founding administrators, once, before any official exists. At least two are
 * required so the two-person rule can work from the start. Their administrator roles are
 * granted directly: the only grants in the system without a second administrator, recorded
 * as such in the audit register.
 */
export async function bootstrapAdministrators(deps: IdentityDeps, admins: { name: string; email: string }[]): Promise<{ name: string; token: string }[]> {
  if (admins.length < 2) throw new Refused("Name at least two founding administrators, so every privileged change can be confirmed by a second person.");
  if (new Set(admins.map((a) => normaliseEmail(a.email))).size !== admins.length) throw new Refused("Each administrator needs a different email address.");
  if ((await deps.store.count(OFFICIALS)) > 0) throw new Refused("Officials already exist. Further administrators are invited and confirmed in the workbench.");
  const ops: Operation[] = [];
  const events: AuditInput[] = [];
  const out: { name: string; token: string }[] = [];
  for (const a of admins) {
    checkPerson(a.name, a.email);
    const o = newOfficial(deps, {
      ...a,
      invitedBy: null,
      grants: [
        { role: "system_administrator", institution: "*", clearance: "internal" },
        { role: "government_administrator", institution: "*", clearance: "internal" },
      ],
    });
    const inv = newInvitation(deps, o.id, null);
    ops.push({ op: "insert", collection: OFFICIALS, document: o }, { op: "insert", collection: INVITATIONS, document: inv.doc });
    events.push({ actorId: null, action: "official.bootstrap", target: { type: "official", id: o.id }, details: { roles: "system_administrator, government_administrator" } });
    out.push({ name: o.name, token: inv.token });
  }
  await commitAudited(deps, ops, events);
  return out;
}

// ---------------------------------------------------------------- invitations

export type InviteInput = { name: string; email: string; grants: Grant[]; reason: string };

/**
 * Invites an official. Ordinary grants apply on acceptance; privileged grants become pending
 * changes that another administrator must confirm (two-person rule).
 */
export async function inviteOfficial(deps: IdentityDeps, actor: Actor, input: InviteInput): Promise<{ officialId: string; token: string; pending: number }> {
  checkPerson(input.name, input.email);
  if (input.grants.length === 0) throw new Refused("Give the official at least one role.");
  for (const g of input.grants) {
    if (!can(actor, "official.invite", { institution: g.institution === "*" ? undefined : g.institution })) {
      throw new Refused("You cannot invite officials with access to that institution.");
    }
  }
  const draft = newOfficial(deps, { name: input.name, email: input.email, grants: [], invitedBy: actor.id });
  const immediate: Grant[] = [];
  const pending: PendingChange[] = [];
  for (const g of input.grants) {
    const change: AccessChange = { kind: "grant", target: draft.id, grant: g };
    const allowed = mayPropose(actor, change);
    if (!allowed.ok) throw new Refused(allowed.reason);
    if (needsSecondAdministrator(change)) pending.push(pendingChange(deps, actor, change, input.reason));
    else immediate.push(g);
  }
  const official: Official = { ...draft, grants: immediate };
  const inv = newInvitation(deps, official.id, actor.id);
  try {
    await commitAudited(
      deps,
      [
        { op: "insert", collection: OFFICIALS, document: official },
        { op: "insert", collection: INVITATIONS, document: inv.doc },
        ...pending.map((p) => ({ op: "insert" as const, collection: CHANGES, document: p })),
      ],
      [
        { actorId: actor.id, action: "official.invite", target: { type: "official", id: official.id }, reason: input.reason, details: { grants: immediate.length, pending: pending.length } },
        ...pending.map((p) => ({ actorId: actor.id, action: "role.propose", target: { type: "official", id: official.id }, reason: input.reason, details: describeChange(p.change) })),
      ],
    );
  } catch (e) {
    if (e instanceof StoreConflict) throw new Refused("That email address already belongs to an official.");
    throw e;
  }
  return { officialId: official.id, token: inv.token, pending: pending.length };
}

export type InvitationView = { officialId: string; name: string; email: string; expiresAt: string; passwordSet: boolean };

async function liveInvitation(deps: IdentityDeps, token: string): Promise<{ inv: Doc<Invitation>; official: Doc<Official> } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const inv = await deps.store.findOne<Invitation>(INVITATIONS, { tokenHash: sha256hex(token) });
  if (!inv || inv.acceptedAt || inv.revokedAt || new Date(inv.expiresAt) <= deps.now()) return null;
  const official = await officialById(deps.store, inv.officialId);
  if (!official || official.state !== "invited") return null;
  return { inv, official };
}

export async function viewInvitation(deps: IdentityDeps, token: string): Promise<InvitationView | null> {
  const live = await liveInvitation(deps, token);
  if (!live) return null;
  return { officialId: live.official.id, name: live.official.name, email: emailOf(deps, live.official), expiresAt: live.inv.expiresAt, passwordSet: Boolean(live.inv.passwordHash) };
}

export type AcceptResult = { kind: "enrol"; secret: string; uri: string } | { kind: "signed_in"; sessionToken: string };

/**
 * Step 1 of accepting: choose a password. Returns the authenticator secret to enrol, or, with
 * codes switched off (ADR 0007), activates the account and signs in at once.
 */
export async function choosePassword(deps: IdentityDeps, token: string, password: string, device = "Browser"): Promise<AcceptResult> {
  const live = await liveInvitation(deps, token);
  if (!live) throw new Refused("This invitation is no longer valid. Ask the administrator who invited you for a new one.");
  const email = emailOf(deps, live.official);
  const problems = passwordProblems(password, email, live.official.name);
  if (problems.length) throw new Refused(problems.join(" "));
  if (mfaOff(deps)) return { kind: "signed_in", sessionToken: await activate(deps, live, await hashPassword(password), null, null, device) };
  const secret = newTotpSecret();
  await deps.store.commit([
    {
      op: "update",
      collection: INVITATIONS,
      id: live.inv._id,
      expectedRev: live.inv._rev,
      update: { $set: { passwordHash: await hashPassword(password), totpSealed: seal(deps.keys.data, secret, `invitation:${live.inv.id}:totp`) } },
    },
  ]);
  return { kind: "enrol", secret, uri: totpUri(secret, email) };
}

/**
 * With codes switched off (ADR 0007): finishes an invitation whose password was chosen while
 * codes were required. The pending authenticator secret is discarded.
 */
export async function finishWithoutCode(deps: IdentityDeps, token: string, device: string): Promise<{ sessionToken: string }> {
  if (!mfaOff(deps)) throw new Refused("An authenticator app is required. Scan the code and enter the six digits it shows.");
  const live = await liveInvitation(deps, token);
  if (!live?.inv.passwordHash) throw new Refused("This invitation is no longer valid. Ask the administrator who invited you for a new one.");
  return { sessionToken: await activate(deps, live, live.inv.passwordHash, null, null, device) };
}

/** Activates an invited official and signs them in, in one commit. */
async function activate(
  deps: IdentityDeps,
  live: { inv: Doc<Invitation>; official: Doc<Official> },
  passwordHash: string,
  secret: string | null,
  step: number | null,
  device: string,
): Promise<string> {
  const now = deps.now();
  const totpSealed = secret ? seal(deps.keys.data, secret, `official:${live.official.id}:totp`) : null;
  const activated: Official = { ...live.official, state: "active", passwordHash, totpSealed, totpLastStep: step, activatedAt: now.toISOString(), lastSignInAt: now.toISOString() };
  const s = sessionDoc(activated, "full", now, device);
  await commitAudited(
    deps,
    [
      {
        op: "update",
        collection: OFFICIALS,
        id: live.official._id,
        expectedRev: live.official._rev,
        update: { $set: { state: "active", passwordHash, totpSealed, totpLastStep: step, activatedAt: activated.activatedAt, lastSignInAt: activated.lastSignInAt } },
      },
      { op: "update", collection: INVITATIONS, id: live.inv._id, expectedRev: live.inv._rev, update: { $set: { acceptedAt: now.toISOString() }, $unset: ["passwordHash", "totpSealed"] } },
      { op: "insert", collection: SESSIONS, document: s.doc },
    ],
    [
      { actorId: activated.id, action: "official.activate", target: { type: "official", id: activated.id } },
      ...(secret ? [{ actorId: activated.id, action: "auth.mfa_enrol", target: { type: "official", id: activated.id } }] : []),
      { actorId: activated.id, action: "auth.sign_in", target: { type: "session", id: s.doc.id }, details: secret ? undefined : { mfa: "off" } },
    ],
  );
  return s.token;
}

/** The enrolment secret again, if the official reloads the page between the two steps. */
export async function pendingEnrolment(deps: IdentityDeps, token: string): Promise<{ secret: string; uri: string } | null> {
  const live = await liveInvitation(deps, token);
  if (!live?.inv.totpSealed) return null;
  const secret = open(deps.keys.data, live.inv.totpSealed, `invitation:${live.inv.id}:totp`);
  return { secret, uri: totpUri(secret, emailOf(deps, live.official)) };
}

/** Step 2: confirm the authenticator with a code. Activates the account and signs in. */
export async function confirmAuthenticator(deps: IdentityDeps, token: string, code: string, device: string): Promise<{ sessionToken: string }> {
  const live = await liveInvitation(deps, token);
  if (!live?.inv.passwordHash || !live.inv.totpSealed) throw new Refused("This invitation is no longer valid. Ask the administrator who invited you for a new one.");
  const secret = open(deps.keys.data, live.inv.totpSealed, `invitation:${live.inv.id}:totp`);
  const step = verifyTotp(secret, code, null, deps.now().getTime());
  if (step === null) throw new Refused("That code was not accepted. Enter the six digits your authenticator app shows now.");
  return { sessionToken: await activate(deps, live, live.inv.passwordHash, secret, step, device) };
}

// ---------------------------------------------------------------- sign in

async function recordFailure(deps: IdentityDeps, official: Doc<Official>, action: string): Promise<void> {
  const failures = official.failedAttempts + 1;
  const lock = failures >= LOCK_AFTER_FAILURES;
  try {
    await commitAudited(
      deps,
      [
        {
          op: "update",
          collection: OFFICIALS,
          id: official._id,
          expectedRev: official._rev,
          update: { $set: { failedAttempts: lock ? 0 : failures, lockedUntil: lock ? new Date(deps.now().getTime() + minutes(LOCK_MINUTES)).toISOString() : official.lockedUntil } },
        },
      ],
      [
        { actorId: official.id, action, outcome: "failure", target: { type: "official", id: official.id } },
        ...(lock ? [{ actorId: official.id, action: "auth.lock", outcome: "success" as const, target: { type: "official", id: official.id } }] : []),
      ],
    );
  } catch (e) {
    if (!(e instanceof StoreConflict)) throw e; // a concurrent attempt was recorded; that is enough
  }
}

function locked(o: Official, now: Date): boolean {
  return Boolean(o.lockedUntil && new Date(o.lockedUntil) > now);
}

export type SignInResult = { kind: "code"; mfaToken: string } | { kind: "enrol"; mfaToken: string } | { kind: "signed_in"; sessionToken: string };

/**
 * First factor. Next comes the authenticator code; or, for an account that has none while codes
 * are required, enrolment of one; or, with codes switched off (ADR 0007), a full session at once.
 */
export async function signInWithPassword(deps: IdentityDeps, email: string, password: string, device: string): Promise<SignInResult> {
  const official = EMAIL.test(normaliseEmail(email)) ? await deps.store.findOne<Official>(OFFICIALS, { emailIndex: blindIndex(deps.keys.index, email) }) : null;
  if (!official || !official.passwordHash) {
    await verifyPassword(await decoyHash(), password); // same work whether or not the account exists
    await commitAudited(deps, [], [{ actorId: null, action: "auth.password", outcome: "failure" }]);
    throw new Refused(SIGN_IN_REFUSED);
  }
  const ok = await verifyPassword(official.passwordHash, password);
  if (official.state !== "active" || locked(official, deps.now())) {
    await commitAudited(deps, [], [{ actorId: official.id, action: "auth.password", outcome: "denied", target: { type: "official", id: official.id }, details: { state: official.state, locked: locked(official, deps.now()) } }]);
    throw new Refused(SIGN_IN_REFUSED);
  }
  if (!ok) {
    await recordFailure(deps, official, "auth.password");
    throw new Refused(SIGN_IN_REFUSED);
  }
  const now = deps.now();
  if (mfaOff(deps)) {
    const full = sessionDoc(official, "full", now, device);
    await commitAudited(
      deps,
      [
        { op: "insert", collection: SESSIONS, document: full.doc },
        { op: "update", collection: OFFICIALS, id: official._id, expectedRev: official._rev, update: { $set: { failedAttempts: 0, lockedUntil: null, lastSignInAt: now.toISOString() } } },
      ],
      [{ actorId: official.id, action: "auth.sign_in", target: { type: "session", id: full.doc.id }, details: { mfa: "off" } }],
    );
    return { kind: "signed_in", sessionToken: full.token };
  }
  const s = sessionDoc(official, "mfa", now, device);
  // An account created while codes were off enrols an authenticator now, before anything else.
  if (!official.totpSealed) s.doc.enrolSealed = seal(deps.keys.data, newTotpSecret(), `session:${s.doc.id}:totp`);
  await commitAudited(deps, [{ op: "insert", collection: SESSIONS, document: s.doc }], [{ actorId: official.id, action: "auth.password", target: { type: "official", id: official.id } }]);
  return official.totpSealed ? { kind: "code", mfaToken: s.token } : { kind: "enrol", mfaToken: s.token };
}

async function pendingSignIn(deps: IdentityDeps, mfaToken: string): Promise<{ session: Doc<Session>; official: Doc<Official> }> {
  const session = await deps.store.findOne<Session>(SESSIONS, { tokenHash: sha256hex(mfaToken) });
  if (!session || session.stage !== "mfa" || session.revokedAt || new Date(session.expiresAt) <= deps.now()) throw new Refused("Your sign-in has expired. Start again with your email and password.");
  const official = await officialById(deps.store, session.officialId);
  if (!official || official.state !== "active" || locked(official, deps.now())) throw new Refused(SIGN_IN_REFUSED);
  return { session, official };
}

/** The authenticator to enrol during sign-in, for an account that has none (see signInWithPassword). */
export async function signInEnrolment(deps: IdentityDeps, mfaToken: string): Promise<{ secret: string; uri: string } | null> {
  try {
    const { session, official } = await pendingSignIn(deps, mfaToken);
    if (!session.enrolSealed || official.totpSealed) return null;
    const secret = open(deps.keys.data, session.enrolSealed, `session:${session.id}:totp`);
    return { secret, uri: totpUri(secret, emailOf(deps, official)) };
  } catch (e) {
    if (e instanceof Refused) return null;
    throw e;
  }
}

/** Confirms the enrolled authenticator with a code, stores it, and signs in. */
export async function confirmSignInEnrolment(deps: IdentityDeps, mfaToken: string, code: string, device: string): Promise<{ sessionToken: string }> {
  const { session, official } = await pendingSignIn(deps, mfaToken);
  if (!session.enrolSealed || official.totpSealed) throw new Refused("Your sign-in has expired. Start again with your email and password.");
  const secret = open(deps.keys.data, session.enrolSealed, `session:${session.id}:totp`);
  const now = deps.now();
  const step = verifyTotp(secret, code, null, now.getTime());
  if (step === null) {
    await recordFailure(deps, official, "auth.mfa_enrol");
    throw new Refused("That code was not accepted. Enter the six digits your authenticator app shows now.");
  }
  const s = sessionDoc(official, "full", now, device);
  await commitAudited(
    deps,
    [
      { op: "update", collection: SESSIONS, id: session._id, expectedRev: session._rev, update: { $set: { revokedAt: now.toISOString() }, $unset: ["enrolSealed"] } },
      { op: "insert", collection: SESSIONS, document: s.doc },
      {
        op: "update",
        collection: OFFICIALS,
        id: official._id,
        expectedRev: official._rev,
        update: { $set: { totpSealed: seal(deps.keys.data, secret, `official:${official.id}:totp`), totpLastStep: step, failedAttempts: 0, lockedUntil: null, lastSignInAt: now.toISOString() } },
      },
    ],
    [
      { actorId: official.id, action: "auth.mfa_enrol", target: { type: "official", id: official.id } },
      { actorId: official.id, action: "auth.sign_in", target: { type: "session", id: s.doc.id } },
    ],
  );
  return { sessionToken: s.token };
}

/** Second factor. Replaces the short-lived token with a new full session (session rotation). */
export async function verifySignInCode(deps: IdentityDeps, mfaToken: string, code: string, device: string): Promise<{ sessionToken: string }> {
  const now = deps.now();
  const pending = await deps.store.findOne<Session>(SESSIONS, { tokenHash: sha256hex(mfaToken) });
  if (!pending || pending.stage !== "mfa" || pending.revokedAt || new Date(pending.expiresAt) <= now) throw new Refused("Your sign-in has expired. Start again with your email and password.");
  const official = await officialById(deps.store, pending.officialId);
  if (!official || official.state !== "active" || !official.totpSealed || locked(official, now)) throw new Refused(SIGN_IN_REFUSED);
  const secret = open(deps.keys.data, official.totpSealed, `official:${official.id}:totp`);
  const step = verifyTotp(secret, code, official.totpLastStep, now.getTime());
  if (step === null) {
    await recordFailure(deps, official, "auth.mfa");
    throw new Refused("That code was not accepted. Enter the six digits your authenticator app shows now.");
  }
  const s = sessionDoc(official, "full", now, device);
  await commitAudited(
    deps,
    [
      { op: "update", collection: SESSIONS, id: pending._id, expectedRev: pending._rev, update: { $set: { revokedAt: now.toISOString() } } },
      { op: "insert", collection: SESSIONS, document: s.doc },
      {
        op: "update",
        collection: OFFICIALS,
        id: official._id,
        expectedRev: official._rev,
        update: { $set: { totpLastStep: step, failedAttempts: 0, lockedUntil: null, lastSignInAt: now.toISOString() } },
      },
    ],
    [{ actorId: official.id, action: "auth.sign_in", target: { type: "session", id: s.doc.id } }],
  );
  return { sessionToken: s.token };
}

export type SignedIn = { official: Doc<Official>; session: Doc<Session>; actor: Actor };

/**
 * Resolves a session cookie on every request. Suspension, revocation, a password change or a
 * role change take effect here, on the next request (brief §24).
 */
export async function resolveSession(deps: IdentityDeps, token: string | undefined): Promise<SignedIn | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const now = deps.now();
  const session = await deps.store.findOne<Session>(SESSIONS, { tokenHash: sha256hex(token) });
  if (!session || session.stage !== "full" || session.revokedAt) return null;
  if (new Date(session.expiresAt) <= now || now.getTime() - new Date(session.lastSeenAt).getTime() > minutes(IDLE_MINUTES)) return null;
  const official = await officialById(deps.store, session.officialId);
  if (!official || official.state !== "active" || official.sessionVersion !== session.sessionVersion) return null;
  // While codes are required, a session without an enrolled authenticator is not valid (ADR 0007).
  if (!official.totpSealed && !mfaOff(deps)) return null;
  let current = session;
  if (now.getTime() - new Date(session.lastSeenAt).getTime() > 60_000) {
    try {
      const [touched] = await deps.store.commit([{ op: "update", collection: SESSIONS, id: session._id, expectedRev: session._rev, update: { $set: { lastSeenAt: now.toISOString() } } }]);
      if (touched) current = touched as unknown as Doc<Session>;
    } catch (e) {
      if (!(e instanceof StoreConflict)) throw e; // a parallel request touched it first
    }
  }
  return { official, session: current, actor: toActor(official, mfaOff(deps)) };
}

export async function signOut(deps: IdentityDeps, token: string): Promise<void> {
  const session = await deps.store.findOne<Session>(SESSIONS, { tokenHash: sha256hex(token) });
  if (!session || session.revokedAt) return;
  try {
    await commitAudited(
      deps,
      [{ op: "update", collection: SESSIONS, id: session._id, expectedRev: session._rev, update: { $set: { revokedAt: deps.now().toISOString() } } }],
      [{ actorId: session.officialId, action: "auth.sign_out", target: { type: "session", id: session.id } }],
    );
  } catch (e) {
    if (!(e instanceof StoreConflict)) throw e;
  }
}

export async function listSessions(deps: IdentityDeps, officialId: string): Promise<Doc<Session>[]> {
  const now = deps.now().toISOString();
  const page = await deps.store.find<Session>(SESSIONS, { officialId, stage: "full", revokedAt: null, expiresAt: { $gt: now } }, { sort: { lastSeenAt: -1 }, limit: 50 });
  return page.documents;
}

/** Ends one session: one's own, or anyone's for an administrator who manages officials. */
export async function revokeSession(deps: IdentityDeps, signedIn: SignedIn, sessionId: string): Promise<void> {
  const session = await deps.store.findOne<Session>(SESSIONS, { id: sessionId });
  if (!session || session.revokedAt) return;
  const own = session.officialId === signedIn.official.id;
  if (!own) {
    const target = await officialById(deps.store, session.officialId);
    if (!target || !managesOfficial(signedIn.actor, target)) throw new Refused("You cannot end that session.");
  }
  await commitAudited(
    deps,
    [{ op: "update", collection: SESSIONS, id: session._id, expectedRev: session._rev, update: { $set: { revokedAt: deps.now().toISOString() } } }],
    [{ actorId: signedIn.official.id, action: "auth.session_revoke", target: { type: "session", id: session.id }, details: { own } }],
  );
}

/** Changes the password, ends every other session and starts a new one (session rotation). */
export async function changePassword(deps: IdentityDeps, signedIn: SignedIn, current: string, next: string, device: string): Promise<{ sessionToken: string }> {
  const o = signedIn.official;
  if (!o.passwordHash || !(await verifyPassword(o.passwordHash, current))) {
    await recordFailure(deps, o, "auth.password_change");
    throw new Refused("Your current password was not accepted.");
  }
  const problems = passwordProblems(next, emailOf(deps, o), o.name);
  if (problems.length) throw new Refused(problems.join(" "));
  const bumped = { ...o, sessionVersion: o.sessionVersion + 1 };
  const s = sessionDoc(bumped, "full", deps.now(), device);
  await commitAudited(
    deps,
    [
      { op: "update", collection: OFFICIALS, id: o._id, expectedRev: o._rev, update: { $set: { passwordHash: await hashPassword(next), sessionVersion: bumped.sessionVersion } } },
      { op: "insert", collection: SESSIONS, document: s.doc },
    ],
    [{ actorId: o.id, action: "auth.password_change", target: { type: "official", id: o.id } }],
  );
  return { sessionToken: s.token };
}

export async function updatePreferences(deps: IdentityDeps, signedIn: SignedIn, prefs: { timezone: string; density: "comfortable" | "compact" }): Promise<void> {
  if (!isValidTimezone(prefs.timezone)) throw new Refused("Choose a timezone from the list.");
  const o = signedIn.official;
  await commitAudited(
    deps,
    [{ op: "update", collection: OFFICIALS, id: o._id, expectedRev: o._rev, update: { $set: { timezone: prefs.timezone, density: prefs.density } } }],
    [{ actorId: o.id, action: "official.preferences", target: { type: "official", id: o.id } }],
  );
}

// ---------------------------------------------------------------- officials and access

/** Does the actor administer this official (all institutions, or every one the official is in)? */
export function managesOfficial(actor: Actor, target: Official): boolean {
  if (actor.id === target.id) return false;
  const where = institutionsWhere(actor, "official.manage");
  if (where === "*") return true;
  const theirs = new Set(target.grants.map((g) => g.institution));
  return theirs.size > 0 && !theirs.has("*") && [...theirs].every((i) => where.includes(i));
}

export function seesOfficial(actor: Actor, target: Official): boolean {
  const where = institutionsWhere(actor, "official.read");
  if (where === "*") return true;
  return target.grants.some((g) => g.institution !== "*" && where.includes(g.institution));
}

export type OfficialView = {
  id: string;
  name: string;
  email: string;
  state: Official["state"];
  grants: Grant[];
  mfa: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  manageable: boolean;
};

export async function listOfficials(deps: IdentityDeps, actor: Actor): Promise<OfficialView[]> {
  const where = institutionsWhere(actor, "official.read");
  if (where !== "*" && where.length === 0) return [];
  const page = await deps.store.find<Official>(OFFICIALS, {}, { sort: { name: 1 }, limit: 1000 });
  return page.documents.filter((o) => seesOfficial(actor, o)).map((o) => viewOf(deps, actor, o));
}

function viewOf(deps: IdentityDeps, actor: Actor, o: Official): OfficialView {
  return {
    id: o.id,
    name: o.name,
    email: emailOf(deps, o),
    state: o.state,
    grants: o.grants,
    mfa: Boolean(o.totpSealed),
    lastSignInAt: o.lastSignInAt,
    createdAt: o.createdAt,
    manageable: managesOfficial(actor, o),
  };
}

/** Suspend, reinstate or revoke. Ends every session of the official at once. */
export async function setOfficialState(deps: IdentityDeps, actor: Actor, targetId: string, state: "active" | "suspended" | "revoked", reason: string): Promise<void> {
  if (reason.trim().length < 3) throw new Refused("Give a reason. It is recorded in the audit register.");
  const target = await officialById(deps.store, targetId);
  if (!target || !seesOfficial(actor, target)) throw new Refused("No such official.");
  if (target.id === actor.id) throw new Refused("Nobody can change the state of their own account.");
  if (!managesOfficial(actor, target)) throw new Refused("You cannot manage this official.");
  const allowed: Record<string, string[]> = { active: ["suspended"], suspended: ["active", "invited"], revoked: ["active", "suspended", "invited"] };
  if (!allowed[state]?.includes(target.state)) throw new Refused(`An official who is ${target.state} cannot be made ${state}.`);
  await commitAudited(
    deps,
    [{ op: "update", collection: OFFICIALS, id: target._id, expectedRev: target._rev, update: { $set: { state, sessionVersion: target.sessionVersion + 1 } } }],
    [{ actorId: actor.id, action: `official.${state === "active" ? "reinstate" : state === "suspended" ? "suspend" : "revoke"}`, target: { type: "official", id: target.id }, reason }],
  );
}

function pendingChange(deps: IdentityDeps, actor: Actor, change: AccessChange, reason: string): PendingChange {
  return {
    id: randomUUID(),
    change,
    target: change.kind === "workflow_policy" ? "" : change.target,
    proposedBy: actor.id,
    proposedAt: deps.now().toISOString(),
    reason,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
  };
}

function describeChange(c: AccessChange): Record<string, string> {
  return c.kind === "workflow_policy" ? { kind: c.kind, register: c.register, version: String(c.version) } : { kind: c.kind, role: c.grant.role, institution: c.grant.institution, clearance: c.grant.clearance };
}

function sameGrant(a: Grant, b: Grant): boolean {
  return a.role === b.role && a.institution === b.institution && a.clearance === b.clearance;
}

function applyChange(o: Official, change: AccessChange): Grant[] {
  if (change.kind === "workflow_policy") return o.grants;
  if (change.kind === "grant") return o.grants.some((g) => sameGrant(g, change.grant)) ? o.grants : [...o.grants, change.grant];
  return o.grants.filter((g) => !sameGrant(g, change.grant));
}

/** Proposes a role change. Ordinary roles apply at once; privileged ones wait for a second administrator. */
export async function proposeAccessChange(deps: IdentityDeps, actor: Actor, change: AccessChange, reason: string): Promise<"applied" | "pending"> {
  if (reason.trim().length < 3) throw new Refused("Give a reason. It is shown to the confirming administrator and recorded.");
  const verdict = mayPropose(actor, change);
  if (!verdict.ok) throw new Refused(verdict.reason);
  if (change.kind === "workflow_policy") throw new Refused("Workflow policy changes are proposed from Workflow policies.");
  const target = await officialById(deps.store, change.target);
  if (!target || !seesOfficial(actor, target)) throw new Refused("No such official.");
  if (target.state === "revoked") throw new Refused("This official's access has been revoked.");
  if (!needsSecondAdministrator(change)) {
    await commitAudited(
      deps,
      [{ op: "update", collection: OFFICIALS, id: target._id, expectedRev: target._rev, update: { $set: { grants: applyChange(target, change), sessionVersion: target.sessionVersion + 1 } } }],
      [{ actorId: actor.id, action: change.kind === "grant" ? "role.grant" : "role.remove", target: { type: "official", id: target.id }, reason, details: describeChange(change) }],
    );
    return "applied";
  }
  const p = pendingChange(deps, actor, change, reason);
  await commitAudited(deps, [{ op: "insert", collection: CHANGES, document: p }], [{ actorId: actor.id, action: "role.propose", target: { type: "official", id: target.id }, reason, details: describeChange(change) }]);
  return "pending";
}

export async function decideAccessChange(deps: IdentityDeps, actor: Actor, changeId: string, decision: "confirm" | "reject", reason: string): Promise<void> {
  const p = await deps.store.findOne<PendingChange>(CHANGES, { id: changeId });
  if (!p || p.status !== "pending") throw new Refused("This change is no longer waiting for a decision.");
  if (decision === "reject" && reason.trim().length < 3) throw new Refused("Give a reason for rejecting the change.");
  const verdict = mayConfirm(actor, p.change, p.proposedBy);
  if (!verdict.ok) throw new Refused(verdict.reason);
  const decided = { status: decision === "confirm" ? "confirmed" : "rejected", decidedBy: actor.id, decidedAt: deps.now().toISOString(), decisionReason: reason.trim() || null };
  const ops: Operation[] = [{ op: "update", collection: CHANGES, id: p._id, expectedRev: p._rev, update: { $set: decided } }];
  if (decision === "confirm" && p.change.kind !== "workflow_policy") {
    const target = await officialById(deps.store, p.change.target);
    if (!target || target.state === "revoked") throw new Refused("The official this change was for no longer has access.");
    ops.push({ op: "update", collection: OFFICIALS, id: target._id, expectedRev: target._rev, update: { $set: { grants: applyChange(target, p.change), sessionVersion: target.sessionVersion + 1 } } });
  }
  await commitAudited(deps, ops, [
    { actorId: actor.id, action: decision === "confirm" ? "role.confirm" : "role.reject", target: { type: "official", id: p.target }, reason: reason || undefined, details: { change: p.id, proposedBy: p.proposedBy, ...describeChange(p.change) } },
  ]);
}

export async function listPendingChanges(deps: IdentityDeps, actor: Actor): Promise<Doc<PendingChange>[]> {
  const page = await deps.store.find<PendingChange>(CHANGES, { status: "pending" }, { sort: { proposedAt: 1 }, limit: 200 });
  const out: Doc<PendingChange>[] = [];
  for (const p of page.documents) {
    if (p.change.kind === "workflow_policy") {
      if (can(actor, "policy.propose") || can(actor, "policy.confirm")) out.push(p);
      continue;
    }
    const inst = p.change.grant.institution === "*" ? undefined : p.change.grant.institution;
    if (can(actor, "role.propose", { institution: inst }) || can(actor, "role.confirm", { institution: inst })) out.push(p);
  }
  return out;
}

/** One official, if the actor may see them (otherwise null, as if absent). */
export async function getOfficial(deps: IdentityDeps, actor: Actor, id: string): Promise<OfficialView | null> {
  const o = await officialById(deps.store, id);
  if (!o || (o.id !== actor.id && !seesOfficial(actor, o))) return null;
  return viewOf(deps, actor, o);
}

/** Names of officials by id, for showing who did what. Names are not secret within the workbench. */
export async function namesOf(deps: { store: DocumentStore }, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const page = await deps.store.find<Official>(OFFICIALS, { id: { $in: unique } }, { limit: unique.length });
  return new Map(page.documents.map((o) => [o.id, o.name]));
}

/** Access changes decided recently, so a decision stays visible after it is made. */
export async function listDecidedChanges(deps: IdentityDeps, actor: Actor, days = 7): Promise<Doc<PendingChange>[]> {
  const since = new Date(deps.now().getTime() - days * 86_400_000).toISOString();
  const page = await deps.store.find<PendingChange>(CHANGES, { status: { $in: ["confirmed", "rejected"] }, decidedAt: { $gte: since } }, { sort: { decidedAt: -1 }, limit: 100 });
  return page.documents.filter((p) => {
    if (p.change.kind === "workflow_policy") return can(actor, "policy.propose") || can(actor, "policy.confirm");
    const inst = p.change.grant.institution === "*" ? undefined : p.change.grant.institution;
    return can(actor, "role.propose", { institution: inst }) || can(actor, "role.confirm", { institution: inst });
  });
}
