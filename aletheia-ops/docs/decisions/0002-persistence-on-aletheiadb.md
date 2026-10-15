# ADR 0002: Workflow state on AletheiaDB, with atomic commits

- Status: Accepted (owner decisions D1 and D4, 15 October 2026)
- Date: 2026-10-15

## Context

AletheiaDB v1 wrote one document per request. The engine needs a transition, its events, its
audit record, tasks, reference allocation and the publication outbox to commit together.

## Decision

- AletheiaDB 0.2.0 adds `POST /v1/databases/{db}/commit` (all-or-nothing, up to 100
  operations) and append-only collections (`aletheia-db/docs/decisions/0003-…`). Deployed
  15 October 2026.
- The workbench has its own database, `workbench`. The existing `ops` database is left alone.
- Append-only collections: `record_versions`, `transitions`, `approvals`, `comments`,
  `audit_events`, `publication_receipts`. The server refuses every change to them.
- Every state-changing service call builds one commit: a `check` or `update` on the workflow
  instance (its `_rev` is the row version for optimistic concurrency), the new documents, the
  audit event, and an `update` of the audit chain head. If anyone else wrote first, the commit
  fails as a whole with `Conflict`, and the official sees "This record changed while you were
  reviewing it."
- References are allocated inside the same commit (counter `update` with its revision), so a
  reference is issued if and only if the transition that issues it is saved. No gaps from
  failed transitions.
- Every commit carries an `Idempotency-Key` derived from the request's own key, so a retried
  request returns the first result.
- Business code depends only on `ports/` (`RecordRepository`, `WorkflowRepository`,
  `AuditRepository`, `OutboxRepository`, `ReferenceAllocator`, `UnitOfWork`). An in-memory
  adapter implementing the same ports, with the same all-or-nothing semantics, backs unit and
  integration tests. It is never wired in a deployed build.

## Consequences

- One audit chain head is a single point of serialisation for writes. At the expected volume
  (a founding government) this is not a bottleneck; contention retries are bounded.
- 100 operations per commit bounds a single transition's effects; bulk actions are split into
  one commit per record.
