import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseEnv } = await import("@/lib/env");

const key = Buffer.alloc(32, 7).toString("base64");
const production = {
  APP_ENV: "production",
  ALETHEIADB_URL: "aletheiadb://id:secret@db.stateofaletheia.org/workbench",
  DATA_ENCRYPTION_KEY: key,
  EMAIL_INDEX_KEY: key,
  PUBLICATION_MODE: "portal",
  PORTAL_HMAC_KEY_ID: "ops-1",
  PORTAL_HMAC_SECRET: "x".repeat(40),
  CRON_SECRET: "y".repeat(40),
};

describe("environment", () => {
  it("defaults to development with simulated publication", () => {
    expect(parseEnv({})).toMatchObject({ APP_ENV: "development", PUBLICATION_MODE: "development" });
  });

  it("accepts a complete production environment", () => {
    expect(parseEnv(production).APP_ENV).toBe("production");
  });

  it("refuses to start production with simulated publication", () => {
    expect(() => parseEnv({ ...production, PUBLICATION_MODE: "development" })).toThrow(/must be 'portal' in production/);
  });

  it("refuses to start production with authenticator codes off", () => {
    expect(() => parseEnv({ ...production, AUTH_MFA: "off" })).toThrow(/AUTH_MFA must be 'required'/);
    expect(parseEnv({ AUTH_MFA: "off", APP_ENV: "staging" }).AUTH_MFA).toBe("off");
  });

  it("names every missing production secret", () => {
    expect(() => parseEnv({ APP_ENV: "production", PUBLICATION_MODE: "portal", PORTAL_HMAC_KEY_ID: "k", PORTAL_HMAC_SECRET: "x".repeat(40) })).toThrow(
      /ALETHEIADB_URL, DATA_ENCRYPTION_KEY, EMAIL_INDEX_KEY, CRON_SECRET/,
    );
  });

  it("validates key formats", () => {
    expect(() => parseEnv({ DATA_ENCRYPTION_KEY: "short" })).toThrow(/32 bytes/);
    expect(() => parseEnv({ ALETHEIADB_URL: "https://db" })).toThrow(/aletheiadb:\/\//);
  });
});
