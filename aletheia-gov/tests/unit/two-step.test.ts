import { Secret, TOTP } from "otpauth";
import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABEL } from "@/lib/application-status";
import { newTotpSecret, totpUri, verifyTotp } from "@/server/auth/totp";

// Optional two-step sign-in in the staff area: codes from any standard authenticator app.

const code = (secret: string, at: number) => new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({ timestamp: at });

describe("authenticator codes", () => {
  const secret = newTotpSecret();
  const now = Date.UTC(2026, 9, 16, 12, 0, 0);

  it("accepts the current code, and one step of clock drift", () => {
    expect(verifyTotp(secret, code(secret, now), null, now)).not.toBeNull();
    expect(verifyTotp(secret, code(secret, now - 30_000), null, now)).not.toBeNull();
    expect(verifyTotp(secret, code(secret, now - 120_000), null, now)).toBeNull();
  });

  it("refuses a code that was already used", () => {
    const step = verifyTotp(secret, code(secret, now), null, now)!;
    expect(verifyTotp(secret, code(secret, now), step, now)).toBeNull();
  });

  it("refuses anything that is not six digits", () => {
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null, now)).toBeNull();
  });

  it("names the Government Workbench in the app", () => {
    expect(totpUri(secret, "officer@example.org")).toContain("issuer=Aletheia%20Government%20Workbench");
  });
});

describe("application statuses", () => {
  it("are the workbench's list (aletheia-ops src/domain/applications.ts)", () => {
    expect(APPLICATION_STATUSES).toEqual(["new", "contacted", "shortlisted", "offered", "appointed", "not_progressed", "archived"]);
    expect(APPLICATION_STATUS_LABEL.new).toBe("Received");
  });
});
