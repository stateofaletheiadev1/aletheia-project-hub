# AletheiaDB

The document database of the Sovereign Covenant State of Aletheia. Our own engine, written in
Rust: JSON documents in collections, revisions for safe concurrent edits, secondary and unique
indexes, scoped API keys, and idempotent writes, served over HTTPS + JSON.

**Live:** `https://db.stateofaletheia.org` (status: [PROGRESS.md](PROGRESS.md))

```
aletheiagov.org (Next.js on Vercel)
   │  backend calls with an API key, via the TypeScript client
   ▼
aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/gov
   │  HTTPS (nginx: TLS, rate limits) on the kortana-web Oracle VPS
   ▼
AletheiaDB on 127.0.0.1:7790 ──► /srv/aletheiadb/data (own 50 GB volume)
```

## Using it from a backend

```ts
import { AletheiaDB } from "@aletheia/aletheiadb";

const db = AletheiaDB.connect(process.env.ALETHEIADB_URL!); // server-side only
const interest = db.collection<{ email: string; institution: string }>("interest");

const saved = await interest.insertOne({ email: "ada@example.org", institution: "treasury" });
const found = await interest.find({ institution: "treasury" }, { sort: { _createdAt: -1 }, limit: 20 });
await interest.updateOne(saved._id, saved._rev, { $set: { status: "reviewed" } });
```

The client lives in [`sdk/typescript`](sdk/typescript). Full HTTP reference: [docs/API.md](docs/API.md).

## Build and test

```sh
cargo test                       # 13 unit + 9 end-to-end tests
cargo clippy --all-targets -- -D warnings
cargo +1.91.1 fmt --check
cd sdk/typescript && npm install && npm test   # client tests, incl. against a real server
```

## Deploy

One static Linux binary, cross-compiled from any machine (every dependency is pure Rust):

```sh
SSH_KEY=/path/to/kortana-web.key deploy/deploy.sh
```

It builds, uploads, checks the checksum, keeps the previous binary for rollback, restarts the
service and checks health. Operations, keys, backups and restore: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Layout

| Path | What |
|---|---|
| `src/store.rs` | Storage engine on redb: catalog, documents, indexes, idempotency |
| `src/query.rs` | Filter language, sorting, update operators, validation |
| `src/encoding.rs` | Order-preserving key and index-value encoding |
| `src/auth.rs` | API keys and roles |
| `src/api.rs` | HTTP + JSON API |
| `src/main.rs` | `aletheiadb serve | keygen | version` |
| `tests/api.rs` | End-to-end tests through the HTTP API |
| `sdk/typescript` | `aletheiadb://` client for Node.js |
| `deploy/` | Deploy script, systemd unit and nginx site as running in production |
| `docs/` | API reference, operations, decisions |
