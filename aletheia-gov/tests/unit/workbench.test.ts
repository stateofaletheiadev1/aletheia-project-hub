import { describe, expect, it, vi } from "vitest";
import { can, canManageUser, isRole, ROLES, type Permission, type Role } from "@/server/authorization/policies";

vi.mock("server-only", () => ({}));
const { checkPdf } = await import("@/server/security/pdf");
const { passwordProblem } = await import("@/server/auth/password");

const PERMISSIONS: Permission[] = ["interest.read", "interest.update", "cv.download", "audit.read", "users.read", "users.manage"];

// The full role × permission matrix (brief §12.1). Changing a grant must change this table.
const EXPECTED: Record<Role, Permission[]> = {
  administrator: ["audit.read", "users.read", "users.manage"],
  reviewer: ["interest.read", "interest.update", "cv.download"],
  publisher: [],
  auditor: ["audit.read"],
};

describe("authorization policies", () => {
  for (const role of ROLES) {
    for (const p of PERMISSIONS) {
      const allowed = EXPECTED[role].includes(p);
      it(`${role} ${allowed ? "may" : "may not"} ${p}`, () => {
        expect(can({ id: "u", roles: [role] }, p)).toBe(allowed);
      });
    }
  }

  it("administrators cannot read registrations unless also reviewers (brief §11)", () => {
    expect(can({ id: "u", roles: ["administrator"] }, "interest.read")).toBe(false);
    expect(can({ id: "u", roles: ["administrator", "reviewer"] }, "interest.read")).toBe(true);
  });

  it("denies the anonymous, the role-less and the disabled", () => {
    expect(can(null, "audit.read")).toBe(false);
    expect(can({ id: "u", roles: [] }, "audit.read")).toBe(false);
    expect(can({ id: "u", roles: ["administrator"], disabled: true }, "users.manage")).toBe(false);
  });

  it("forbids managing your own account (no privilege self-assignment)", () => {
    const admin = { id: "a", roles: ["administrator"] as Role[] };
    expect(canManageUser(admin, "b")).toBe(true);
    expect(canManageUser(admin, "a")).toBe(false);
    expect(canManageUser({ id: "r", roles: ["reviewer"] }, "b")).toBe(false);
  });

  it("recognises roles", () => {
    expect(isRole("reviewer")).toBe(true);
    expect(isRole("root")).toBe(false);
  });
});

const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF\n`);

describe("CV upload checks", () => {
  it("accepts a plain PDF within the limit", () => {
    expect(checkPdf(pdf("1 0 obj << /Type /Catalog >> endobj"), 2048)).toEqual({ ok: true });
  });

  it("judges by bytes, not by name", () => {
    expect(checkPdf(new TextEncoder().encode("MZ\x90\x00 this is an exe"), 2048).ok).toBe(false);
    expect(checkPdf(new TextEncoder().encode("<html>"), 2048).ok).toBe(false);
  });

  it("refuses empty, oversized and truncated files", () => {
    expect(checkPdf(new Uint8Array(), 2048).ok).toBe(false);
    expect(checkPdf(pdf("x".repeat(5000)), 2048).ok).toBe(false);
    expect(checkPdf(new TextEncoder().encode("%PDF-1.7 no end"), 2048).ok).toBe(false);
  });

  it("refuses PDFs that can run scripts or carry files", () => {
    for (const marker of ["/JavaScript", "/JS (app.alert(1))", "/Launch", "/EmbeddedFile", "/XFA"]) {
      expect(checkPdf(pdf(`<< /OpenAction << /S ${marker} >> >>`), 4096).ok, marker).toBe(false);
    }
    // Words that merely start with the same letters are fine.
    expect(checkPdf(pdf("/JSON-like text /Launcher-free"), 4096).ok).toBe(true);
  });
});

describe("password policy", () => {
  it("requires length and variety, and rejects the obvious", () => {
    expect(passwordProblem("short", "ada@example.org")).toMatch(/12/);
    expect(passwordProblem("ada-lovelace-2026!", "ada@example.org")).toMatch(/email/);
    expect(passwordProblem("aaaaaaaaaaaaaa", "x@example.org")).toBeTruthy();
    expect(passwordProblem("harbour lamps over Antioch", "x@example.org")).toBeNull();
  });
});
