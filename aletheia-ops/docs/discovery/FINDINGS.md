# Discovery findings

15 October 2026. Details and sources: [SYSTEM_REFERENCE.md](SYSTEM_REFERENCE.md) and
[DESIGN_REFERENCE.md](DESIGN_REFERENCE.md).

## What exists

- **The public portal** (`aletheia-gov/`, Next.js 16 on Vercel, `www.aletheiagov.org`). Every
  public register reads `gov` collections in AletheiaDB, filtered to
  `publication.state = "published"` and `visibility = "public"`. All registers are empty today.
- **A small officers' workbench inside the portal** (`/workbench`): three officer accounts,
  Argon2id passwords, encrypted session cookie, roles, an audit log, and reading of
  registrations of interest and CVs. No MFA (deferred by the owner).
- **AletheiaDB** (live): document store with revision checks, unique indexes, idempotency
  keys and per-database API keys.
- **Reference allocation** that cannot hand out the same number twice (counter documents
  with revision checks).
- **A finished visual language** ("Ledger and the Sea"): navy, parchment, seal gold, laurel green,
  gold hairlines, section marks, status seals with distinct glyphs, and honest empty registers.

## What is missing

1. **A way to publish.** Nothing writes published records. There is no publishing script,
   no content API and no workflow.
2. **Multi-document atomicity in AletheiaDB.** The brief (§22) requires the state change,
   transition event, audit event, task and outbox entry to commit together. AletheiaDB commits one
   document per request.
3. **Content hashes and versions.** The portal promises SHA-256 hashes and version history for
   Documents. Neither exists in the schema.
4. **Second-officer approval** is stated in copy and not enforced anywhere.
5. **Tamper evidence for audit.** No hash chain; a `readWrite` key can edit or delete events.
6. **MFA** for officers.
7. Scheduling, corrections, withdrawal and homepage inclusion flags on the portal.
8. `ops.aletheiagov.org` does not exist yet (no DNS record, no Vercel project).

## What is unknown

- Who, institutionally, may approve and publish each register. The brief's defaults are used
  as initial policy, and they are editable only under the two-person rule.
- Whether the portal's in-site `/workbench` should eventually be retired in favour of this
  application (it overlaps: users, roles, audit).
- Backup cadence for the AletheiaDB volume (not configured).

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| No multi-document transactions | A crash between writes leaves a transition without its audit event or outbox entry | Decision D1 |
| Audit editable by the app's own key | Tamper-*evident* is achievable (hash chain); tamper-*proof* is not | Hash chain now, and append-only collections in AletheiaDB (D1) |
| One small VPS (1 GB, 250 MB cap) for every database | Load from the workbench competes with the portal | Server-side pagination, indexes on every filter, no polling loops |
| No database backups | Loss of the volume loses workflow history | Raise with the owner; outside this app |
| Tokens in git remote URLs | Leaked credentials for GitLab and GitHub | Rotate; use a credential helper |
| Portal copy promises hashes and versions that do not exist | Public statement not backed by the system | Built by the workbench + publication endpoint (D2) |

## Decisions needed from leadership

### D1. Atomic writes for workflow state

The engine needs several documents to commit together, or not at all.

| Option | What | Cost |
|---|---|---|
| **A (recommended)** | Add one endpoint to AletheiaDB: `POST /v1/databases/{db}/commit`, a list of inserts, updates and deletes with `expectedRev` preconditions, applied in **one redb write transaction**. Also add an `appendOnly` collection flag (insert-only, enforced by the server) for audit and transition events. | About 1–2 days in `aletheia-db`; one redeploy of the database server. No new dependency, no new cost. Existing endpoints and guarantees unchanged. |
| B | No database change. Keep the state, events and outbox entries in one workflow document per record (≤ 256 KB) and project them into other collections afterwards, idempotently. | More complex application code; registers and the audit register lag behind by one projection step; very long histories must be split. |
| C | A separate transactional database (for example PostgreSQL) for workflow state. | New dependency, and you have ruled out PostgreSQL and MongoDB. Not proposed. |

### D2. How the workbench publishes to aletheiagov.org

| Option | What | Cost |
|---|---|---|
| **A (recommended)** | Add a small signed endpoint to the portal: `POST /api/publications` and `GET /api/publications/{key}`. HMAC-SHA256 over method, path, timestamp and body hash; 5-minute window; two active keys for rotation. The portal re-validates the payload and hash, then writes the record into `gov`. | Backend change to the portal only (no visual change). The workbench never holds a write key for the public record. |
| B | The workbench writes the public collections in `gov` directly with its own key. | Simpler, but the portal never checks what it is asked to publish, and the workbench's key can rewrite the public record. |

### D3. Accounts for ops.aletheiagov.org

| Option | What |
|---|---|
| **A (recommended)** | The workbench has its own accounts in its own database, invitation-only, with MFA (authenticator app) **required** for approvers, publishers and administrators. The portal's `/workbench` keeps working for registrations of interest until that work moves into the new workbench in a later phase. |
| B | Share `gov.staff_users` with the portal's workbench. One password for both, but the new MFA and invitation rules would have to be retrofitted into the portal. |

### D4. Database for the workbench (follows D1 and D3)

Create a new AletheiaDB database `workbench` (the existing `ops` database was created for
operational checks and is left alone), with an `admin` key for setup and a `readWrite` key for
the application. This needs the root key on the database server, so you or I (with your approval)
run it there.

## Proceeding now

Independent of the answers: the application skeleton, design tokens, Manrope setup, the
owned component library, the frame, the `/design` route, the domain model, the workflow
engine (pure and fully unit-tested), the permission matrix and the repository interfaces.
Adapters behind those interfaces follow once D1–D4 are settled.
