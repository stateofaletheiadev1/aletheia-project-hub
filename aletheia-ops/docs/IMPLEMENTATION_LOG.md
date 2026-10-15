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

## 16 October 2026: authenticator codes switched off for the trial (ADR 0007)

- Owner's request: no QR / authenticator step until real officials are enrolled. Implemented as
  `AUTH_MFA=off` (refused in production), with a banner on every page and `mfa: off` on every
  sign-in in the audit register. Set on the live staging site.
- Half-finished invitations (password chosen while codes were required) finish with a single
  "Finish joining" step. Emeka's live invitation was in this state.
- Switching back to `required` ends sessions of officials without an authenticator and makes each
  enrol one (QR) at the next sign-in.
- Verified: 187 unit tests (including off mode, switching back, half-finished invitations);
  both browser tests in required mode; live pages for both founders' invitations checked.

## 16 October 2026: two-step sign-in by choice; guidance for administrators

- `AUTH_MFA=optional` on the live site: password sign-up; "Two-step sign-in" in Your account sets
  up an authenticator (QR), after which every sign-in asks for a code; it can be turned off with
  the password. ADR 0007 revised.
- The owner could not see how to create records: founders are administrators, and administrators
  manage people, not records. Registers now state how a record moves through them and, when the
  official cannot create one, why and how to get the Author role. The Overview shows a "Getting
  started" guide to administrators until records exist, and now lists real work (queue, records in
  progress, publications, refused publications).
- Known limit: with exactly two administrators, a privileged role (approving, publishing) for
  either founder cannot be confirmed, because neither may confirm a change to their own access and
  the proposer cannot confirm. A third administrator, or other officials, resolve it.
- Verified: 190 unit tests; both browser tests; deployed.

## 16 October 2026: founders hold every power (ADR 0009)

- New `founder` role with every permission; separation of duties and the two-person rule do not
  bind founders; every such act is audited as taken on a founder's authority. Live founders (Emeka,
  Su) moved to it. Countersignatures show "Founder"; the audit register now labels record steps.
- Verified: 194 unit tests (a founder takes a decision from draft to publication alone, with five
  audited overrides; others still bound; founders still cannot publish non-Public records); both
  browser tests; deployed.

## 16 October 2026: publication to aletheiagov.org (Phase 6)

- Portal (aletheia-gov): `POST /api/publications` and `GET /api/publications/{key}`, HMAC-signed
  (300 s window, rotating keys in `PUBLICATION_HMAC_KEYS`). The portal re-validates the payload,
  recomputes the content hash, refuses mismatches and foreign references, and writes the record and
  its receipt in one atomic AletheiaDB commit; a repeated key returns the first receipt. Corrections
  (a newer version of the same reference) update the record and keep its first publication date.
  Record pages now show the version and the SHA-256 content hash. SDK upgraded to 0.2.0.
- Workbench: `PortalGateway` (definite refusals fail; timeouts, network errors and 5xx are
  reconciled by key before any retry); `/api/jobs/publications` retried by Vercel Cron.
- Shared content-hash vector asserted in both repositories.
- Verified: workbench 200 unit tests; portal 91 unit tests; both browser tests with the workbench
  publishing to a locally running test copy of the portal on its own database (E2E 12: the public
  page shows the record, reference and the same hash). Live: `publications` collection created in
  `gov`; secrets set in both Vercel projects (not printed; copy in `.env.production.local`).

## 16 October 2026: go-live (production)

- Owner's decisions: fresh start; optional two-step sign-in in production; ops.aletheiagov.org.
- aletheiagov.org: the one test publication (AGV-DOC-2026-0001 "Biz test My Biz Test") and its
  receipt removed in one commit; portal staff accounts untouched. Publication links now use
  https://aletheiagov.org (portal APP_BASE_URL).
- Workbench moved to a new, empty database `operations` (AletheiaDB cannot drop a database and the
  audit history is append-only, so the test database `workbench` is left unused, ~1 MB); its key
  revoked; new encryption keys. Founders Emeka and Su re-created with the Founder role.
- `APP_ENV=production`, `AUTH_MFA=optional` (production check relaxed, ADR 0007),
  `APP_BASE_URL=https://ops.aletheiagov.org`. Verified live: no staging marker, /design 404,
  sign-in connected, CSP with upgrade-insecure-requests.
- Domain added to the Vercel project. Needed at Spaceship: CNAME `ops` →
  `1a0525dd1d6c62a0.vercel-dns-017.com` (owner).

## 16 October 2026: withdrawal from the public record (ADR 0010)

- The owner archived a published test document and found it still on aletheiagov.org. Archive only
  closes a record in the workbench. Removed the test document (AGV-DOC-2026-0001 "Publication Test
  test test") from the live site directly, on the owner's instruction.
- Built "Withdraw from the public record" (founders; reason + typed reference), the portal
  endpoint `POST /api/withdrawals`, withdrawal notices on record pages, and delivery through the
  outbox.
- Verified: workbench 203 unit tests, portal 92; both browser tests, including a founder
  withdrawing a dispatch and the test portal showing the notice without the text.
