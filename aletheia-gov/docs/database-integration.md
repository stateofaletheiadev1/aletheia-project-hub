# AletheiaDB integration

## State on 10 October 2026

**Integrated.** The site reads and writes AletheiaDB, our own document database, at
`https://db.stateofaletheia.org`, through the TypeScript SDK (`@aletheia/aletheiadb`, vendored in
`vendor/`). Nothing is hard-coded: public records, registrations of interest, CVs, officer
accounts and the audit log all come from the database.

```
ALETHEIADB_URL=aletheiadb://<key id>:<secret>@db.stateofaletheia.org/<database>
```

| Database | Used by | Contents |
|---|---|---|
| `gov` | The site, locally and on Vercel | Real records only |

There is no demonstration database: its key was revoked on 2026-10-10, and records flagged as
test data are never displayed. The site uses a `readWrite` key for `gov` only. Keys are created on the database
server with the root key (`aletheia-db/docs/OPERATIONS.md`, "API keys").

## Collections

| Collection | Written by | Notes |
|---|---|---|
| `documents`, `decisions`, `dispatches`, `opportunities`, `public_finance`, `events` … | Publishing (scripts for now) | Public records; `src/server/records/public-records.ts` |
| `counters` | Reference numbers | Optimistic-concurrency counters (`ref:EOI:2026`, …) |
| `interest_registrations` | `/register-interest` and institution pages | ADR 0006 |
| `attachments` | CV uploads | Encrypted 128 KiB chunks |
| `subject_keys` | Encryption | One wrapped key per person (data-governance) |
| `staff_users` | Workbench | ADR 0005 |
| `audit_events` | Workbench, sign-in, scripts | Append-only by convention |

Collections and indexes are created by `scripts/db-bootstrap.mjs` (safe to re-run).

## Boundaries

- Only `src/server/**` talks to the database (`src/server/aletheiadb/client.ts`). An ESLint rule
  stops `src/app/**` importing it directly.
- Without `ALETHEIADB_URL`, the site still builds and serves every public page; record lists say
  "No records published yet" and the registration form says it is not open.

## Scripts

All take `--env-file` with the target database's settings.

| Script | Purpose |
|---|---|
| `db-bootstrap.mjs` | Create collections and indexes |
| `admin-bootstrap.mjs` | Create the first administrators (refuses once one exists) |
| `migrate-staff-keys.mjs` | Move officer accounts onto their own keys (one-off, safe to re-run) |
| `erase-person.mjs` | Erase a registrant on request |
| `list-interest.mjs` | List registrations from the command line |
