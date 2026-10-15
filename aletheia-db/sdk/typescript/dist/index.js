/**
 * AletheiaDB client for TypeScript / Node.js (server-side only: it holds an API key).
 *
 *   const db = AletheiaDB.connect(process.env.ALETHEIADB_URL!);
 *   //  aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/gov
 *   const people = db.collection<{ name: string }>("people");
 *   const doc = await people.insertOne({ name: "Ada" });
 *   await people.updateOne(doc._id, doc._rev, { $set: { name: "Ada L." } });
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
/**
 * Parses `aletheiadb://<keyId>:<secret>@host[:port]/<database>?tls=true&timeoutMs=10000`.
 * TLS is on by default (port 443). `tls=false` is accepted only for loopback hosts, so a
 * key is never sent unencrypted over a network.
 */
export function parseConnectionString(uri) {
    let url;
    try {
        url = new URL(uri);
    }
    catch {
        throw new InvalidError("not a valid aletheiadb:// connection string");
    }
    if (url.protocol !== "aletheiadb:")
        throw new InvalidError("connection string must start with aletheiadb://");
    const keyId = decodeURIComponent(url.username);
    const secret = decodeURIComponent(url.password);
    if (!keyId || !secret)
        throw new InvalidError("connection string must include credentials: aletheiadb://<keyId>:<secret>@host/");
    if (!url.hostname)
        throw new InvalidError("connection string must include a host");
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
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000)
        throw new InvalidError("timeoutMs must be 100-120000");
    return { baseUrl, keyId, secret, database, timeoutMs };
}
export class AletheiaDBError extends Error {
    code;
    status;
    requestId;
    constructor(code, message, status, requestId) {
        super(message);
        this.code = code;
        this.status = status;
        this.requestId = requestId;
        this.name = `${code}Error`;
    }
}
export class NotFoundError extends AletheiaDBError {
}
export class ConflictError extends AletheiaDBError {
}
export class InvalidError extends AletheiaDBError {
    constructor(message, status, requestId) {
        super("Invalid", message, status, requestId);
    }
}
export class UnauthorizedError extends AletheiaDBError {
}
export class ForbiddenError extends AletheiaDBError {
}
export class UnavailableError extends AletheiaDBError {
}
export class TimeoutError extends AletheiaDBError {
}
export class InternalError extends AletheiaDBError {
}
function errorFrom(code, message, status, requestId) {
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
// ------------------------------------------------------------------ client
export class AletheiaDB {
    options;
    fetchImpl;
    retries;
    constructor(options, clientOptions = {}) {
        this.options = options;
        this.fetchImpl = clientOptions.fetch ?? fetch;
        this.retries = clientOptions.retries ?? 2;
    }
    static connect(uri, clientOptions) {
        return new AletheiaDB(parseConnectionString(uri), clientOptions);
    }
    /** The database named in the connection string, or another one by name. */
    db(name) {
        const n = name ?? this.options.database;
        if (!n)
            throw new InvalidError("no database given in the connection string or in db(name)");
        return new Database(this, n);
    }
    /** Shortcut for `db().collection(name)`. */
    collection(name) {
        return this.db().collection(name);
    }
    async whoami(opts) {
        return this.request("GET", "/v1/whoami", undefined, opts);
    }
    async health() {
        return this.request("GET", "/health", undefined, undefined, false);
    }
    /** @internal */
    async request(method, path, body, opts = {}, auth = true) {
        const isWrite = method !== "GET" && !path.endsWith("/query") && !path.endsWith("/count");
        const idempotencyKey = isWrite ? (opts.idempotencyKey ?? globalThis.crypto.randomUUID()) : undefined;
        const headers = { Accept: "application/json" };
        if (auth)
            headers.Authorization = `Bearer ${this.options.keyId}.${this.options.secret}`;
        if (body !== undefined)
            headers["Content-Type"] = "application/json";
        if (opts.requestId)
            headers["X-Request-Id"] = opts.requestId;
        if (idempotencyKey)
            headers["Idempotency-Key"] = idempotencyKey;
        let lastError;
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            if (attempt > 0)
                await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
            const timeout = AbortSignal.timeout(this.options.timeoutMs);
            const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
            let res;
            try {
                res = await this.fetchImpl(this.options.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
            }
            catch (e) {
                if (opts.signal?.aborted)
                    throw e;
                lastError = timeout.aborted
                    ? new TimeoutError("Timeout", `AletheiaDB did not answer within ${this.options.timeoutMs} ms`)
                    : new UnavailableError("Unavailable", `cannot reach AletheiaDB: ${e.message}`);
                continue;
            }
            const text = await res.text();
            let json = undefined;
            try {
                json = text ? JSON.parse(text) : undefined;
            }
            catch {
                /* non-JSON body, handled below */
            }
            if (res.ok)
                return json;
            const err = json ?? {};
            lastError = errorFrom(err.error?.code ?? (res.status >= 500 ? "Unavailable" : "Internal"), err.error?.message ?? `HTTP ${res.status}`, res.status, err.requestId);
            if (![502, 503, 504].includes(res.status))
                throw lastError;
        }
        throw lastError ?? new UnavailableError("Unavailable", "AletheiaDB request failed");
    }
}
const seg = (s) => encodeURIComponent(s);
export class Database {
    client;
    name;
    constructor(client, name) {
        this.client = client;
        this.name = name;
    }
    collection(name) {
        return new Collection(this.client, this.name, name);
    }
    /** Root key only. Idempotent. */
    async create(opts) {
        return this.client.request("PUT", `/v1/databases/${seg(this.name)}`, undefined, opts);
    }
    /**
     * Admin role. Idempotent: safe to call on every deploy. `appendOnly` makes the server refuse
     * every update, replace and delete in the collection; it can be turned on, never off.
     */
    async ensureCollection(name, options = {}, opts) {
        const body = options.appendOnly ? { appendOnly: true } : undefined;
        return this.client.request("PUT", `/v1/databases/${seg(this.name)}/collections/${seg(name)}`, body, opts);
    }
    /**
     * Applies up to 100 operations in one transaction: all of them, or none. A stale revision,
     * unique clash or append-only refusal fails the whole commit ("operation N: ..." in the message).
     */
    async commit(operations, opts) {
        const r = await this.client.request("POST", `/v1/databases/${seg(this.name)}/commit`, { operations }, opts);
        return r.results;
    }
    async listCollections(opts) {
        const r = await this.client.request("GET", `/v1/databases/${seg(this.name)}/collections`, undefined, opts);
        return r.collections;
    }
}
export class Collection {
    client;
    database;
    name;
    base;
    constructor(client, database, name) {
        this.client = client;
        this.database = database;
        this.name = name;
        this.base = `/v1/databases/${seg(database)}/collections/${seg(name)}`;
    }
    /** Admin role. Idempotent. */
    async createIndex(field, options = {}, opts) {
        return this.client.request("PUT", `${this.base}/indexes/${seg(field)}`, { unique: options.unique ?? false }, opts);
    }
    async insertOne(document, opts) {
        const r = await this.client.request("POST", `${this.base}/documents`, { document }, opts);
        return r.document;
    }
    /** Returns `null` when the document does not exist. */
    async findById(id, opts) {
        try {
            const r = await this.client.request("GET", `${this.base}/documents/${seg(id)}`, undefined, opts);
            return r.document;
        }
        catch (e) {
            if (e instanceof NotFoundError && e.message.startsWith("no document"))
                return null;
            throw e;
        }
    }
    async find(filter = {}, options = {}, opts) {
        return this.client.request("POST", `${this.base}/query`, { filter, ...options }, opts);
    }
    async findOne(filter = {}, options = {}, opts) {
        const r = await this.find(filter, { ...options, limit: 1 }, opts);
        return r.documents[0] ?? null;
    }
    async count(filter = {}, opts) {
        const r = await this.client.request("POST", `${this.base}/count`, { filter }, opts);
        return r.count;
    }
    /** Fails with ConflictError if the document changed since revision `expectedRev`. */
    async updateOne(id, expectedRev, update, opts) {
        const r = await this.client.request("PATCH", `${this.base}/documents/${seg(id)}`, { expectedRev, update }, opts);
        return r.document;
    }
    async replaceOne(id, expectedRev, document, opts) {
        const r = await this.client.request("PUT", `${this.base}/documents/${seg(id)}`, { expectedRev, document }, opts);
        return r.document;
    }
    async deleteOne(id, expectedRev, opts) {
        await this.client.request("DELETE", `${this.base}/documents/${seg(id)}?expectedRev=${expectedRev}`, undefined, opts);
    }
}
