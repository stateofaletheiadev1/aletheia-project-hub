# System reference

Discovery for the Government Operations Workbench, 15 October 2026. Every statement cites where
it was observed. "Not found" means looked for and absent, not assumed absent.

## 1. Repositories and hosting

| Item | Finding | Source |
|---|---|---|
| Repository | Monorepo `aletheia-project-hub`, branch `main`; remotes on GitLab (`origin` fetch/push) and GitHub (`github`, also a push URL of `origin`) | `git remote -v` |
| Public portal | `aletheia-gov/`, Next.js 16.4.0, React 19.3.0, TypeScript 5.9 strict, Tailwind 4.3, Zod 4.6 | `aletheia-gov/package.json` |
| Portal hosting | Vercel project `aletheia-gov`; production deploys by `vercel deploy --prod` from the folder (a git push does not deploy) | `aletheia-gov/.vercel/project.json`, team practice |
| Canonical host | `https://aletheiagov.org` answers 308 to `https://www.aletheiagov.org/` | `curl -L`, 15 Oct 2026 |
| `ops.aletheiagov.org` | Does not resolve (curl status 000) | `curl`, 15 Oct 2026 |
| Cron | One Vercel Cron job: `/api/jobs/purge-interest` daily 03:17 UTC, Bearer `CRON_SECRET` | `aletheia-gov/vercel.json` |
| CI | GitLab CI jobs for the portal (`gov:*`: check, e2e, visual, Lighthouse, gitleaks) | `aletheia-gov/PROGRESS.md` |

## 2. AletheiaDB

Rust service on redb, live at `https://db.stateofaletheia.org` (health 200 on 15 Oct 2026),
hosted on a 1 GB Oracle VPS with a 250 MB memory cap. TypeScript SDK `@aletheia/aletheiadb`
(`aletheia-db/sdk/typescript`, vendored into the portal as a tarball).

| Guarantee required by the brief (§28) | AletheiaDB v1 | Source |
|---|---|---|
| Reads, queries, pagination | Filters (`$eq … $or`), sort up to 3 fields, `limit` ≤ 1000, `skip` ≤ 10 000, `count` | `aletheia-db/docs/API.md` |
| Single-document atomicity | Yes; every write is one redb transaction | API.md, ADR 0001 |
| **Multi-document atomicity** | **No.** Each request writes one document. No batch or transaction endpoint | API.md (no such route) |
| Conflict detection | Yes. `expectedRev` on update, replace and delete; mismatch → 409, nothing written | API.md "Revisions" |
| Unique constraints | Yes. Unique secondary indexes | API.md "Indexes" |
| Idempotency | Yes. `Idempotency-Key`, 24 h, committed in the same transaction as the write | API.md |
| Read-your-writes | Yes. Single process, synchronous commit and fsync before acknowledgement | ADR 0002 |
| Authorisation | API keys per database: `read` / `readWrite` / `admin`; root for databases and keys. No per-collection or per-document scope | API.md |
| Append-only collections | **Not enforced.** A `readWrite` key may update or delete any document, including audit events | API.md roles |
| Limits | 256 KB per document; queries scanning > 50 000 documents refused without an index; 15 s storage deadline | API.md |
| Backup / PITR | Not configured. Volume backup schedule and Git history mirror listed as "Next" | `aletheia-db/PROGRESS.md`, ADR 0002 |
| Vercel compatibility | Yes. Plain HTTPS + JSON through `fetch`; the portal already uses it from Vercel functions | portal `src/server/aletheiadb/client.ts` |
| Error semantics | Typed (`Invalid`, `Conflict`, `Timeout` = outcome unknown, retry with the same key) | API.md "Errors" |

Databases on the server: `gov` (the portal), `ops` (created for operational checks, per
`aletheia-db/PROGRESS.md`), and `web` (stateofaletheia.org, per `aletheia-web/docs/BACKEND.md`).

## 3. How the public record is stored and rendered

- **One boundary:** `aletheia-gov/src/server/records/public-records.ts`. Collections per register:
  `documents`, `decisions`, `dispatches`, `finance`, `appointments`, `events`, `opportunities`
  in the `gov` database.
- **Publication** means a document in those collections with `publication.state = "published"`
  and `visibility = "public"`; every query hard-codes both. Records flagged `demo: true` are never shown.
- **Shape:** `reference, slug, title, summary?, issuer?, status?, positionType?, body[], facts[],
  publication{state, publishedAt}`. `body` is structured blocks (`paragraph`, `heading`, `list`,
  `quote`); no HTML is stored or rendered.
- **Who writes them:** nothing in the application. `docs/database-integration.md` says
  "Publishing (scripts for now)". No publishing script exists in `aletheia-gov/scripts/`.
- **Live state:** every register is empty ("No records published yet", 15 Oct 2026).

## 4. References

- Format and parser: `aletheia-gov/src/lib/references.ts`. Pattern
  `AGV-(DOC|DEC|OPP|APP|DSP|FIN|APT|EVT|INS|PRJ|EOI)-YYYY-NNNN`.
  This resolves two VERIFY items in the brief: **Appointments = `APT`, Events = `EVT`**. Also
  `APP` (applications), `INS`, `PRJ`, `EOI` (registrations of interest).
- Allocation: `aletheia-gov/src/server/records/sequence.ts`. A counter document per
  `ref:{TYPE}:{YEAR}` in `counters` (unique index on `name`), incremented with `expectedRev`;
  conflicts retry up to 8 times. Two writers can never receive the same number. It is
  **gap-tolerant**: a number can be taken and then not used if the caller fails afterwards.
- When a reference is "issued": only `EOI` is allocated today, at registration. For public
  registers nothing is defined because nothing publishes.

## 5. Content hash

The Documents page promises "every published version carries a content hash" and an "SHA-256
hash" (`src/app/(public)/documents/page.tsx` lines 16 and 25). **No hash is computed or stored
anywhere**; the public record schema has no hash or version field. The algorithm (SHA-256) is
stated, the canonicalisation is not. The workbench must define it, and the portal must show it.

## 6. Second-officer approval, previews, scheduling, corrections

| Brief item | Finding |
|---|---|
| "Approved by a second officer" (Decisions) | Stated in page copy only. Not enforced anywhere: there is no workflow |
| Homepage / register preview inclusion | By recency only (`listPublished` sorted by `publication.publishedAt`, limited). No inclusion flag |
| Scheduling | Not found |
| Unpublication, correction notices, redaction | Not found |
| Version history (Documents) | Not found in schema |

## 7. Identity, sessions and the existing workbench

The portal already contains an officers' workbench at `/workbench` (ADR 0005, 0006,
`docs/workbench.md`):

- Accounts in `gov.staff_users`; email stored as a blind index and sealed with the officer's own
  key; Argon2id (`@node-rs/argon2`); temporary password changed at first sign-in.
- Session: encrypted JWT (`jose`, A256GCM) in `__Host-agv_workbench`, SameSite=Strict, 30 min idle,
  12 h absolute; revocation by session id and a per-account session version.
- Lockout: 10 failures → 15 min; rate limits in process memory (per Vercel instance).
- Roles: `administrator`, `reviewer`, `publisher` (no permissions yet), `auditor`.
- **No MFA.** Deferred by the owner on 2026-10-10; the workbench says so on every page.
- Three accounts exist (administrators and reviewers). Function today: read registrations of
  interest and CVs, manage users, read the audit log.
- The public **Sign in** page states "Accounts are not open yet" (repo screenshot of 9 Oct).
  It is the entrance to that workbench for the three officers.

`aletheia-web` (stateofaletheia.org) has its own separate officer console (`/admin`, `web`
database, TOTP, passkeys) for citizenship and residency. It is a different institution's tool and
out of scope here.

## 8. Audit

`gov.audit_events` via `src/server/services/audit.ts`: `at, actorId, action, target, outcome,
details`. Written synchronously; "append-only by convention". **No hash chain**, and the
database cannot stop a `readWrite` key from editing or deleting events.

## 9. Content API

None. The portal has no route that accepts writes from another service.
`/api/health` and `/api/health/ready` are read-only. `/api/jobs/purge-interest` is Cron-only.

## 10. Environment and secrets

Portal variables (`src/lib/config/env.ts`): `APP_ENV`, `APP_BASE_URL`, `SECURITY_CONTACT`,
`ALETHEIADB_URL`, `AUTH_SECRET`, `CRON_SECRET`, `DATA_ENCRYPTION_MASTER_KEY`. Secrets in
git-ignored `.env*.local`; a script checks that no secret reaches the client bundle.

**Found during discovery:** the local git configuration stores a GitLab personal access
token and a GitHub personal access token in plain text inside the remote URLs. Anything that
reads `git remote -v` sees them (including tool output and logs). They should be rotated and
moved to a credential helper. Not changed by this project (outside its scope).
