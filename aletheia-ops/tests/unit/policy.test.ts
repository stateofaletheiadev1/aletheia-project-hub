import { describe, expect, it } from "vitest";
import { can, canSee, clearanceIn, institutionsWhere, PERMISSIONS, ROLE_INFO, ROLES, type Actor, type Role } from "@/policy/roles";
import { mayConfirm, mayPropose, needsSecondAdministrator, type AccessChange } from "@/policy/two-person";

const actor = (id: string, role: Role, institution = "treasury", clearance: "public" | "internal" | "restricted" | "confidential" = "restricted"): Actor => ({
  id,
  state: "active",
  mfa: true,
  grants: [{ role, institution, clearance }],
});

describe("can()", () => {
  it("denies by default", () => {
    expect(can(null, "record.read")).toBe(false);
    expect(can({ id: "a", state: "active", mfa: true, grants: [] }, "record.read", { institution: "treasury" })).toBe(false);
  });

  // Table-driven from the role definitions: each role has exactly its listed permissions.
  it.each(ROLES)("%s holds exactly its permissions in its own institution", (role) => {
    const a = actor("a", role, "treasury", "confidential");
    for (const p of PERMISSIONS) {
      expect(can(a, p, { institution: "treasury" }), `${role} ${p}`).toBe(ROLE_INFO[role].grants.includes(p));
    }
  });

  it("an institution-scoped grant does not reach another institution", () => {
    const a = actor("a", "approving_officer");
    expect(can(a, "record.approve", { institution: "treasury" })).toBe(true);
    expect(can(a, "record.approve", { institution: "electoral-commission" })).toBe(false);
  });

  it("an institution-scoped grant does not act government-wide", () => {
    expect(can(actor("a", "institutional_administrator"), "role.propose")).toBe(false);
    expect(can(actor("a", "government_administrator", "*"), "role.propose")).toBe(true);
  });

  it("clearance limits classification", () => {
    const a = actor("a", "reviewer", "treasury", "internal");
    expect(can(a, "record.read", { institution: "treasury", classification: "internal" })).toBe(true);
    expect(can(a, "record.read", { institution: "treasury", classification: "restricted" })).toBe(false);
    expect(canSee(a, { institution: "treasury", classification: "restricted" })).toBe(false);
    expect(canSee(a, { institution: "treasury", classification: "public" })).toBe(true);
    expect(canSee(a, { institution: "auditor-general", classification: "public" })).toBe(false);
    expect(clearanceIn(a, "treasury")).toBe("internal");
  });

  it("inactive or MFA-less officials can do nothing", () => {
    for (const state of ["invited", "suspended", "revoked"] as const) {
      expect(can({ ...actor("a", "auditor", "*"), state }, "audit.read")).toBe(false);
    }
    expect(can({ ...actor("a", "auditor", "*"), mfa: false }, "audit.read")).toBe(false);
    expect(canSee({ ...actor("a", "reviewer"), mfa: false }, { institution: "treasury", classification: "public" })).toBe(false);
  });

  it("lists the institutions where a permission is held", () => {
    const a: Actor = {
      id: "a",
      state: "active",
      mfa: true,
      grants: [
        { role: "author", institution: "treasury", clearance: "internal" },
        { role: "author", institution: "electoral-commission", clearance: "internal" },
      ],
    };
    expect(institutionsWhere(a, "record.create")).toEqual(["treasury", "electoral-commission"]);
    expect(institutionsWhere(actor("b", "auditor", "*"), "record.read")).toBe("*");
    expect(institutionsWhere(a, "audit.read")).toEqual([]);
  });

  it("system administrators administer but do not handle records", () => {
    const a = actor("a", "system_administrator", "*", "confidential");
    expect(can(a, "official.invite")).toBe(true);
    expect(can(a, "record.read", { institution: "treasury" })).toBe(false);
    expect(can(a, "record.approve", { institution: "treasury" })).toBe(false);
  });
});

describe("two-person rule", () => {
  const govA = actor("gov-a", "government_administrator", "*");
  const govB = actor("gov-b", "government_administrator", "*");
  const instAdmin = actor("inst", "institutional_administrator");
  const grantPublisher: AccessChange = { kind: "grant", target: "someone", grant: { role: "publishing_officer", institution: "treasury", clearance: "internal" } };

  it("privileged roles and policy changes need a second administrator", () => {
    expect(needsSecondAdministrator(grantPublisher)).toBe(true);
    expect(needsSecondAdministrator({ kind: "grant", target: "x", grant: { role: "author", institution: "treasury", clearance: "internal" } })).toBe(false);
    expect(needsSecondAdministrator({ kind: "workflow_policy", register: "decisions", version: 2 })).toBe(true);
  });

  it("nobody can grant themselves a role", () => {
    const self: AccessChange = { ...grantPublisher, target: "gov-a" };
    expect(mayPropose(govA, self)).toMatchObject({ ok: false });
    expect(mayConfirm(govB, { ...grantPublisher, target: "gov-b" }, "gov-a")).toMatchObject({ ok: false });
  });

  it("the proposer cannot confirm their own proposal", () => {
    expect(mayPropose(govA, grantPublisher)).toMatchObject({ ok: true });
    expect(mayConfirm(govA, grantPublisher, "gov-a")).toMatchObject({ ok: false });
    expect(mayConfirm(govB, grantPublisher, "gov-a")).toMatchObject({ ok: true });
  });

  it("an institutional administrator works only inside their institution, and cannot create administrators", () => {
    expect(mayPropose(instAdmin, grantPublisher)).toMatchObject({ ok: true });
    expect(mayPropose(instAdmin, { ...grantPublisher, grant: { ...grantPublisher.grant, institution: "electoral-commission" } })).toMatchObject({ ok: false });
    expect(mayPropose(instAdmin, { ...grantPublisher, grant: { ...grantPublisher.grant, role: "institutional_administrator" } })).toMatchObject({ ok: false });
    expect(mayPropose(instAdmin, { ...grantPublisher, grant: { ...grantPublisher.grant, institution: "*" } })).toMatchObject({ ok: false });
  });

  it("only a system administrator proposes another system administrator", () => {
    const change: AccessChange = { kind: "grant", target: "someone", grant: { role: "system_administrator", institution: "*", clearance: "internal" } };
    expect(mayPropose(govA, change)).toMatchObject({ ok: false });
    expect(mayPropose(actor("sys", "system_administrator", "*"), change)).toMatchObject({ ok: true });
  });
});
