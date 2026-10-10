import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { blindIndex, decryptFields, encryptFields, masterKeyFrom, newSubjectKey, unwrapSubjectKey } = await import("@/server/crypto/envelope");

const master = masterKeyFrom(randomBytes(32).toString("base64"));

describe("envelope encryption for personal data", () => {
  it("round-trips fields through a per-subject key", () => {
    const { key, wrapped } = newSubjectKey(master, "subject-1");
    const sealed = encryptFields(key, { fullName: "Ada Okafor", email: "ada@example.org" }, "interest");
    expect(JSON.stringify(sealed)).not.toContain("Ada");
    const again = unwrapSubjectKey(master, "subject-1", wrapped);
    expect(decryptFields(again, sealed, "interest")).toEqual({ fullName: "Ada Okafor", email: "ada@example.org" });
  });

  it("detects tampering and wrong contexts", () => {
    const { key } = newSubjectKey(master, "s");
    const sealed = encryptFields(key, { a: 1 }, "interest");
    const flipped = { ...sealed, ct: Buffer.from(Buffer.from(sealed.ct, "base64").map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64") };
    expect(() => decryptFields(key, flipped, "interest")).toThrow();
    expect(() => decryptFields(key, sealed, "another-collection")).toThrow();
  });

  it("a wrapped key only opens with the right master key and subject (crypto-shredding)", () => {
    const { wrapped } = newSubjectKey(master, "subject-1");
    const otherMaster = masterKeyFrom(randomBytes(32).toString("base64"));
    expect(() => unwrapSubjectKey(otherMaster, "subject-1", wrapped)).toThrow();
    expect(() => unwrapSubjectKey(master, "subject-2", wrapped)).toThrow();
  });

  it("blind indexes are stable, normalised, purpose-separated and keyed", () => {
    expect(blindIndex(master, "email", " Ada@Example.org ")).toBe(blindIndex(master, "email", "ada@example.org"));
    expect(blindIndex(master, "email", "ada@example.org")).not.toBe(blindIndex(master, "interest", "ada@example.org"));
    const other = masterKeyFrom(randomBytes(32).toString("base64"));
    expect(blindIndex(master, "email", "ada@example.org")).not.toBe(blindIndex(other, "email", "ada@example.org"));
    expect(blindIndex(master, "email", "x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects master keys of the wrong size", () => {
    expect(() => masterKeyFrom(randomBytes(16).toString("base64"))).toThrow();
  });

  it("staff accounts and registrations of the same email get different keys", () => {
    // Erasing a registration destroys its key; it must never be the key of a workbench account.
    const email = "officer@stateofaletheia.org";
    expect(blindIndex(master, "staff-person", email)).not.toBe(blindIndex(master, "person-email", email));
  });
});
