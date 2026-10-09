import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { clientKey, createLimiter } = await import("@/server/security/rate-limit");

describe("rate limiter", () => {
  it("allows up to the limit, then refuses with a Retry-After", () => {
    let t = 0;
    const check = createLimiter({ limit: 3, windowMs: 60_000 }, () => t);
    expect(check("a")).toEqual({ ok: true, remaining: 2 });
    expect(check("a").ok).toBe(true);
    expect(check("a").ok).toBe(true);
    t = 15_000;
    expect(check("a")).toEqual({ ok: false, retryAfterSeconds: 45 });
  });

  it("keeps clients separate", () => {
    const check = createLimiter({ limit: 1, windowMs: 1000 }, () => 0);
    expect(check("a").ok).toBe(true);
    expect(check("b").ok).toBe(true);
    expect(check("a").ok).toBe(false);
  });

  it("opens a new window after the old one ends", () => {
    let t = 0;
    const check = createLimiter({ limit: 1, windowMs: 1000 }, () => t);
    check("a");
    expect(check("a").ok).toBe(false);
    t = 1000;
    expect(check("a").ok).toBe(true);
  });

  it("reads the first X-Forwarded-For address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
