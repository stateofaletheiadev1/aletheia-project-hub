// An in-memory DocumentStore with AletheiaDB's semantics (revisions, unique indexes,
// append-only collections, all-or-nothing commits, idempotent replays). For tests only: it is
// never wired into a deployed build (services/runtime.ts refuses it outside tests).

import { randomUUID } from "node:crypto";
import { SCHEMA, type CollectionSpec } from "../schema";
import { StoreConflict, StoreForbidden, type CommitOptions, type Doc, type DocumentStore, type Filter, type FindOptions, type Operation, type Update } from "@/ports/store";

type Row = Doc<Record<string, unknown>>;

function getPath(doc: unknown, path: string): unknown {
  let cur: unknown = doc;
  for (const part of path.split(".")) {
    if (Array.isArray(cur)) return cur.map((x) => getPath(x, part)).flat();
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function cmp(a: unknown, b: unknown): number | null {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  return null;
}

function valueMatches(actual: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object" && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith("$"))) {
    return Object.entries(cond as Record<string, unknown>).every(([op, v]) => {
      switch (op) {
        case "$eq":
          return valueMatches(actual, v);
        case "$ne":
          return !valueMatches(actual, v);
        case "$in":
          return (v as unknown[]).some((x) => valueMatches(actual, x));
        case "$nin":
          return !(v as unknown[]).some((x) => valueMatches(actual, x));
        case "$exists":
          return (actual !== undefined) === v;
        case "$gt":
        case "$gte":
        case "$lt":
        case "$lte": {
          const vals = Array.isArray(actual) ? actual : [actual];
          return vals.some((a) => {
            const c = cmp(a, v);
            if (c === null) return false;
            return op === "$gt" ? c > 0 : op === "$gte" ? c >= 0 : op === "$lt" ? c < 0 : c <= 0;
          });
        }
        default:
          throw new Error(`unsupported operator ${op}`);
      }
    });
  }
  if (Array.isArray(actual) && !Array.isArray(cond)) return actual.some((a) => valueMatches(a, cond));
  return JSON.stringify(actual) === JSON.stringify(cond);
}

export function matches(doc: unknown, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (k === "$and") return (v as Filter[]).every((f) => matches(doc, f));
    if (k === "$or") return (v as Filter[]).some((f) => matches(doc, f));
    return valueMatches(getPath(doc, k), v);
  });
}

function applyUpdate(doc: Record<string, unknown>, u: Update): void {
  const setPath = (path: string, value: unknown) => {
    const parts = path.split(".");
    let cur = doc as Record<string, unknown>;
    for (const p of parts.slice(0, -1)) {
      if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
    cur[parts.at(-1)!] = value;
  };
  for (const [k, v] of Object.entries(u.$set ?? {})) setPath(k, structuredClone(v));
  for (const k of u.$unset ?? []) {
    const parts = k.split(".");
    let cur = doc as Record<string, unknown> | undefined;
    for (const p of parts.slice(0, -1)) cur = cur?.[p] as Record<string, unknown> | undefined;
    if (cur) delete cur[parts.at(-1)!];
  }
  for (const [k, v] of Object.entries(u.$inc ?? {})) setPath(k, ((getPath(doc, k) as number | undefined) ?? 0) + v);
}

export class MemoryStore implements DocumentStore {
  private data = new Map<string, Map<string, Row>>();
  private specs = new Map<string, CollectionSpec>();
  private replays = new Map<string, { fingerprint: string; result: (Row | null)[] }>();
  /** Every committed operation list, for tests that inspect atomicity. */
  readonly commits: Operation[][] = [];
  /** Set to make the next commit fail as if the store were unreachable (tests). */
  failNext: Error | null = null;

  constructor(schema: CollectionSpec[] = SCHEMA) {
    for (const s of schema) {
      this.specs.set(s.name, s);
      this.data.set(s.name, new Map());
    }
  }

  private coll(name: string, data = this.data): Map<string, Row> {
    const c = data.get(name);
    if (!c) throw new Error(`collection '${name}' does not exist`);
    return c;
  }

  async get<T>(collection: string, id: string): Promise<Doc<T> | null> {
    const d = this.coll(collection).get(id);
    return d ? (structuredClone(d) as Doc<T>) : null;
  }

  async find<T>(collection: string, filter: Filter = {}, options: FindOptions = {}): Promise<{ documents: Doc<T>[]; hasMore: boolean }> {
    const rows = [...this.coll(collection).values()].filter((d) => matches(d, filter));
    const sort = Object.entries(options.sort ?? {});
    rows.sort((a, b) => {
      for (const [field, dir] of sort) {
        const c = cmp(getPath(a, field), getPath(b, field)) ?? 0;
        if (c !== 0) return c * dir;
      }
      return a._id < b._id ? -1 : 1;
    });
    const skip = options.skip ?? 0;
    const limit = options.limit ?? 100;
    const page = rows.slice(skip, skip + limit);
    return { documents: structuredClone(page) as Doc<T>[], hasMore: rows.length > skip + limit };
  }

  async findOne<T>(collection: string, filter: Filter, options: Omit<FindOptions, "limit"> = {}): Promise<Doc<T> | null> {
    return (await this.find<T>(collection, filter, { ...options, limit: 1 })).documents[0] ?? null;
  }

  async count(collection: string, filter: Filter = {}): Promise<number> {
    return [...this.coll(collection).values()].filter((d) => matches(d, filter)).length;
  }

  async commit(operations: Operation[], options: CommitOptions = {}): Promise<(Row | null)[]> {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    const fingerprint = JSON.stringify(operations);
    if (options.idempotencyKey) {
      const prior = this.replays.get(options.idempotencyKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new StoreConflict("this idempotency key was already used for a different request");
        return structuredClone(prior.result);
      }
    }
    if (operations.length === 0 || operations.length > 100) throw new Error("a commit holds 1 to 100 operations");

    // Work on a copy; swap it in only if every operation succeeds.
    const draft = new Map([...this.data].map(([k, v]) => [k, new Map([...v].map(([id, d]) => [id, structuredClone(d)]))]));
    const now = new Date().toISOString();
    const results: (Row | null)[] = [];
    operations.forEach((op, i) => {
      const c = this.coll(op.collection, draft);
      const spec = this.specs.get(op.collection)!;
      const at = (m: string) => `operation ${i}: ${m}`;
      if (op.op === "insert") {
        if (Object.keys(op.document).some((k) => k.startsWith("_"))) throw new Error(at("fields starting with _ are reserved"));
        const doc: Row = { ...structuredClone(op.document), _id: randomUUID().replace(/-/g, ""), _rev: 1, _createdAt: now, _updatedAt: now };
        this.checkUnique(c, spec, doc, i);
        c.set(doc._id, doc);
        results.push(structuredClone(doc));
        return;
      }
      const current = c.get(op.id);
      if (!current) throw new StoreConflict(at(`no document '${op.id}' in ${op.collection}`));
      if (current._rev !== op.expectedRev) throw new StoreConflict(at(`this document changed since you read it (expected revision ${op.expectedRev}, current ${current._rev})`));
      if (op.op === "check") {
        results.push(null);
        return;
      }
      if (spec.appendOnly) throw new StoreForbidden(at(`collection '${op.collection}' is append-only`));
      if (op.op === "delete") {
        c.delete(op.id);
        results.push(null);
        return;
      }
      const next = structuredClone(current) as Row;
      applyUpdate(next as Record<string, unknown>, op.update);
      next._id = current._id;
      next._rev = current._rev + 1;
      next._createdAt = current._createdAt;
      next._updatedAt = now;
      this.checkUnique(c, spec, next, i);
      c.set(next._id, next);
      results.push(structuredClone(next));
    });
    this.data = draft;
    this.commits.push(structuredClone(operations));
    if (options.idempotencyKey) this.replays.set(options.idempotencyKey, { fingerprint, result: structuredClone(results) });
    return results;
  }

  private checkUnique(c: Map<string, Row>, spec: CollectionSpec, doc: Row, i: number): void {
    for (const field of spec.unique ?? []) {
      const v = getPath(doc, field);
      if (v === undefined) continue;
      for (const other of c.values()) {
        if (other._id !== doc._id && JSON.stringify(getPath(other, field)) === JSON.stringify(v)) {
          throw new StoreConflict(`operation ${i}: another document already has this value for unique field '${field}'`);
        }
      }
    }
  }
}
