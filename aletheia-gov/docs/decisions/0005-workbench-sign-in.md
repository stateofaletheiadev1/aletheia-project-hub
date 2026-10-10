# ADR 0005: Officers' workbench sign-in, roles and sessions

- Status: Accepted
- Date: 2026-10-10

## Context

Registrations of interest (with CVs) must be read by founding-government officers, and nobody
else. The owner asked for a signed-in area with a side menu. There is no identity provider yet,
and two-factor sign-in was **deferred by the owner** on 2026-10-10.

## Decision

- **Accounts** live in AletheiaDB (`staff_users`). The email is stored only as a blind index
  (`staff-email`) and, with the name, encrypted under the officer's own key (`staff-person`).
  Staff keys are a separate family from applicants' keys (`person-email`), so erasing a
  registration can never make an account unreadable (`scripts/migrate-staff-keys.mjs` moved the
  first accounts across).
- **Passwords:** Argon2id (`@node-rs/argon2`, m=19456 KiB, t=2, p=1). At least 12 characters,
  not containing the email name. Administrators set a temporary password; the officer must
  choose their own at first sign-in, and nothing else in the workbench opens until they do.
  After that first change the officer lands on My office.
- **Sessions:** an encrypted JWT (`jose`, `dir` + `A256GCM`, key derived from `AUTH_SECRET`) in
  the cookie `__Host-agv_workbench` (HttpOnly, Secure, SameSite=Strict). 30 minutes idle,
  12 hours absolute. Sign-out revokes the session id; "sign out everywhere" and password
  changes bump the account's session version.
- **Lockout and limits:** 10 failed sign-ins lock an account for 15 minutes; 20 attempts per
  minute per address and 5 per account. Messages never say which part was wrong.
- **Roles** (`src/server/authorization/policies.ts`): administrator (accounts), reviewer
  (registrations and CVs), publisher, auditor (audit log). Administrators do not read
  registrations unless they are also reviewers. Nobody can change their own roles or disable
  themselves, and the last administrator cannot be removed. Anything a role may not see is a 404.
- **Audit:** sign-ins, password changes, every list, view, CV preview and download, status change
  and account change is written to `audit_events`.
- **Page protection:** `src/proxy.ts` sends anyone without a valid session to `/sign-in`, and
  gives workbench pages a nonce CSP, `no-store` and `noindex`.
- **First administrator:** `scripts/admin-bootstrap.mjs` (refuses once any administrator exists).

## Consequences

- Two-factor sign-in is not there yet. The workbench says so on every page. It must be added
  before the workbench handles real records at volume (planned: authenticator-app TOTP).
- Rate limits and lockout counters for sign-in share the in-memory store of
  [ADR 0004](0004-in-memory-rate-limit.md). On Vercel each instance counts separately; the
  per-account lockout is stored in the database and is not affected.
- No email: password resets are done by an administrator setting a new temporary password.
