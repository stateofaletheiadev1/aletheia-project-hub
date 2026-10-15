// Collections and indexes of the `workbench` database (ADR 0002). Used by the bootstrap
// script against AletheiaDB and by the in-memory store, so both enforce the same rules.

export type CollectionSpec = { name: string; appendOnly?: boolean; unique?: string[]; indexes?: string[] };

export const SCHEMA: CollectionSpec[] = [
  { name: "officials", unique: ["id", "emailIndex"], indexes: ["state", "grants.institution"] },
  { name: "invitations", unique: ["id", "tokenHash"], indexes: ["officialId"] },
  { name: "sessions", unique: ["id", "tokenHash"], indexes: ["officialId"] },
  { name: "pending_changes", unique: ["id"], indexes: ["status", "target"] },
  { name: "audit_events", appendOnly: true, unique: ["seq", "id"], indexes: ["actorId", "action", "target.id", "correlationId"] },
  { name: "audit_head", unique: ["name"] },
  { name: "records", unique: ["id", "reference"], indexes: ["register", "institution", "state", "authorId"] },
  { name: "record_versions", appendOnly: true, unique: ["id"], indexes: ["recordId", "hash"] },
  { name: "approvals", appendOnly: true, unique: ["id"], indexes: ["recordId", "versionHash"] },
  { name: "transitions", appendOnly: true, unique: ["id"], indexes: ["recordId"] },
  { name: "outbox", unique: ["id", "idempotencyKey"], indexes: ["state", "recordId"] },
  { name: "publication_receipts", appendOnly: true, unique: ["id", "idempotencyKey"], indexes: ["recordId"] },
  { name: "counters", unique: ["name"] },
  { name: "requests", unique: ["key"] },
];

export const COLLECTIONS = SCHEMA.map((c) => c.name);
