# ADR 0003: Atomic multi-document commit and append-only collections

- Status: Accepted (owner, 15 October 2026)
- Date: 2026-10-15

## Context

The Government Operations Workbench (`aletheia-ops/`) runs a workflow engine whose brief
requires that a state change, its transition event, its audit event, any task and any publication
outbox entry commit together or not at all. v1 writes one document per request. It also requires
that the application's own key cannot edit or delete audit events.

## Decision

- `POST /v1/databases/{db}/commit`: up to 100 insert, update, replace, delete and check
  operations, applied in order inside one redb write transaction. The first failure aborts the
  transaction (redb drops uncommitted writes), so the effect is all or nothing. Idempotency keys
  apply to the commit as a whole.
- `appendOnly` flag on collections, stored in the catalogue. When set, the server refuses
  update, replace and delete for every key, root included. It can be set on an existing collection
  and never cleared through the API.
- Existing endpoints, documents and keys are unchanged. Old catalogue entries read as
  `appendOnly: false`.

## Consequences

- Writes are already serialised (one write transaction at a time), so a commit cannot interleave
  with another write. Its cost is the sum of its operations; 100 is a guard against one request
  holding the writer for long.
- Append-only is enforced by this server, not by the file: someone with shell access to the
  VPS and the data file can still change it. Tamper *evidence* (hash chains) stays the
  application's job.
- Version 0.2.0.
