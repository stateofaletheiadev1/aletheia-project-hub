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
