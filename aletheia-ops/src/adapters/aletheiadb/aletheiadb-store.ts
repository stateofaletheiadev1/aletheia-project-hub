import "server-only";
import { AletheiaDB, ConflictError, ForbiddenError, NotFoundError, TimeoutError, UnavailableError, type Database } from "@aletheia/aletheiadb";
import { StoreConflict, StoreForbidden, StoreUnavailable, type CommitOptions, type Doc, type DocumentStore, type Filter, type FindOptions, type Operation } from "@/ports/store";

// The DocumentStore on AletheiaDB (ADR 0002), through the vendored TypeScript SDK. Errors are
// translated into the port's three kinds so services never see the SDK.

function translate(e: unknown): never {
  if (e instanceof ConflictError) throw new StoreConflict(e.message);
  if (e instanceof ForbiddenError) throw new StoreForbidden(e.message);
  if (e instanceof UnavailableError || e instanceof TimeoutError) throw new StoreUnavailable(e.message);
  throw e;
}

export class AletheiaDBStore implements DocumentStore {
  private readonly db: Database;

  constructor(url: string) {
    this.db = AletheiaDB.connect(url, { retries: 1 }).db();
  }

  async get<T>(collection: string, id: string): Promise<Doc<T> | null> {
    try {
      return (await this.db.collection<T & object>(collection).findById(id)) as Doc<T> | null;
    } catch (e) {
      translate(e);
    }
  }

  async find<T>(collection: string, filter: Filter = {}, options: FindOptions = {}) {
    try {
      return (await this.db.collection<T & object>(collection).find(filter, options)) as { documents: Doc<T>[]; hasMore: boolean };
    } catch (e) {
      translate(e);
    }
  }

  async findOne<T>(collection: string, filter: Filter, options: Omit<FindOptions, "limit"> = {}) {
    try {
      return (await this.db.collection<T & object>(collection).findOne(filter, options)) as Doc<T> | null;
    } catch (e) {
      translate(e);
    }
  }

  async count(collection: string, filter: Filter = {}) {
    try {
      return await this.db.collection(collection).count(filter);
    } catch (e) {
      translate(e);
    }
  }

  async commit(operations: Operation[], options: CommitOptions = {}) {
    try {
      const results = await this.db.commit(operations, { idempotencyKey: options.idempotencyKey, requestId: options.correlationId });
      return results.map((r) => ("document" in r ? (r.document as Doc<Record<string, unknown>>) : null));
    } catch (e) {
      // Inside a commit, a document that has gone is a conflict like any other concurrent change.
      if (e instanceof NotFoundError && e.message.startsWith("operation ")) throw new StoreConflict(e.message);
      translate(e);
    }
  }
}
