// The storage port (ADR 0002). Services depend on this interface, never on AletheiaDB or any
// other technology. Two adapters implement it with the same semantics: AletheiaDB in every
// deployed environment, and an in-memory store for unit and integration tests.
//
// Semantics every adapter must honour:
// - documents carry `_id`, `_rev`, `_createdAt`, `_updatedAt`, set by the store;
// - `commit` applies all operations or none; a stale `expectedRev`, a unique clash or a write
//   to an append-only collection fails the whole commit with StoreConflict / StoreForbidden;
// - a commit retried with the same idempotency key returns the first result.

export type Meta = { _id: string; _rev: number; _createdAt: string; _updatedAt: string };
export type Doc<T> = T & Meta;
export type Filter = Record<string, unknown>;
export type FindOptions = { sort?: Record<string, 1 | -1>; limit?: number; skip?: number };
export type Update = { $set?: Record<string, unknown>; $unset?: string[]; $inc?: Record<string, number> };

export type Operation =
  | { op: "insert"; collection: string; document: Record<string, unknown> }
  | { op: "update"; collection: string; id: string; expectedRev: number; update: Update }
  | { op: "delete"; collection: string; id: string; expectedRev: number }
  | { op: "check"; collection: string; id: string; expectedRev: number };

export type CommitOptions = { idempotencyKey?: string; correlationId?: string };

export interface DocumentStore {
  get<T>(collection: string, id: string): Promise<Doc<T> | null>;
  find<T>(collection: string, filter?: Filter, options?: FindOptions): Promise<{ documents: Doc<T>[]; hasMore: boolean }>;
  findOne<T>(collection: string, filter: Filter, options?: Omit<FindOptions, "limit">): Promise<Doc<T> | null>;
  count(collection: string, filter?: Filter): Promise<number>;
  /** All or nothing. Returns, per operation, the written document (insert, update) or null. */
  commit(operations: Operation[], options?: CommitOptions): Promise<(Doc<Record<string, unknown>> | null)[]>;
}

/** Someone else wrote first, or a unique value is taken. Safe to re-read and retry. */
export class StoreConflict extends Error {
  override name = "StoreConflict";
}
/** The store refused the write by rule (for example an append-only collection). */
export class StoreForbidden extends Error {
  override name = "StoreForbidden";
}
/** The store could not be reached or did not answer in time; the outcome may be unknown. */
export class StoreUnavailable extends Error {
  override name = "StoreUnavailable";
}
