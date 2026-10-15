import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PortalGateway } from "@/adapters/publication/portal-gateway";
import { publicationHash } from "@/lib/content-hash";
import type { PublicationPayload } from "@/ports/publication";

const SECRET = "s".repeat(40);
const base = {
  register: "dispatches" as const,
  reference: "AGV-DSP-2026-0001",
  slug: "agv-dsp-2026-0001",
  workbenchRecordId: "0b4a6c1e-8f2d-4a3b-9c5e-7d1f2a3b4c5d",
  version: 1,
  versionHash: "a".repeat(64),
  title: "Notice of the first public session",
  summary: "",
  body: [{ type: "paragraph" as const, text: "Text." }],
  facts: [],
  institution: "treasury",
};
const payload: PublicationPayload = { ...base, contentHash: publicationHash(base) };

/** A fake portal that checks signatures exactly as aletheia-gov/src/server/publication/signature.ts does. */
function portal(behaviour: (body: string, key: string) => Response) {
  const calls: { method: string; path: string; key: string | null }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const body = (init.body as string | undefined) ?? "";
    const headers = init.headers as Record<string, string>;
    const m = /^AGV-HMAC keyId=(\S+), ts=(\d+), sig=([0-9a-f]{64})$/.exec(headers.Authorization ?? "");
    const expected = m && createHmac("sha256", SECRET).update(`${init.method}\n${path}\n${m[2]}\n${createHash("sha256").update(body).digest("hex")}`).digest("hex");
    calls.push({ method: init.method!, path, key: headers["Idempotency-Key"] ?? null });
    if (!m || m[1] !== "ops-1" || m[3] !== expected) return new Response(JSON.stringify({ error: "signature does not match" }), { status: 401 });
    return behaviour(body, headers["Idempotency-Key"] ?? "");
  }) as unknown as typeof fetch;
  return { fake, calls };
}

const gw = (f: typeof fetch) => new PortalGateway({ base: "https://portal.test", keyId: "ops-1", secret: SECRET, fetch: f });
const receipt = { reference: "AGV-DSP-2026-0001", url: "https://portal.test/dispatches/agv-dsp-2026-0001", publishedAt: "2026-10-16T10:00:00.000Z", contentHash: payload.contentHash };

describe("portal gateway", () => {
  it("signs requests the portal accepts, and confirms on its receipt", async () => {
    const { fake, calls } = portal(() => new Response(JSON.stringify(receipt), { status: 201 }));
    expect(await gw(fake).publish(payload, "rec:v1")).toEqual({ kind: "confirmed", ...receipt, simulated: false });
    expect(calls).toEqual([{ method: "POST", path: "/api/publications", key: "rec:v1" }]);
  });

  it("treats definite refusals as failures, with the portal's reason", async () => {
    const { fake } = portal(() => new Response(JSON.stringify({ error: "content hash mismatch" }), { status: 422 }));
    expect(await gw(fake).publish(payload, "k1")).toEqual({ kind: "rejected", reason: "content hash mismatch" });
    const wrongKey = new PortalGateway({ base: "https://portal.test", keyId: "ops-1", secret: "x".repeat(40), fetch: portal(() => new Response("{}")).fake });
    expect(await wrongKey.publish(payload, "k1")).toMatchObject({ kind: "rejected", reason: "signature does not match" });
  });

  it("treats timeouts, network failures and server errors as unclear, never as failure", async () => {
    expect(await gw(portal(() => new Response("{}", { status: 503 })).fake).publish(payload, "k")).toMatchObject({ kind: "unknown" });
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await gw(down).publish(payload, "k")).toMatchObject({ kind: "unknown", reason: expect.stringMatching(/could not be reached/) });
    // A receipt for different content is not a confirmation.
    const odd = portal(() => new Response(JSON.stringify({ ...receipt, contentHash: "b".repeat(64) }), { status: 201 }));
    expect(await gw(odd.fake).publish(payload, "k")).toMatchObject({ kind: "unknown" });
  });

  it("asks the portal by idempotency key when reconciling", async () => {
    const found = portal(() => new Response(JSON.stringify(receipt), { status: 200 }));
    expect(await gw(found.fake).lookup("rec:v1")).toMatchObject({ kind: "confirmed", reference: "AGV-DSP-2026-0001" });
    expect(found.calls[0]).toEqual({ method: "GET", path: "/api/publications/rec%3Av1", key: null });
    expect(await gw(portal(() => new Response("{}", { status: 404 })).fake).lookup("k")).toEqual({ kind: "absent" });
  });
});
