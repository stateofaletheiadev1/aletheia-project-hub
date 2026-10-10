/**
 * AletheiaDB client for TypeScript / Node.js (server-side only: it holds an API key).
 *
 *   const db = AletheiaDB.connect(process.env.ALETHEIADB_URL!);
 *   //  aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/gov
 *   const people = db.collection<{ name: string }>("people");
 *   const doc = await people.insertOne({ name: "Ada" });
 *   await people.updateOne(doc._id, doc._rev, { $set: { name: "Ada L." } });
 */

// ------------------------------------------------------------------ connection strings

export interface ConnectionOptions {
  /** https://host[:port] the client talks to. */
  baseUrl: string;
  keyId: string;
  secret: string;
  /** Default database from the path, if any. */
  database?: string;
  timeoutMs: number;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Parses `aletheiadb://<keyId>:<secret>@host[:port]/<database>?tls=true&timeoutMs=10000`.
 * TLS is on by default (port 443). `tls=false` is accepted only for loopback hosts, so a
 * key is never sent unencrypted over a network.
 */
export function parseConnectionString(uri: string): ConnectionOptions {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new InvalidError("not a valid aletheiadb:// connection string");
  }
  if (url.protocol !== "aletheiadb:") throw new InvalidError("connection string must start with aletheiadb://");
  const keyId = decodeURIComponent(url.username);
  const secret = decodeURIComponent(url.password);
  if (!keyId || !secret) throw new InvalidError("connection string must include credentials: aletheiadb://<keyId>:<secret>@host/");
  if (!url.hostname) throw new InvalidError("connection string must include a host");

  const tlsParam = url.searchParams.get("tls");
  const tls = tlsParam === null ? true : tlsParam === "true";
  if (!tls && !LOOPBACK.has(url.hostname)) {
    throw new InvalidError("tls=false is only allowed for localhost; API keys must not travel unencrypted");
  }
  const port = url.port || (tls ? "443" : "7790");
  const defaultPort = tls ? "443" : "80";
  const host = url.hostname.includes(":") && !url.hostname.startsWith("[") ? `[${url.hostname}]` : url.hostname;
  const baseUrl = `${tls ? "https" : "http"}://${host}${port === defaultPort ? "" : `:${port}`}`;

  const database = url.pathname.replace(/^\/+|\/+$/g, "") || undefined;
  const timeoutParam = url.searchParams.get("timeoutMs");
  const timeoutMs = timeoutParam === null ? 10_000 : Number(timeoutParam);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) throw new InvalidError("timeoutMs must be 100-120000");
  return { baseUrl, keyId, secret, database, timeoutMs };
}

// ------------------------------------------------------------------ errors

export type ErrorCode = "NotFound" | "Conflict" | "Invalid" | "Unauthorized" | "Forbidden" | "Unavailable" | "Timeout" | "Internal";

export class AletheiaDBError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = `${code}Error`;
  }
}
export class NotFoundError extends AletheiaDBError {}
export class ConflictError extends AletheiaDBError {}
export class InvalidError extends AletheiaDBError {
  constructor(message: string, status?: number, requestId?: string) {
    super("Invalid", message, status, requestId);
  }
}
export class UnauthorizedError extends AletheiaDBError {}
export class ForbiddenError extends AletheiaDBError {}
export class UnavailableError extends AletheiaDBError {}
export class TimeoutError extends AletheiaDBError {}
export class InternalError extends AletheiaDBError {}

function errorFrom(code: string, message: string, status?: number, requestId?: string): AletheiaDBError {
  switch (code) {
    case "NotFound":
      return new NotFoundError("NotFound", message, status, requestId);
    case "Conflict":
      return new ConflictError("Conflict", message, status, requestId);
    case "Invalid":
      return new InvalidError(message, status, requestId);
    case "Unauthorized":
      return new UnauthorizedError("Unauthorized", message, status, requestId);
    case "Forbidden":
      return new ForbiddenError("Forbidden", message, status, requestId);
    case "Unavailable":
      return new UnavailableError("Unavailable", message, status, requestId);
    case "Timeout":
      return new TimeoutError("Timeout", message, status, requestId);
    default:
      return new InternalError("Internal", message, status, requestId);
  }
}

// ------------------------------------------------------------------ types

export interface Meta {
  _id: string;
  _rev: number;
  _createdAt: string;
  _updatedAt: string;
}
export type Doc<T> = T & Meta;
export type Filter = Record<string, unknown>;
export type Sort = Record<string, 1 | -1>;
export interface Update {
  $set?: Record<string, unknown>;
  $unset?: string[];
  $inc?: Record<string, number>;
}
export interface FindOptions {
  sort?: Sort;
  limit?: number;
  skip?: number;
}
export interface CallOptions {
  /** Propagated as X-Request-Id for end-to-end tracing. */
  requestId?: string;
  /** For writes: makes retries safe. Generated automatically when omitted. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

type Fetch = typeof fetch;

export interface ClientOptions {
  fetch?: Fetch;
  /** Retries for network failures and 502/503/504 (writes are retried with the same idempotency key). */
  retries?: number;
}

// ------------------------------------------------------------------ client

export class AletheiaDB {
  private readonly fetchImpl: Fetch;
  private readonly retries: number;

  private constructor(
    readonly options: ConnectionOptions,
    clientOptions: ClientOptions = {},
  ) {
    this.fetchImpl = clientOptions.fetch ?? fetch;
    this.retries = clientOptions.retries ?? 2;
  }

  static connect(uri: string, clientOptions?: ClientOptions): AletheiaDB {
    return new AletheiaDB(parseConnectionString(uri), clientOptions);
  }

  /** The database named in the connection string, or another one by name. */
  db(name?: string): Database {
    const n = name ?? this.options.database;
    if (!n) throw new InvalidError("no database given in the connection string or in db(name)");
    return new Database(this, n);
  }

  /** Shortcut for `db().collection(name)`. */
  collection<T extends object = Record<string, unknown>>(name: string): Collection<T> {
    return this.db().collection<T>(name);
  }

  async whoami(opts?: CallOptions): Promise<{ keyId: string; role: string; database?: string }> {
    return this.request("GET", "/v1/whoami", undefined, opts);
  }

  async health(): Promise<{ status: string; version: string }> {
    return this.request("GET", "/health", undefined, undefined, false);
  }

  /** @internal */
  async request<R>(method: string, path: string, body?: unknown, opts: CallOptions = {}, auth = true): Promise<R> {
    const isWrite = method !== "GET" && !path.endsWith("/query") && !path.endsWith("/count");
    const idempotencyKey = isWrite ? (opts.idempotencyKey ?? globalThis.crypto.randomUUID()) : undefined;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (auth) headers.Authorization = `Bearer ${this.options.keyId}.${this.options.secret}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.requestId) headers["X-Request-Id"] = opts.requestId;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    let lastError: AletheiaDBError | undefined;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
      const timeout = AbortSignal.timeout(this.options.timeoutMs);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await this.fetchImpl(this.options.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        lastError = timeout.aborted
          ? new TimeoutError("Timeout", `AletheiaDB did not answer within ${this.options.timeoutMs} ms`)
          : new UnavailableError("Unavailable", `cannot reach AletheiaDB: ${(e as Error).message}`);
        continue;
      }
      const text = await res.text();
      let json: unknown = undefined;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        /* non-JSON body, handled below */
      }
      if (res.ok) return json as R;
      const err = (json as { error?: { code?: string; message?: string }; requestId?: string } | undefined) ?? {};
      lastError = errorFrom(err.error?.code ?? (res.status >= 500 ? "Unavailable" : "Internal"), err.error?.message ?? `HTTP ${res.status}`, res.status, err.requestId);
      if (![502, 503, 504].includes(res.status)) throw lastError;
    }
    throw lastError ?? new UnavailableError("Unavailable", "AletheiaDB request failed");
  }
}

const seg = (s: string) => encodeURIComponent(s);

export class Database {
  constructor(
    private readonly client: AletheiaDB,
    readonly name: string,
  ) {}

  collection<T extends object = Record<string, unknown>>(name: string): Collection<T> {
    return new Collection<T>(this.client, this.name, name);
  }

  /** Root key only. Idempotent. */
  async create(opts?: CallOptions): Promise<{ created: boolean }> {
    return this.client.request("PUT", `/v1/databases/${seg(this.name)}`, undefined, opts);
  }

  /** Admin role. Idempotent: safe to call on every deploy. */
  async ensureCollection(name: string, opts?: CallOptions): Promise<{ created: boolean }> {
    return this.client.request("PUT", `/v1/databases/${seg(this.name)}/collections/${seg(name)}`, undefined, opts);
  }

  async listCollections(opts?: CallOptions): Promise<{ name: string; createdAt: string }[]> {
    const r = await this.client.request<{ collections: { name: string; createdAt: string }[] }>("GET", `/v1/databases/${seg(this.name)}/collections`, undefined, opts);
    return r.collections;
  }
}

export class Collection<T extends object> {
  private readonly base: string;

  constructor(
    private readonly client: AletheiaDB,
    readonly database: string,
    readonly name: string,
  ) {
    this.base = `/v1/databases/${seg(database)}/collections/${seg(name)}`;
  }

  /** Admin role. Idempotent. */
  async createIndex(field: string, options: { unique?: boolean } = {}, opts?: CallOptions): Promise<{ created: boolean }> {
    return this.client.request("PUT", `${this.base}/indexes/${seg(field)}`, { unique: options.unique ?? false }, opts);
  }

  async insertOne(document: T, opts?: CallOptions): Promise<Doc<T>> {
    const r = await this.client.request<{ document: Doc<T> }>("POST", `${this.base}/documents`, { document }, opts);
    return r.document;
  }

  /** Returns `null` when the document does not exist. */
  async findById(id: string, opts?: CallOptions): Promise<Doc<T> | null> {
    try {
      const r = await this.client.request<{ document: Doc<T> }>("GET", `${this.base}/documents/${seg(id)}`, undefined, opts);
      return r.document;
    } catch (e) {
      if (e instanceof NotFoundError && e.message.startsWith("no document")) return null;
      throw e;
    }
  }

  async find(filter: Filter = {}, options: FindOptions = {}, opts?: CallOptions): Promise<{ documents: Doc<T>[]; hasMore: boolean }> {
    return this.client.request("POST", `${this.base}/query`, { filter, ...options }, opts);
  }

  async findOne(filter: Filter = {}, options: Omit<FindOptions, "limit"> = {}, opts?: CallOptions): Promise<Doc<T> | null> {
    const r = await this.find(filter, { ...options, limit: 1 }, opts);
    return r.documents[0] ?? null;
  }

  async count(filter: Filter = {}, opts?: CallOptions): Promise<number> {
    const r = await this.client.request<{ count: number }>("POST", `${this.base}/count`, { filter }, opts);
    return r.count;
  }

  /** Fails with ConflictError if the document changed since revision `expectedRev`. */
  async updateOne(id: string, expectedRev: number, update: Update, opts?: CallOptions): Promise<Doc<T>> {
    const r = await this.client.request<{ document: Doc<T> }>("PATCH", `${this.base}/documents/${seg(id)}`, { expectedRev, update }, opts);
    return r.document;
  }

  async replaceOne(id: string, expectedRev: number, document: T, opts?: CallOptions): Promise<Doc<T>> {
    const r = await this.client.request<{ document: Doc<T> }>("PUT", `${this.base}/documents/${seg(id)}`, { expectedRev, document }, opts);
    return r.document;
  }

  async deleteOne(id: string, expectedRev: number, opts?: CallOptions): Promise<void> {
    await this.client.request("DELETE", `${this.base}/documents/${seg(id)}?expectedRev=${expectedRev}`, undefined, opts);
  }
}
