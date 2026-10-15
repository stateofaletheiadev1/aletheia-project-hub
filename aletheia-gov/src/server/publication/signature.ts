import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Service-to-service authentication for publication (aletheia-ops ADR 0003). The workbench signs
//   METHOD \n PATH \n TIMESTAMP \n SHA256(body)
// with HMAC-SHA256 and sends `Authorization: AGV-HMAC keyId=<id>, ts=<unix seconds>, sig=<hex>`.
// Requests more than 300 seconds from now are refused. Several keys may be active (rotation).

export const WINDOW_SECONDS = 300;

export function parseKeys(value: string | undefined): Map<string, string> {
  const keys = new Map<string, string>();
  for (const pair of (value ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i <= 0) continue;
    const id = pair.slice(0, i).trim();
    const secret = pair.slice(i + 1).trim();
    if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && secret.length >= 32) keys.set(id, secret);
  }
  return keys;
}

export function sign(secret: string, method: string, path: string, ts: number, body: string): string {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return createHmac("sha256", secret).update(`${method.toUpperCase()}\n${path}\n${ts}\n${bodyHash}`).digest("hex");
}

export type Verdict = { ok: true; keyId: string } | { ok: false; reason: string };

export function verify(header: string | null, keys: Map<string, string>, method: string, path: string, body: string, nowSeconds: number): Verdict {
  if (keys.size === 0) return { ok: false, reason: "publication is not configured on this site" };
  const m = /^AGV-HMAC keyId=([A-Za-z0-9_-]{1,40}), ts=(\d{1,12}), sig=([0-9a-f]{64})$/.exec(header ?? "");
  if (!m) return { ok: false, reason: "missing or malformed signature" };
  const [, keyId, tsText, sig] = m;
  const secret = keys.get(keyId!);
  if (!secret) return { ok: false, reason: "unknown key" };
  const ts = Number(tsText);
  if (Math.abs(nowSeconds - ts) > WINDOW_SECONDS) return { ok: false, reason: "request too old or from the future" };
  const expected = Buffer.from(sign(secret, method, path, ts, body), "hex");
  const given = Buffer.from(sig!, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "signature does not match" };
  return { ok: true, keyId: keyId! };
}
