# Implementation log

## 15 October 2026

**Phase 1, discovery.**

Done:
- Read the master prompt (v2.0) in full.
- Inspected the portal source (`aletheia-gov/`): records boundary, references, sequence
  allocation, workbench auth (ADR 0005), registrations (ADR 0006), audit, env, tokens, CSS,
  components, Vercel config.
- Inspected AletheiaDB (`aletheia-db/`): API, guarantees, durability ADR, progress.
- Checked live endpoints: `www.aletheiagov.org` (registers empty, edition 15 October 2026),
  `db.stateofaletheia.org/health` (200), `ops.aletheiagov.org` (does not resolve).
- Wrote `docs/discovery/FINDINGS.md`, `SYSTEM_REFERENCE.md`, `DESIGN_REFERENCE.md`.

Verified: see the source column in SYSTEM_REFERENCE.md.

Assumed: none of the live pages were rendered in a browser yet; design observations come
from source and the portal's committed screenshots of 9 October.

Blocked on leadership: D1 (atomic writes), D2 (publication path), D3 (accounts), D4 (database).

Found outside scope: plaintext access tokens in the git remote URLs (reported, not changed).

**Leadership decisions (15 October 2026), all as recommended:** D1 extend AletheiaDB with an
atomic commit; D2 publish through a signed endpoint on the portal; D3 own accounts with MFA;
D4 create database `workbench`. Recorded in ADRs 0002, 0003 and 0004.

**AletheiaDB 0.2.0 (D1).** `POST /v1/databases/{db}/commit` (all-or-nothing, up to 100
operations) and append-only collections, with SDK support. Verified: `cargo test` 13 unit + 12
end-to-end pass, including rollback on stale revision, rollback on unique clash, idempotent
replay, and append-only refusal for the root key; clippy and fmt clean; SDK 9 tests pass
against a real server. Deployed to db.stateofaletheia.org; `/health/ready` reports 0.2.0, ready.
The deploy script now sets the execute bit that scp from Windows drops (the first attempt
stopped before installing anything). Not verified by me: that aletheiagov.org still reads
records after the restart (my request to check was blocked by the session's permission rules).

**Phase 2, design system and frame (built, reviewed).**
- Tokens in `src/design/tokens.ts`, generated to CSS and the Tailwind theme; a test keeps them in
  sync and measures contrast (every text role ≥ 4.5:1 on every surface; controls and focus ≥ 3:1).
- Manrope via next/font (latin + latin-ext, metric-matched fallback). No italic anywhere.
- Owned components: buttons, form controls with error summary, status/classification/priority
  tags with distinct glyphs, reference with copy, timestamp, alerts, empty/denied/error states,
  skeleton, dialogs (native `<dialog>`, consequence-led, typed confirmation), register table
  (stacks below 768 px), filter bar (GET form), pagination, stepper, countersignature, comments,
  attachments, word diff, publication receipt, next-action panel, command palette (Ctrl K).
- Frame: navy masthead (mark, environment marker, search, notifications, official), parchment
  rail with permission-filtered navigation, drawer below 1024 px, footer line, simulated-
  publication banner.
- Archetypes with specimen content at `/design` (not in production): Briefing, Register, Folio.
- Screenshots at 375/768/1280/1600 and review: `docs/design/REVIEW.md` (round 1 defects fixed;
  no overflow, no console errors in round 2).

**Phase 4 groundwork (pure code, tested).**
- Vocabulary (`src/domain/glossary.ts`), registers and references, institution seed.
- Policy: 11 roles, 26 permissions, institution scope and clearance, deny by default, no
  authority without an active account and MFA; two-person rule for privileged changes.
- Workflow: versioned definitions for all seven registers (adoption for decisions,
  verification for appointments, source-document guard for finance, approver/publisher
  separation where required), and an engine that decides, offers steps with reasons, and states
  publication eligibility.
- `docs/GLOSSARY.md` and `docs/security/PERMISSION_MATRIX.md` generated from the code; a test
  fails when they are stale.

**Verified (commands run):** `npm run typecheck` pass; `npm run lint` pass; `npx vitest run`
125 tests pass; `npm run build` pass.

**Not built yet:** identity (sign-in, invitations, TOTP, sessions), the nonce CSP proxy,
AletheiaDB adapters and the `workbench` database, registers and composer, review and publication
screens, the portal's publication endpoint, notifications, audit chain, E2E and axe suites,
Vercel project and DNS. The sign-in page states that accounts are not open.

**Assumptions:** reference numbers are issued at publication authorisation (so withdrawn and
rejected drafts never consume one); priority due periods 14/5/1 days; one approval per register
in version 1 of every definition. All changeable by policy.

## 15 October 2026 (continued): Phase 3, identity and access

Built:
- Storage port with two adapters of identical semantics: AletheiaDB (`adapters/aletheiadb`) and an
  in-memory store for tests only (`adapters/memory`). Schema in `adapters/schema.ts`.
- Audit register: hash-chained events in an append-only collection, written in the same atomic
  commit as each change; chain verification; request keys so a double submit acts once.
- Identity service: founding administrators (at least two), invitations (single use, 72 h),
  password (Argon2id) + authenticator (TOTP, replay-proof) sign-in, database sessions with
  rotation, idle and absolute expiry, lockout, suspension and revocation on the next request,
  role changes with the two-person rule, session lists and revocation.
- Pages: sign-in, code, invitation (QR + key), Overview with real pending access changes,
  Officials and access (list, invite with one-time link, detail with roles, state and sessions,
  two-person decisions), Your account (preferences, password, sessions), Audit register with
  live integrity check, honest "not open yet" pages for sections not built.
- Proxy: per-request nonce CSP, correlation id, `no-store`, redirect without a session cookie.
- Local development database (`npm run db:local`, `npm run db:bootstrap:local`, `npm run admin:bootstrap`).

Verified (commands run): `npx vitest run` 160 tests pass (16 identity and audit, including lockout,
code replay, idle expiry, suspension effective on the next request, the two-person rule, tamper
detection, all-or-nothing); `tsc` and `eslint` clean; `npm run build` passes;
`npx playwright test --headed` (tests/e2e/identity.spec.ts) passes against the dev server and a
local AletheiaDB, watched by the owner: unauthenticated redirect, invitation and authenticator
enrolment, invitation of an official with a privileged role held for a second administrator,
audit integrity, sign-out, refused wrong password, two-step sign-in, and the invited official's
limited access (404 on Officials and access). Cross-site sign-out probed with curl: 403.

Fixed because the end-to-end test found it: sign-out crashed on `Origin: null` (ADR 0006).

Not yet: the `workbench` database on db.stateofaletheia.org (D4), Vercel project and domain,
passkeys, authenticator reset, email. The local test accounts exist only on this machine.

## 15–16 October 2026: D4 and the records phase

**D4 done.** Database `workbench` created on db.stateofaletheia.org with every collection
(append-only where the brief requires) and a readWrite application key scoped to it alone
(verified: Forbidden on `gov`). The key and the two data keys are in the git-ignored
`.env.production.local`, never printed. The root key was read over SSH into a process variable
only. No officials exist there yet: the founding administrators are created at deployment.

**Records (all seven registers).**
- Working copy on the record; submission freezes it into a hashed, append-only version.
  Approvals bind to the version hash; a revision invalidates them by construction.
- Every step through the engine, in one atomic commit with its transition event, approval,
  reference allocation, outbox entry and audit events. Stale revisions are refused.
- References issued at publication authorisation, from a counter updated in the same commit
  (AGV-{TYPE}-{YEAR}-NNNN; slug = reference in lower case). Assumption, changeable by policy.
- Publication: outbox with one idempotency key per version, reused on retry; delivery confirms
  only on the gateway's answer; unclear answers are reconciled by key before any retry. Only the
  development gateway exists (simulated receipts, banner); the portal endpoint is next (ADR 0003).
- Screens: registers with filters and pagination, composer (plain-text conventions, preview as on
  the portal, autosave, unsaved-changes guard), folio with next action, stages,
  countersignatures, eligibility, versions and receipt, word-by-word changes between versions,
  My queue (derived from what the official may do now).
- Officials and access now keeps recent decisions visible ("Decided in the last seven days");
  the end-to-end test showed the confirmation message vanished with the item it confirmed.
- Empty registers no longer repeat their heading in the explanation.

**End-to-end tests now run on isolated data** (`npm run e2e`): a fresh database per run in the
local AletheiaDB, a cast of officials created through the real services (privileged roles via the
two-person rule), and a production build on port 3310.

Verified (commands run): `npx vitest run` 183 tests pass; `tsc` and `eslint` clean;
`npx playwright test` 2 tests pass (identity: E2E 1, 2, 19, 20; records: E2E 3, 4, 5, 6, 7, 9,
10, 11, 16), watched headed by the owner for part of the runs.

Not yet: the portal's publication endpoint and gateway (E2E 12–14 against a real portal),
attachments and scanning, free-standing tasks and reassignment, notifications, Vercel and DNS.

## 16 October 2026: first deployment (staging)

- Vercel project `aletheia-ops` (team stateofaletheiadev1), deployed with `vercel deploy --prod`.
  Public address: https://aletheia-ops-pi.vercel.app. Settings as encrypted Vercel secrets, read
  from the git-ignored `.env.production.local`, never printed.
- Labelled **Staging** (`APP_ENV=staging`) with simulated publication and its banner, because the
  portal publication endpoint does not exist yet and a production setting refuses to start without
  it. `/design` now needs sign-in outside development. `.vercelignore` keeps local data, secrets
  and test artefacts out of uploads.
- Verified on the live address: sign-in form (database connected), redirects when signed out,
  `/design` closed, CSP with nonce, HSTS, frame denial; invitation page opens.
- Founding administrators created on the live database: Emeka Iwuagwu and Su (owner's choice).
  Their single-use links were given to the owner, not recorded here.
- `ops.aletheiagov.org`: DNS for aletheiagov.org is at Spaceship; one CNAME is needed (owner).
