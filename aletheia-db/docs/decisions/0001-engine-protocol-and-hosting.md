# ADR 0001: Engine, protocol and hosting for v1

- Status: Accepted
- Date: 2026-10-10

## Context

The government platform (aletheiagov.org, Next.js on Vercel) needs a database for forms and
public records: Next.js app, then its backend, then `db.stateofaletheia.org`, then CRUD with
JSON back. The owner wants our own engine, not MongoDB or PostgreSQL, with an
`aletheiadb://` connection string. Hosting is the kortana-web Oracle VPS: 1 GB RAM shared with
the Kortana website, a 250 MB memory budget, a dedicated 50 GB volume.

## Decisions

1. **Rust, single static binary.** Every dependency is pure Rust, so a musl binary is
   cross-compiled on any machine with Rust's bundled linker. No compiler on the server.
2. **Storage on redb** (embedded, ACID, crash-safe, copy-on-write B-trees, pure Rust). Our code
   owns the data model: catalog, documents, secondary indexes with an order-preserving key
   encoding, and idempotency records. One writer at a time; every commit is fsynced before
   the API answers.
3. **HTTP + JSON, not a binary wire protocol.** Simple to debug, works through nginx and any
   proxy, and is easy to call from Vercel. `aletheiadb://` is a client-side connection string
   that the SDK maps to `https://` (comparable to `mongodb+srv://`). A binary protocol can be
   added later if throughput ever needs it.
4. **TLS and rate limiting at nginx**, which already runs on the box with automatic
   certificates. AletheiaDB listens on localhost only, so there is no new public port.
5. **API keys with database-scoped roles** (read, readWrite, admin) plus a root key whose hash
   lives in the environment, not the database. Secrets are 256-bit random, so SHA-256 is the
   right hash (Argon2 is for low-entropy passwords). Compared in constant time.
6. **Optimistic concurrency** through `_rev` on every update, replace and delete, and
   **idempotency keys** stored in the same transaction as the write, as the government
   platform's adapter contract requires.
7. **v1 non-goals:** replication, sharding, multi-document transactions, aggregation
   pipelines, server-side scripts, regex queries.

## Consequences

- Fits the memory budget easily (about 1.4 MB at idle).
- Single node: availability equals the VPS's. Recovery is from volume backups (OPERATIONS.md).
- Throughput is bounded by one writer and fsync per commit, far above the government
  platform's needs.
