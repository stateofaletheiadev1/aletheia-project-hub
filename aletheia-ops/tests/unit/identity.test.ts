import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/adapters/memory/memory-store";
import { blindIndex, canonicalJson, open, seal } from "@/lib/crypto";
import { currentCode } from "@/lib/totp";
import { StoreConflict, StoreForbidden } from "@/ports/store";
import { ensureAuditHead, verifyChain } from "@/services/audit";
import {
  bootstrapAdministrators,
  confirmSignInEnrolment,
  finishWithoutCode,
  signInEnrolment,
  choosePassword,
  confirmAuthenticator,
  decideAccessChange,
  inviteOfficial,
  listOfficials,
  proposeAccessChange,
  Refused,
  resolveSession,
  setOfficialState,
  signInWithPassword,
  signOut,
  verifySignInCode,
  type IdentityDeps,
} from "@/services/identity/identity";

let clock = new Date("2026-10-15T09:00:00Z");
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms));
const keys = { data: Buffer.alloc(32, 1), index: Buffer.alloc(32, 2) };
let store: MemoryStore;
let deps: IdentityDeps;

beforeEach(async () => {
  clock = new Date("2026-10-15T09:00:00Z");
  store = new MemoryStore();
  deps = { store, now: () => clock, correlationId: "test", keys };
  await ensureAuditHead(store);
});

const PASSWORD = "harbour lantern quiet 2026";

/** Accepts an invitation end to end, returning a full session token. */
async function accept(token: string): Promise<string> {
  const r = await choosePassword(deps, token, PASSWORD);
  if (r.kind !== "enrol") throw new Error("expected enrolment");
  tick(31_000);
  const { sessionToken } = await confirmAuthenticator(deps, token, currentCode(r.secret, clock.getTime()), "test");
  return sessionToken;
}

async function signIn(email: string, password = PASSWORD): Promise<string> {
  const first = await signInWithPassword(deps, email, password, "test");
  if (first.kind !== "code") throw new Error(`expected a code step, got ${first.kind}`);
  const { mfaToken } = first;
  const official = (await store.findOne<{ id: string; totpSealed: string }>("officials", { emailIndex: blindIndex(keys.index, email) }))!;
  const secret = open(keys.data, official.totpSealed, `official:${official.id}:totp`);
  tick(31_000);
  return (await verifySignInCode(deps, mfaToken, currentCode(secret, clock.getTime()), "test")).sessionToken;
}

async function founders() {
  const [a, b] = await bootstrapAdministrators(deps, [
    { name: "Ada Founder", email: "ada@example.org" },
    { name: "Ben Founder", email: "ben@example.org" },
  ]);
  const sa = await resolveSession(deps, await accept(a!.token));
  const sb = await resolveSession(deps, await accept(b!.token));
  return { a: sa!, b: sb! };
}

describe("memory store semantics", () => {
  it("commits all or nothing, enforces unique and append-only", async () => {
    const [o] = await store.commit([{ op: "insert", collection: "counters", document: { name: "x", value: 1 } }]);
    await expect(
      store.commit([
        { op: "update", collection: "counters", id: o!._id, expectedRev: 1, update: { $inc: { value: 1 } } },
        { op: "insert", collection: "counters", document: { name: "x" } },
      ]),
    ).rejects.toBeInstanceOf(StoreConflict);
    expect((await store.get<{ value: number }>("counters", o!._id))!.value).toBe(1);
    const head = (await store.findOne("audit_head", { name: "head" }))!;
    await store.commit([{ op: "insert", collection: "audit_events", document: { seq: 99, id: "e" } }]);
    const ev = (await store.findOne("audit_events", { id: "e" }))!;
    await expect(store.commit([{ op: "delete", collection: "audit_events", id: ev._id, expectedRev: 1 }])).rejects.toBeInstanceOf(StoreForbidden);
    expect(head._rev).toBe(1);
  });
});

describe("crypto", () => {
  it("sealed values open only in their own context", () => {
    const s = seal(keys.data, "a@example.org", "official:1:email");
    expect(open(keys.data, s, "official:1:email")).toBe("a@example.org");
    expect(() => open(keys.data, s, "official:2:email")).toThrow();
  });
  it("canonical JSON sorts keys and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"], c: undefined })).toBe('{"a":[true,null,"x"],"b":1}');
  });
});

describe("bootstrap and invitations (E2E 1)", () => {
  it("needs two founding administrators and runs once", async () => {
    await expect(bootstrapAdministrators(deps, [{ name: "Ada Founder", email: "ada@example.org" }])).rejects.toBeInstanceOf(Refused);
    await founders();
    await expect(bootstrapAdministrators(deps, [{ name: "C Person", email: "c@example.org" }, { name: "D Person", email: "d@example.org" }])).rejects.toThrow(/already exist/);
  });

  it("an invited official chooses a password, enrols an authenticator and is signed in", async () => {
    const { a } = await founders();
    const inv = await inviteOfficial(deps, a.actor, {
      name: "Marie-Thérèse N’Diaye",
      email: "Marie@Example.org",
      grants: [{ role: "author", institution: "treasury", clearance: "internal" }],
      reason: "Founding author for the Treasury",
    });
    expect(inv.pending).toBe(0);
    await expect(choosePassword(deps, inv.token, "short")).rejects.toThrow(/at least 12/);
    await expect(choosePassword(deps, inv.token, "marie is my password")).rejects.toThrow(/email address|name/);
    const session = await resolveSession(deps, await accept(inv.token));
    expect(session?.official.state).toBe("active");
    expect(session?.actor.mfa).toBe(true);
    // The invitation cannot be used again.
    await expect(choosePassword(deps, inv.token, PASSWORD)).rejects.toThrow(/no longer valid/);
    // And signing in works with the email in any case.
    expect(await resolveSession(deps, await signIn("marie@example.org"))).not.toBeNull();
  });

  it("invitations expire after 72 hours", async () => {
    const { a } = await founders();
    const inv = await inviteOfficial(deps, a.actor, { name: "Late Person", email: "late@example.org", grants: [{ role: "author", institution: "treasury", clearance: "internal" }], reason: "test" });
    tick(73 * 3_600_000);
    await expect(choosePassword(deps, inv.token, PASSWORD)).rejects.toThrow(/no longer valid/);
  });

  it("the same email cannot be invited twice", async () => {
    const { a } = await founders();
    await expect(inviteOfficial(deps, a.actor, { name: "Ada Again", email: "ADA@example.org", grants: [{ role: "author", institution: "treasury", clearance: "internal" }], reason: "test" })).rejects.toThrow(
      /already belongs/,
    );
  });
});

describe("sign-in", () => {
  it("refuses wrong passwords and codes with one message, and locks after ten failures", async () => {
    await founders();
    const wrong = signInWithPassword(deps, "ada@example.org", "not the password at all", "t");
    const unknown = signInWithPassword(deps, "nobody@example.org", PASSWORD, "t");
    const [e1, e2] = await Promise.allSettled([wrong, unknown]);
    expect((e1 as PromiseRejectedResult).reason.message).toBe((e2 as PromiseRejectedResult).reason.message);
    for (let i = 0; i < 9; i++) await signInWithPassword(deps, "ada@example.org", "wrong wrong wrong", "t").catch(() => {});
    // Locked: even the right password is refused now.
    await expect(signInWithPassword(deps, "ada@example.org", PASSWORD, "t")).rejects.toBeInstanceOf(Refused);
    tick(16 * 60_000);
    await expect(signIn("ada@example.org")).resolves.toBeTypeOf("string");
  });

  it("a code cannot be replayed, and the password step alone is not a session", async () => {
    await founders();
    const first = await signInWithPassword(deps, "ada@example.org", PASSWORD, "t");
    if (first.kind !== "code") throw new Error("expected a code step");
    const { mfaToken } = first;
    expect(await resolveSession(deps, mfaToken)).toBeNull();
    const o = (await store.findOne<{ id: string; totpSealed: string; totpLastStep: number }>("officials", { emailIndex: blindIndex(keys.index, "ada@example.org") }))!;
    const secret = open(keys.data, o.totpSealed, `official:${o.id}:totp`);
    // A code from the time step already used at enrolment is refused, even within the drift window.
    expect(clock.getTime() - o.totpLastStep * 30_000).toBeLessThan(60_000);
    await expect(verifySignInCode(deps, mfaToken, currentCode(secret, o.totpLastStep * 30_000 + 1_000), "t")).rejects.toBeInstanceOf(Refused);
    // A fresh code is accepted.
    tick(31_000);
    await expect(verifySignInCode(deps, mfaToken, currentCode(secret, clock.getTime()), "t")).resolves.toHaveProperty("sessionToken");
  });

  it("sessions end when idle for 30 minutes and on sign-out", async () => {
    await founders();
    const t = await signIn("ada@example.org");
    tick(29 * 60_000);
    expect(await resolveSession(deps, t)).not.toBeNull();
    tick(29 * 60_000);
    expect(await resolveSession(deps, t)).not.toBeNull(); // the previous request slid the window
    tick(31 * 60_000);
    expect(await resolveSession(deps, t)).toBeNull();
    const t2 = await signIn("ada@example.org");
    await signOut(deps, t2);
    expect(await resolveSession(deps, t2)).toBeNull();
  });
});

describe("access control (E2E 19, 20)", () => {
  it("suspending an official stops their very next request", async () => {
    const { a } = await founders();
    const inv = await inviteOfficial(deps, a.actor, { name: "Tobias Aldridge", email: "tobias@example.org", grants: [{ role: "author", institution: "treasury", clearance: "internal" }], reason: "author" });
    const t = await accept(inv.token);
    expect(await resolveSession(deps, t)).not.toBeNull();
    await setOfficialState(deps, a.actor, inv.officialId, "suspended", "Left the founding team");
    expect(await resolveSession(deps, t)).toBeNull();
    await expect(signInWithPassword(deps, "tobias@example.org", PASSWORD, "t")).rejects.toBeInstanceOf(Refused);
  });

  it("nobody grants themselves a role or changes their own account", async () => {
    const { a } = await founders();
    await expect(proposeAccessChange(deps, a.actor, { kind: "grant", target: a.official.id, grant: { role: "auditor", institution: "*", clearance: "confidential" } }, "self")).rejects.toThrow(/own access/);
    await expect(setOfficialState(deps, a.actor, a.official.id, "suspended", "self")).rejects.toThrow(/own account/);
  });

  it("a privileged role needs a second administrator; the proposer cannot confirm it", async () => {
    const { a, b } = await founders();
    const inv = await inviteOfficial(deps, a.actor, {
      name: "Søren Østergaard-Ekwueme",
      email: "soren@example.org",
      grants: [
        { role: "reviewer", institution: "treasury", clearance: "restricted" },
        { role: "publishing_officer", institution: "treasury", clearance: "public" },
      ],
      reason: "Publishing officer for the Treasury",
    });
    expect(inv.pending).toBe(1);
    const t = await accept(inv.token);
    let s = (await resolveSession(deps, t))!;
    expect(s.official.grants.map((g) => g.role)).toEqual(["reviewer"]);
    const change = (await store.findOne<{ id: string }>("pending_changes", { status: "pending" }))!;
    await expect(decideAccessChange(deps, a.actor, change.id, "confirm", "")).rejects.toThrow(/different administrator/);
    await decideAccessChange(deps, b.actor, change.id, "confirm", "Agreed at the founding meeting");
    // A privilege change rotates sessions: the old session ends, a new sign-in has the role.
    expect(await resolveSession(deps, t)).toBeNull();
    s = (await resolveSession(deps, await signIn("soren@example.org")))!;
    expect(s.official.grants.map((g) => g.role).sort()).toEqual(["publishing_officer", "reviewer"]);
  });

  it("officials are listed only to those who may see them, with emails opened", async () => {
    const { a } = await founders();
    const list = await listOfficials(deps, a.actor);
    expect(list.map((o) => o.email).sort()).toEqual(["ada@example.org", "ben@example.org"]);
    expect(list.find((o) => o.id === a.official.id)?.manageable).toBe(false);
  });
});

describe("audit chain (E2E 16)", () => {
  it("records every step, verifies, and detects tampering", async () => {
    await founders();
    await signIn("ada@example.org");
    const report = await verifyChain(store);
    expect(report.ok).toBe(true);
    const actions = (await store.find<{ action: string }>("audit_events", {}, { sort: { seq: 1 }, limit: 100 })).documents.map((e) => e.action);
    expect(actions).toContain("official.bootstrap");
    expect(actions).toContain("auth.mfa_enrol");
    expect(actions.at(-1)).toBe("auth.sign_in");

    // Tamper with one event behind the store's back (as someone with file access could).
    const raw = (store as unknown as { data: Map<string, Map<string, Record<string, unknown>>> }).data.get("audit_events")!;
    const third = [...raw.values()].find((e) => e.seq === 3)!;
    third.action = "auth.sign_out";
    const after = await verifyChain(store);
    expect(after).toMatchObject({ ok: false, brokenAt: 3 });
  });

  it("a stale write fails as a whole and leaves no audit event", async () => {
    const { a } = await founders();
    const before = await store.count("audit_events");
    const official = (await store.findOne<{ id: string }>("officials", { id: a.official.id }))!;
    await expect(
      store.commit([
        { op: "insert", collection: "audit_events", document: { seq: 1000, id: "x" } },
        { op: "update", collection: "officials", id: official._id, expectedRev: official._rev - 1, update: { $set: { name: "Changed" } } },
      ]),
    ).rejects.toBeInstanceOf(StoreConflict);
    expect(await store.count("audit_events")).toBe(before);
  });
});

describe("authenticator codes switched off for a trial (ADR 0007)", () => {
  it("accepting an invitation and signing in need a password only; the official has full authority", async () => {
    const off = { ...deps, mfa: "off" as const };
    const [a, b] = await bootstrapAdministrators(off, [
      { name: "Ada Founder", email: "ada@example.org" },
      { name: "Ben Founder", email: "ben@example.org" },
    ]);
    const accepted = await choosePassword(off, a!.token, PASSWORD);
    expect(accepted.kind).toBe("signed_in");
    const session = await resolveSession(off, accepted.kind === "signed_in" ? accepted.sessionToken : "");
    expect(session?.actor.mfa).toBe(true);
    await choosePassword(off, b!.token, PASSWORD);
    const signedIn = await signInWithPassword(off, "ada@example.org", PASSWORD, "t");
    expect(signedIn.kind).toBe("signed_in");
    const events = (await store.find<{ action: string; details?: { mfa?: string } }>("audit_events", { action: "auth.sign_in" }, { limit: 10 })).documents;
    expect(events.every((e) => e.details?.mfa === "off")).toBe(true);

    // Switching codes back on: old sessions stop, and the next sign-in enrols an authenticator.
    const t = signedIn.kind === "signed_in" ? signedIn.sessionToken : "";
    expect(await resolveSession(off, t)).not.toBeNull();
    expect(await resolveSession(deps, t)).toBeNull();
    const again = await signInWithPassword(deps, "ada@example.org", PASSWORD, "t");
    expect(again.kind).toBe("enrol");
    const mfaToken = again.kind === "enrol" ? again.mfaToken : "";
    expect(await resolveSession(deps, mfaToken)).toBeNull();
    const enrolment = (await signInEnrolment(deps, mfaToken))!;
    await expect(confirmSignInEnrolment(deps, mfaToken, "000000", "t")).rejects.toBeInstanceOf(Refused);
    const { sessionToken } = await confirmSignInEnrolment(deps, mfaToken, currentCode(enrolment.secret, clock.getTime()), "t");
    expect((await resolveSession(deps, sessionToken))?.actor.mfa).toBe(true);
    // From now on, the code step applies.
    tick(31_000);
    expect((await signInWithPassword(deps, "ada@example.org", PASSWORD, "t")).kind).toBe("code");
  });
});

describe("an invitation half-finished when codes were switched off", () => {
  it("finishes with the password already chosen, without a code", async () => {
    const [a] = await bootstrapAdministrators(deps, [
      { name: "Ada Founder", email: "ada@example.org" },
      { name: "Ben Founder", email: "ben@example.org" },
    ]);
    expect((await choosePassword(deps, a!.token, PASSWORD)).kind).toBe("enrol");
    await expect(finishWithoutCode(deps, a!.token, "t")).rejects.toBeInstanceOf(Refused);
    const off = { ...deps, mfa: "off" as const };
    const { sessionToken } = await finishWithoutCode(off, a!.token, "t");
    expect((await resolveSession(off, sessionToken))?.official.state).toBe("active");
    expect((await signInWithPassword(off, "ada@example.org", PASSWORD, "t")).kind).toBe("signed_in");
  });
});
