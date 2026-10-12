import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { AletheiaDBError, ConflictError } from '@aletheia/aletheiadb';
import { NotConfiguredError } from './db';

// Shared plumbing for every /api route: JSON in and out, one error shape, same-origin checks
// for writes and a small in-memory rate limiter for sign-in.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string): never => {
  throw new ApiError(status, message);
};

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse>;

export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') checkOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status);
      if (e instanceof NotConfiguredError) return json({ error: 'The service is not connected to its database yet.' }, 503);
      if (e instanceof ConflictError) return json({ error: 'The record changed while you were working on it. Please try again.' }, 409);
      if (e instanceof AletheiaDBError) {
        console.error(`[api] ${req.method} ${req.nextUrl.pathname}: database ${e.code}: ${e.message}`);
        return json({ error: 'The database is unavailable. Please try again shortly.' }, 503);
      }
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}:`, e);
      return json({ error: 'Something went wrong on our side.' }, 500);
    }
  };
}

/** Writes must come from this site: a cross-site page cannot post on a person's behalf. */
function checkOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') fail(403, 'Cross-site request refused.');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      fail(403, 'Cross-site request refused.');
    }
    if (originHost !== host) fail(403, 'Cross-site request refused.');
  }
}

export async function body<T = Record<string, unknown>>(req: NextRequest, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) fail(413, 'The request is too large.');
  try {
    const parsed = JSON.parse(text || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as T;
  } catch {
    return fail(400, 'The request body must be a JSON object.');
  }
}

/** A trimmed string field, required unless `optional`, at most `max` characters. */
export function str(o: Record<string, unknown>, key: string, opts: { max?: number; optional?: boolean; label?: string } = {}): string {
  const v = o[key];
  const label = opts.label ?? key;
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    return fail(400, `${label} is required.`);
  }
  if (typeof v !== 'string') return fail(400, `${label} must be text.`);
  const s = v.trim();
  if (!s && !opts.optional) return fail(400, `${label} is required.`);
  if (s.length > (opts.max ?? 200)) return fail(400, `${label} is too long.`);
  return s;
}

export function oneOf<T extends string>(o: Record<string, unknown>, key: string, values: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !values.includes(v as T)) return fail(400, `${key} must be one of: ${values.join(', ')}.`);
  return v as T;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
export const isId = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

export function clientIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

const buckets = new Map<string, { count: number; reset: number }>();

/** At most `limit` attempts per `windowMs` for a key (per server instance). */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) fail(429, 'Too many attempts. Please wait a minute and try again.');
}

/** Retries a read-modify-write when another request changed the record in between. */
export async function retryOnConflict<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ConflictError) || i >= attempts - 1) throw e;
    }
  }
}
