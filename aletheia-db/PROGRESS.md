# Progress: AletheiaDB

Last updated: 2026-10-10.

## Live

`https://db.stateofaletheia.org` runs AletheiaDB 0.1.0 on the kortana-web VPS.
Databases created: `gov` (for aletheiagov.org), `ops` (operational checks).

## Done (v1)

- Storage engine on redb: databases, collections, JSON documents with `_id`, `_rev`, timestamps.
- Queries: filters (`$eq $ne $gt $gte $lt $lte $in $nin $exists $and $or`, dotted paths, array
  matching), sorting, paging, counting; scan cap with an index hint.
- Secondary and unique indexes, built over existing data; arrays indexed per element.
- Optimistic concurrency on update, replace and delete; idempotent writes (24 h).
- API keys: root (hash in env) and database-scoped read / readWrite / admin; revocation.
- HTTP + JSON API with typed errors, request ids, JSON logs without bodies, 15 s storage deadline.
- TypeScript client with `aletheiadb://` connection strings, typed errors, safe retries.
- Production: hardened systemd service (250 MB cap, localhost only, requires the data volume),
  nginx TLS front door, own 50 GB volume, deploy script with checksum and rollback.

## Verified

| Check | Result |
|---|---|
| `cargo test` | 13 unit + 9 end-to-end pass (incl. 8 concurrent writers: exactly one wins; data survives restart) |
| `cargo clippy --all-targets -- -D warnings` | clean |
| `cargo +1.91.1 fmt --check` | clean |
| SDK `npm test` | 8 pass, incl. the full form flow against a real server |
| Live smoke test over HTTPS | health, 401 without key, create db/collection, insert, get, patch, stale patch refused (409), query, delete, count |
| Memory in production | about 1.4 MB at idle (cap 250 MB) |
| Kortana website | unaffected (200) |

## Next

1. **Git history mirror to GitLab** ([ADR 0002](docs/decisions/0002-durability-now-git-history-next.md)): needs a private GitLab project and token.
2. Connect aletheiagov.org: create its `gov` readWrite key, set `ALETHEIADB_URL` in Vercel, replace `public-records.ts` with the client.
3. Volume backup schedule for `aletheiadb-data`.
4. A command-line shell (`aletheiadb shell`) for manual queries.
5. Fuzzing of the filter parser and key encoding; load test within the 250 MB cap.
