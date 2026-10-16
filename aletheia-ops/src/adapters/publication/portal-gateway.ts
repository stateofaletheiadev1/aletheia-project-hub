import { createHash, createHmac } from "node:crypto";
import type { PublicationGateway, PublicationOutcome, PublicationPayload, WithdrawalPayload } from "@/ports/publication";

// Publication to aletheiagov.org (ADR 0003): signed requests to the portal's own endpoint, which
// checks everything again and is the only writer of the public record.
//   POST /api/publications            publish (Idempotency-Key header)
//   GET  /api/publications/{key}      the state of an earlier request
// Signature: HMAC-SHA256 over METHOD \n PATH \n TIMESTAMP \n SHA256(body), in
// `Authorization: AGV-HMAC keyId=…, ts=…, sig=…`.

type Fetch = typeof fetch;

/** The signature every request to the portal carries (also used by the applications adapter). */
export function portalAuthorization(keyId: string, secret: string, method: string, path: string, body: string, now = Date.now()): string {
  const ts = Math.floor(now / 1000);
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const sig = createHmac("sha256", secret).update(`${method}\n${path}\n${ts}\n${bodyHash}`).digest("hex");
  return `AGV-HMAC keyId=${keyId}, ts=${ts}, sig=${sig}`;
}

export class PortalGateway implements PublicationGateway {
  readonly simulated = false;
  private readonly base: string;
  private readonly keyId: string;
  private readonly secret: string;
  private readonly fetchImpl: Fetch;
  private readonly timeoutMs: number;

  constructor(opts: { base: string; keyId: string; secret: string; fetch?: Fetch; timeoutMs?: number }) {
    this.base = opts.base.replace(/\/$/, "");
    this.keyId = opts.keyId;
    this.secret = opts.secret;
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  private authorization(method: string, path: string, body: string): string {
    return portalAuthorization(this.keyId, this.secret, method, path, body);
  }

  private async call(method: "GET" | "POST", path: string, body: string, extra: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown> } | { failed: string }> {
    try {
      const res = await this.fetchImpl(this.base + path, {
        method,
        headers: { Authorization: this.authorization(method, path, body), Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/json" } : {}), ...extra },
        body: method === "POST" ? body : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: res.status, json };
    } catch (e) {
      return { failed: (e as Error).name === "TimeoutError" ? "the portal did not answer in time" : `the portal could not be reached: ${(e as Error).message}` };
    }
  }

  private confirmed(json: Record<string, unknown>, expectedHash: string | null): PublicationOutcome {
    const { reference, url, publishedAt, contentHash } = json as Record<string, string>;
    if (!reference || !url || !publishedAt || !contentHash) return { kind: "unknown", reason: "the portal's receipt was incomplete" };
    if (expectedHash && contentHash !== expectedHash) return { kind: "unknown", reason: "the portal's receipt carries a different content hash" };
    return { kind: "confirmed", reference, url, publishedAt, contentHash, simulated: false };
  }

  async publish(payload: PublicationPayload, idempotencyKey: string): Promise<PublicationOutcome> {
    const body = JSON.stringify(payload);
    const r = await this.call("POST", "/api/publications", body, { "Idempotency-Key": idempotencyKey });
    if ("failed" in r) return { kind: "unknown", reason: r.failed };
    if (r.status === 200 || r.status === 201) return this.confirmed(r.json, payload.contentHash);
    const reason = typeof r.json.error === "string" ? r.json.error : `HTTP ${r.status}`;
    // A definite refusal (bad payload, hash mismatch, reused key, credentials) is a failure;
    // anything else is unclear and is reconciled before a retry.
    if ([400, 401, 403, 409, 413, 422].includes(r.status)) return { kind: "rejected", reason };
    return { kind: "unknown", reason };
  }

  async withdraw(w: WithdrawalPayload, idempotencyKey: string): Promise<PublicationOutcome> {
    const r = await this.call("POST", "/api/withdrawals", JSON.stringify(w), { "Idempotency-Key": idempotencyKey });
    if ("failed" in r) return { kind: "unknown", reason: r.failed };
    if (r.status === 200 || r.status === 201) return this.confirmed(r.json, null);
    const reason = typeof r.json.error === "string" ? r.json.error : `HTTP ${r.status}`;
    if ([400, 401, 403, 409, 413, 422].includes(r.status)) return { kind: "rejected", reason };
    return { kind: "unknown", reason };
  }

  async lookup(idempotencyKey: string): Promise<PublicationOutcome | { kind: "absent" }> {
    const r = await this.call("GET", `/api/publications/${encodeURIComponent(idempotencyKey)}`, "");
    if ("failed" in r) return { kind: "unknown", reason: r.failed };
    if (r.status === 404) return { kind: "absent" };
    if (r.status === 200) return this.confirmed(r.json, null);
    return { kind: "unknown", reason: typeof r.json.error === "string" ? r.json.error : `HTTP ${r.status}` };
  }
}
