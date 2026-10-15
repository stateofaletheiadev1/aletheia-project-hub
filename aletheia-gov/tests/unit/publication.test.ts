import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { publicationHash } = await import("@/server/publication/canonical");
const { parseKeys, sign, verify } = await import("@/server/publication/signature");
const { validate, Rejected } = await import("@/server/publication/publish");

// The same vector as aletheia-ops/tests/unit/content-hash.test.ts: both sides must agree.
const VECTOR = {
  register: "dispatches",
  reference: "AGV-DSP-2026-0001",
  title: "Notice of the first public session of the Treasury",
  summary: "When and where the Treasury will hold its first public session.",
  body: [
    { type: "paragraph", text: "The Treasury will hold its first public session on 1 November 2026 in Antioch." },
    { type: "heading", text: "Agenda" },
    { type: "list", items: ["Founding budget", "Questions from the public"] },
  ],
  facts: [{ label: "Date", value: "1 November 2026" }],
  version: 2,
};
const HASH = "efc3303cf11a1f442820dd3f969be6d2d7d823307890ed4eb2536f95983ddfed";

const payload = {
  ...VECTOR,
  slug: "agv-dsp-2026-0001",
  workbenchRecordId: "0b4a6c1e-8f2d-4a3b-9c5e-7d1f2a3b4c5d",
  versionHash: "a".repeat(64),
  institution: "treasury",
  contentHash: HASH,
};

describe("publication content hash", () => {
  it("matches the workbench's shared vector", () => {
    expect(publicationHash(VECTOR)).toBe(HASH);
  });
});

describe("request signatures", () => {
  const keys = parseKeys(`ops-1:${"s".repeat(40)},bad:short`);
  const now = 1_760_000_000;
  const body = JSON.stringify(payload);
  const header = (sig: string, ts = now, id = "ops-1") => `AGV-HMAC keyId=${id}, ts=${ts}, sig=${sig}`;

  it("accepts a correctly signed request and ignores keys too short to be safe", () => {
    expect(keys.size).toBe(1);
    expect(verify(header(sign("s".repeat(40), "POST", "/api/publications", now, body)), keys, "POST", "/api/publications", body, now)).toEqual({ ok: true, keyId: "ops-1" });
  });

  it("refuses altered bodies, wrong paths, old timestamps, unknown keys and missing signatures", () => {
    const good = sign("s".repeat(40), "POST", "/api/publications", now, body);
    expect(verify(header(good), keys, "POST", "/api/publications", body.replace("Treasury", "Treasurer"), now).ok).toBe(false);
    expect(verify(header(good), keys, "POST", "/api/other", body, now).ok).toBe(false);
    expect(verify(header(good), keys, "POST", "/api/publications", body, now + 301).ok).toBe(false);
    expect(verify(header(good, now, "nobody"), keys, "POST", "/api/publications", body, now).ok).toBe(false);
    expect(verify(null, keys, "POST", "/api/publications", body, now).ok).toBe(false);
    expect(verify(header(good), new Map(), "POST", "/api/publications", body, now)).toEqual({ ok: false, reason: "publication is not configured on this site" });
  });
});

describe("payload validation", () => {
  it("accepts a well-formed payload", () => {
    expect(validate(payload).reference).toBe("AGV-DSP-2026-0001");
  });

  it("refuses a text that does not match its hash", () => {
    expect(() => validate({ ...payload, title: "Changed after approval" })).toThrow(/content hash mismatch/);
  });

  it("refuses references from another register, bad slugs and HTML-like content shapes", () => {
    expect(() => validate({ ...payload, reference: "AGV-DOC-2026-0001", slug: "agv-doc-2026-0001" })).toThrow(Rejected);
    expect(() => validate({ ...payload, slug: "something-else" })).toThrow(/slug/);
    expect(() => validate({ ...payload, body: [{ type: "html", html: "<script>" }] })).toThrow(/invalid payload/);
  });
});

describe("withdrawal validation", () => {
  it("needs a register, a reference, the publishing record's id and a reason", async () => {
    const { validateWithdrawal } = await import("@/server/publication/publish");
    const ok = { register: "dispatches", reference: "AGV-DSP-2026-0001", workbenchRecordId: payload.workbenchRecordId, reason: "Published in error." };
    expect(validateWithdrawal(ok).reason).toBe("Published in error.");
    expect(() => validateWithdrawal({ ...ok, reason: "  " })).toThrow(Rejected);
    expect(() => validateWithdrawal({ ...ok, reference: "not-a-reference" })).toThrow(/invalid withdrawal/);
  });
});
