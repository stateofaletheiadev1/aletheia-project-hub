import "server-only";

// Fixed-window rate limiter held in process memory.
//
// Brief §8.5 allows an in-memory limiter only on a single long-lived Node process, and
// requires that to be documented: see docs/decisions/0004-in-memory-rate-limit.md.
// Replace with a shared store (Redis/Valkey) before running more than one instance.

export type Limit = { limit: number; windowMs: number };
export type Verdict = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number };

const MAX_KEYS = 50_000;

export function createLimiter({ limit, windowMs }: Limit, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const sweep = (t: number) => {
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
  };

  return function check(key: string): Verdict {
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (hits.size >= MAX_KEYS) sweep(t);
      // Still full after sweeping: fail closed for new keys rather than grow without bound.
      if (hits.size >= MAX_KEYS) return { ok: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) };
    return { ok: true, remaining: limit - entry.count };
  };
}

/** The client address as seen by the reverse proxy in front of the app (it must set X-Forwarded-For). */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
