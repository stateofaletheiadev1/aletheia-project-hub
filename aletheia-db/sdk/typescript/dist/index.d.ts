/**
 * AletheiaDB client for TypeScript / Node.js (server-side only: it holds an API key).
 *
 *   const db = AletheiaDB.connect(process.env.ALETHEIADB_URL!);
 *   //  aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/gov
 *   const people = db.collection<{ name: string }>("people");
 *   const doc = await people.insertOne({ name: "Ada" });
 *   await people.updateOne(doc._id, doc._rev, { $set: { name: "Ada L." } });
 */
export interface ConnectionOptions {
    /** https://host[:port] the client talks to. */
    baseUrl: string;
    keyId: string;
    secret: string;
    /** Default database from the path, if any. */
    database?: string;
    timeoutMs: number;
}
/**
 * Parses `aletheiadb://<keyId>:<secret>@host[:port]/<database>?tls=true&timeoutMs=10000`.
 * TLS is on by default (port 443). `tls=false` is accepted only for loopback hosts, so a
 * key is never sent unencrypted over a network.
 */
export declare function parseConnectionString(uri: string): ConnectionOptions;
export type ErrorCode = "NotFound" | "Conflict" | "Invalid" | "Unauthorized" | "Forbidden" | "Unavailable" | "Timeout" | "Internal";
export declare class AletheiaDBError extends Error {
    readonly code: ErrorCode;
    readonly status?: number | undefined;
    readonly requestId?: string | undefined;
    constructor(code: ErrorCode, message: string, status?: number | undefined, requestId?: string | undefined);
}
export declare class NotFoundError extends AletheiaDBError {
}
export declare class ConflictError extends AletheiaDBError {
}
export declare class InvalidError extends AletheiaDBError {
    constructor(message: string, status?: number, requestId?: string);
}
export declare class UnauthorizedError extends AletheiaDBError {
}
export declare class ForbiddenError extends AletheiaDBError {
}
export declare class UnavailableError extends AletheiaDBError {
}
export declare class TimeoutError extends AletheiaDBError {
}
export declare class InternalError extends AletheiaDBError {
}
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
/** One operation of an atomic commit (`Database.commit`). */
export type Operation = {
    op: "insert";
    collection: string;
    document: Record<string, unknown>;
} | {
    op: "update";
    collection: string;
    id: string;
    expectedRev: number;
    update: Update;
} | {
    op: "replace";
    collection: string;
    id: string;
    expectedRev: number;
    document: Record<string, unknown>;
} | {
    op: "delete";
    collection: string;
    id: string;
    expectedRev: number;
} | {
    op: "check";
    collection: string;
    id: string;
    expectedRev: number;
};
/** Per operation, in order: the written document, `{ _id, deleted }`, or `{ _id, _rev }` for a check. */
export type OperationResult = {
    document: Doc<Record<string, unknown>>;
} | {
    _id: string;
    deleted: true;
} | {
    _id: string;
    _rev: number;
};
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
export declare class AletheiaDB {
    readonly options: ConnectionOptions;
    private readonly fetchImpl;
    private readonly retries;
    private constructor();
    static connect(uri: string, clientOptions?: ClientOptions): AletheiaDB;
    /** The database named in the connection string, or another one by name. */
    db(name?: string): Database;
    /** Shortcut for `db().collection(name)`. */
    collection<T extends object = Record<string, unknown>>(name: string): Collection<T>;
    whoami(opts?: CallOptions): Promise<{
        keyId: string;
        role: string;
        database?: string;
    }>;
    health(): Promise<{
        status: string;
        version: string;
    }>;
    /** @internal */
    request<R>(method: string, path: string, body?: unknown, opts?: CallOptions, auth?: boolean): Promise<R>;
}
export declare class Database {
    private readonly client;
    readonly name: string;
    constructor(client: AletheiaDB, name: string);
    collection<T extends object = Record<string, unknown>>(name: string): Collection<T>;
    /** Root key only. Idempotent. */
    create(opts?: CallOptions): Promise<{
        created: boolean;
    }>;
    /**
     * Admin role. Idempotent: safe to call on every deploy. `appendOnly` makes the server refuse
     * every update, replace and delete in the collection; it can be turned on, never off.
     */
    ensureCollection(name: string, options?: {
        appendOnly?: boolean;
    }, opts?: CallOptions): Promise<{
        created: boolean;
    }>;
    /**
     * Applies up to 100 operations in one transaction: all of them, or none. A stale revision,
     * unique clash or append-only refusal fails the whole commit ("operation N: ..." in the message).
     */
    commit(operations: Operation[], opts?: CallOptions): Promise<OperationResult[]>;
    listCollections(opts?: CallOptions): Promise<{
        name: string;
        createdAt: string;
    }[]>;
}
export declare class Collection<T extends object> {
    private readonly client;
    readonly database: string;
    readonly name: string;
    private readonly base;
    constructor(client: AletheiaDB, database: string, name: string);
    /** Admin role. Idempotent. */
    createIndex(field: string, options?: {
        unique?: boolean;
    }, opts?: CallOptions): Promise<{
        created: boolean;
    }>;
    insertOne(document: T, opts?: CallOptions): Promise<Doc<T>>;
    /** Returns `null` when the document does not exist. */
    findById(id: string, opts?: CallOptions): Promise<Doc<T> | null>;
    find(filter?: Filter, options?: FindOptions, opts?: CallOptions): Promise<{
        documents: Doc<T>[];
        hasMore: boolean;
    }>;
    findOne(filter?: Filter, options?: Omit<FindOptions, "limit">, opts?: CallOptions): Promise<Doc<T> | null>;
    count(filter?: Filter, opts?: CallOptions): Promise<number>;
    /** Fails with ConflictError if the document changed since revision `expectedRev`. */
    updateOne(id: string, expectedRev: number, update: Update, opts?: CallOptions): Promise<Doc<T>>;
    replaceOne(id: string, expectedRev: number, document: T, opts?: CallOptions): Promise<Doc<T>>;
    deleteOne(id: string, expectedRev: number, opts?: CallOptions): Promise<void>;
}
export {};
