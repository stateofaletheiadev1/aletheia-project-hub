# Data governance

What personal data the site keeps, for how long, and how it is erased. The privacy page
(`/privacy`) says the same to the public; keep the two in step.

## What is kept

| Data | Where | Protection |
|---|---|---|
| Registrant's name, email, notes | `interest_registrations.pii` | Encrypted under the person's key |
| Registrant's CVs (PDF, at most 2 MB, last 3) | `attachments` (128 KiB chunks) | Encrypted under the person's key; SHA-256 checked on read |
| Institutions, expertise, status, dates | `interest_registrations` | Readable, for filtering and counting |
| Officer's name and email | `staff_users.pii` | Encrypted under the officer's own key (`staff-person`) |
| Officer's password | `staff_users.passwordHash` | Argon2id hash only |
| Who did what, when | `audit_events` | No personal data in clear; ids and references only |

## Keys

- Every person has their own data key in `subject_keys`, wrapped (AES-256-GCM) by the master key
  `DATA_ENCRYPTION_MASTER_KEY`, which is held only in the application's server secrets, never in
  the database.
- Applicants' keys (`person-email`) and officers' keys (`staff-person`) are separate families.
- Losing the production master key makes every registration unreadable: keep an offline copy
  with the owner.

## Retention

- A registration and its CVs are kept for **12 months after the person's latest registration**
  (`retainUntil`).
- A daily job, `GET /api/jobs/purge-interest` (Vercel cron at 03:17 UTC, `Authorization: Bearer
  CRON_SECRET`), erases every registration past `retainUntil`.

## Erasure

Erasure destroys the person's key first, then deletes the registration and CV chunks. Once the
key is gone, every copy (database history, backups) is unreadable.

- On request: `node --env-file=<env file> scripts/erase-person.mjs person@example.org` (dry run),
  then add `--confirm`.
- Automatically: the retention job above.

## Live only

The site uses the live database `gov` only. There is no demonstration data: a record flagged as
test data is never displayed (`src/server/records/public-records.ts`). The former practice
database's access key was revoked on 2026-10-10.
