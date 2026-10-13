'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

// Browser side of the /api routes: one fetch helper and a small cached hook. Every
// component that asks for the same path shares one request and one copy of the data, and
// a write elsewhere can refresh it with `reload(path)`.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
    headers: opts.form ? undefined : opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`, data as Record<string, unknown>);
  return data;
}

type Entry = { data?: unknown; error?: ApiError; loading: boolean; promise?: Promise<void>; listeners: Set<() => void> };
const cache = new Map<string, Entry>();
const EMPTY: Entry = { loading: true, listeners: new Set() };

function entry(path: string): Entry {
  let e = cache.get(path);
  if (!e) cache.set(path, (e = { loading: true, listeners: new Set() }));
  return e;
}

function emit(e: Entry) {
  for (const l of e.listeners) l();
}

/** (Re)loads a path; components using it re-render with the new data. */
export function reload(path: string): Promise<void> {
  const e = entry(path);
  if (e.promise) return e.promise;
  e.loading = true;
  emit(e);
  e.promise = api(path)
    .then((data) => {
      cache.set(path, { ...e, data, error: undefined, loading: false, promise: undefined });
    })
    .catch((err) => {
      cache.set(path, { ...e, error: err instanceof ApiError ? err : new ApiError(0, 'Network error. Check your connection.'), loading: false, promise: undefined });
    })
    .finally(() => emit(cache.get(path)!));
  return e.promise;
}

/** Replaces cached data without a request (after a write that returned the new state). */
export function setCached(path: string, data: unknown) {
  const e = entry(path);
  cache.set(path, { ...e, data, error: undefined, loading: false });
  emit(cache.get(path)!);
}

/** Forgets every cached response (on sign-out). */
export function clearCache() {
  for (const [path, e] of cache) {
    cache.set(path, { listeners: e.listeners, loading: true });
  }
}

export function useApi<T>(path: string | null): { data: T | undefined; error: ApiError | undefined; loading: boolean; reload: () => Promise<void> } {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!path) return () => {};
      const e = entry(path);
      e.listeners.add(cb);
      return () => {
        cache.get(path)?.listeners.delete(cb);
      };
    },
    [path],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (path ? (cache.get(path) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
  useEffect(() => {
    if (!path) return;
    const e = entry(path);
    if (e.data === undefined && !e.error && !e.promise) void reload(path);
  }, [path]);
  const again = useCallback(() => (path ? reload(path) : Promise.resolve()), [path]);
  return { data: snapshot.data as T | undefined, error: snapshot.error, loading: snapshot.loading, reload: again };
}
