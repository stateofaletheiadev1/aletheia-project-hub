// A fixed-window rate limiter kept in process memory (brief §24). On Vercel each instance
// counts separately, so this limits bursts from one address rather than giving a global
// guarantee; per-account lockout (stored in the database) is the control that cannot be evaded
// by spreading requests. Recorded in ADR 0006.

type Window = { count: number; resetAt: number };

export function createLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>();
  return function hit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    }
    const w = windows.get(key);
    if (!w || w.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true };
    }
    w.count += 1;
    return w.count <= limit ? { ok: true } : { ok: false, retryAfterSeconds: Math.ceil((w.resetAt - now) / 1000) };
  };
}

/** The client address as Vercel reports it, or a constant outside it. */
export function clientAddress(h: Headers): string {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
