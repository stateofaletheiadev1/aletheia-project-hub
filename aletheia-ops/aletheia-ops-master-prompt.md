# MASTER ENGINEERING PROMPT — v2.0

# Aletheia Government Operations Workbench

## The private administrative counterpart to the public record of the Sovereign Covenant State of Aletheia

| Field | Value |
|---|---|
| Project | Aletheia Government Operations Workbench |
| Official application name | Aletheia Government Operations |
| Short name (UI, browser tab, PWA) | Operations |
| Production URL | `https://ops.aletheiagov.org` |
| Primary design and data reference | `https://aletheiagov.org` (the public government portal) |
| National website | `https://www.stateofaletheia.org` |
| Deployment platform | Vercel |
| Framework | Next.js (App Router), React, TypeScript (strict), TSX |
| Typeface | **Manrope — the only typeface in the product** |
| Language and locale | British English, `en_GB` |
| Implementing engineer | Claude Code |
| Product direction and authority | Aletheia project leadership |
| Prompt status | Authoritative. Supersedes v1.0. |

---

## HOW TO READ THIS PROMPT

This document is a specification, a design brief, a security policy and a definition of done at the same time. Read all of it before you write a single file.

Words are used precisely:

- **MUST / MUST NOT** — a hard requirement. Violating it means the work is not complete.
- **SHOULD / SHOULD NOT** — the expected default. Deviate only with a written reason in the implementation log.
- **MAY** — permitted, at your engineering judgement.
- **VERIFY** — you are not allowed to assume this. Inspect the real system, record what you found, and cite where you found it.

Where this prompt states something about the existing public portal, it was observed on the live site on 15 October 2026. Treat every such observation as a lead to VERIFY, not as ground truth. The live site and its repository win over this document whenever they disagree; record the disagreement.

---

# PART I — ROLE, MANDATE AND OPERATING DISCIPLINE

## 1. Your role

You are acting simultaneously as:

1. **Principal software architect** — responsible for the shape of the system, its boundaries, and its long-term maintainability.
2. **Senior full-stack engineer** — responsible for working code in every layer, from database adapter to pixel.
3. **Enterprise workflow architect** — responsible for a correct, auditable, versioned state-transition engine.
4. **Security engineer** — responsible for authentication, authorization, separation of duties, audit integrity and secure integration with the public portal.
5. **Senior product designer and typographer** — responsible for an interface that a seasoned human design studio would sign its name to.

These roles are not sequential. A schema decision is a design decision; a layout decision is a security decision when it controls what a user can see. Hold all five perspectives at once.

## 2. The mandate

Engineer a beautiful, secure, maintainable, production-ready Government Operations Workbench through which authorised Aletheian officials will:

- coordinate institutional work;
- draft, review, approve and version official records;
- operate multi-stage approval chains with enforced separation of duties;
- maintain the institutional directory and the access-control model;
- prepare and then **publish, under explicit authority, to the existing public record at `aletheiagov.org`**;
- and see, at any moment, a truthful account of who did what, when, and under which authority.

This is not a SaaS dashboard, a template, or a demo. It is the operating room behind a public record whose stated principle is *"Nothing is real until it is published."* The workbench is where things become real. Treat that responsibility literally.

You are building the **actual application**: backend, persistence, authentication, authorization, workflow logic, validation, publication integration, error handling, tests and deployment configuration. A frontend mock-up is a failure of this mandate.

## 3. Operating discipline (non-negotiable rules of conduct)

### 3.1 Truthfulness

- MUST NOT invent integrations, APIs, endpoints, database tables, institutional approvals, users, statistics, or production capabilities that you have not verified.
- MUST NOT describe a mock, stub, fixture, or development adapter as working production functionality — in code comments, UI copy, README, commit messages, or your final report.
- MUST NOT claim to have inspected a website, repository, file or service you could not access. If access fails, say so plainly, state what you used instead, and continue with what you can do.
- MUST NOT claim a test passed unless you ran it and it passed. Report skipped, failing and unconfigured tests separately.
- MUST NOT claim a phase is complete because files exist. Completion means working code plus verification.

### 3.2 Respect for what already exists

- MUST NOT discard, rewrite, or replace existing Aletheia code, infrastructure, AletheiaDB, or the public portal without first understanding it and recording why a change is necessary.
- MUST NOT redesign, restyle, or alter the public portal's visual design as part of this project. Backend extensions to the portal (for example, a publication endpoint) are permitted only when discovery shows they are required, and only as the smallest safe change.
- MUST NOT touch DNS records, email configuration, or any subdomain other than `ops.aletheiagov.org`.

### 3.3 Decisions

- Resolve anything that can be resolved by reading code, inspecting the live site, or sound engineering judgement. Record the decision and the reasoning in `docs/decisions/` as a short Architecture Decision Record (ADR).
- Stop and ask project leadership **only** for decisions that are genuinely theirs: institutional policy (who may approve what), anything irreversible in production, anything touching the existing database's guarantees, the publication API's security model, or a new paid dependency. When you ask, present the problem, two or three options, your recommendation, and the cost of each.

### 3.4 Working rhythm

- Maintain `docs/IMPLEMENTATION_LOG.md`: dated entries of what was done, what was verified, what was assumed, what is blocked.
- Work in the phases defined in Part X. After each phase, run the relevant tests, take screenshots of the rendered interface, review them against the design acceptance tests, and fix what fails before moving on.
- Prefer small, reviewable commits with plain, conventional messages written as a human engineer would write them. Commit messages, code comments and documentation MUST read as ordinary professional engineering writing — no self-referential commentary, no boilerplate filler, no decorative emoji.

---

# PART II — CONTEXT: WHAT ALETHEIA IS AND HOW IT PRESENTS ITSELF

## 4. The institution

The Government of Aletheia describes itself as the founding government-in-formation of the Sovereign Covenant State of Aletheia. Its motto is **Veritas in Foedere** — *Truth in Covenant*. The public portal states clearly that Aletheia does not currently hold recognised territory or international recognition, and that institutions are *Proposed* or *In formation* unless marked *Operational*.

This honesty is the brand. The workbench MUST carry the same discipline: real statuses, real counts, real empty states, no inflation.

## 5. Observed characteristics of the public portal (VERIFY all of these)

Observed on `aletheiagov.org` on 15 October 2026:

**Navigation (primary):** Government · Institutions · Programmes · Opportunities · Documents · Record — plus Search, Sign in, Register interest.

**"The public record" menu:** Decisions (adopted institutional decisions) · Dispatches (announcements and notices) · Public Finance (budgets, receipts, reports) · Appointments (verified appointments only) · Directory (institutions and positions) · Events (public sessions and meetings).

**Official reference format:** `AGV-{TYPE}-{YEAR}-{SEQUENCE}`, e.g. `AGV-DOC-2026-0001`, described as *fixed for good once issued*. Observed type codes:

| Code | Register |
|---|---|
| `DOC` | Documents — published with version history and content hash |
| `DEC` | Decisions — published only once adopted and approved by a second officer |
| `DSP` | Dispatches — announcements and notices |
| `FIN` | Public finance — each item traced to a source document |
| `OPP` | Opportunities — positions with reference, mandate and selection criteria; applications reviewed by two people |

Appointments, Directory and Events registers exist; VERIFY whether they also carry reference codes.

**Editorial devices:** section markers (`§ 01`, `§ 02`…), two-digit ordinal numbering (`01`, `02`…), explicit `Status:` labels, placeholder references rendered as `AGV-DOC-····-····` in empty registers, an *edition* line in the footer ("Edition of 15 October 2026"), contour-line SVG fields (`/contours/field-a-light.svg`, `field-b-light.svg`, `field-c-gold.svg`), the national arms, and restrained photography of sea, deep water, and institutional work.

**Colour signal:** `theme-color` is `#0B1628`, a deeper navy than the previously documented Covenant Navy `#15294A`. VERIFY the full token set from the portal's source or computed styles.

**Institutions listed (10):** The Founding Government; The Covenant Assembly; Council of the States; The Chancellor and Cabinet; The High Court of Aletheia; Office of the Auditor-General; Aletheia Monetary Authority; Treasury and Public Finance; Electoral Commission; Data Protection and Registry Ombudsman.

**Programmes (6):** Constitutional and institutional framework; Aletheia StableChain; Government platform (*"this website and the workbench behind it"*); Maritime and ports framework; Energy and water framework; Plan for the capital, Antioch.

**Existing capabilities to investigate:** the portal already has a **Sign in** route and a **Register interest** flow. Discovery MUST determine what these authenticate against, what accounts exist, and whether the workbench should share identity with them.

The workbench is the "workbench behind" the public website, named in the portal's own Government Platform programme. It must look and behave like it.

---

# PART III — MANDATORY DISCOVERY

## 6. Discovery before design, design before code

Before designing a screen or writing application code, complete discovery and produce `docs/discovery/FINDINGS.md`.

### 6.1 Visual identity inventory → `docs/discovery/DESIGN_REFERENCE.md`

Inspect `aletheiagov.org` (every public section listed above, at 375 px, 768 px, 1280 px and 1600 px) and `stateofaletheia.org`. Prefer the portal's **source code** where you have access; otherwise read computed styles in a browser. Record:

- The arms and every logo/lockup variant, their files, minimum sizes, clear space, and light/dark usage.
- Every colour actually used, with hex value, where it is used, and its role (text, surface, rule, accent, status).
- Manrope implementation: loading method, weights loaded, sizes, line heights, letter-spacing, case usage, numeral settings.
- The grid: max content widths, column structure, gutters, vertical rhythm.
- Rules and borders: weights, colours, where hairlines are used versus space.
- Components: buttons, links, inputs, register lists, status labels, reference numbers, section markers, cards (if any), footers.
- Motion: transitions, durations, easing, reduced-motion behaviour.
- Editorial voice: sentence length, capitalisation of headings (sentence case vs title case), use of British spelling, how absence is stated.
- The contour SVGs, photography treatment and image cropping.

If a page cannot be accessed, write down which, why, and what you used instead. Never fabricate an observation.

### 6.2 System and data inventory → `docs/discovery/SYSTEM_REFERENCE.md`

Locate and inspect (VERIFY, do not assume):

- The public portal repository, framework, hosting, and deployment configuration.
- Where each register (Documents, Decisions, Dispatches, Public Finance, Appointments, Directory, Events, Opportunities) is stored and how a record is represented.
- How reference numbers are issued, and whether sequence allocation is atomic.
- How the "content hash" for documents is computed (algorithm, canonicalisation, what is hashed).
- How "approved by a second officer" is currently enforced, if at all.
- How homepage and register-preview inclusion is determined.
- Whether scheduling, unpublication, correction notices, or redaction exist.
- What `Sign in` authenticates against; any existing user, role or session store.
- Any existing content API, its authentication, and whether it accepts writes.
- The AletheiaDB implementation (see Part VIII), its interfaces, and its guarantees.
- Environment variables, secrets handling, and CI already in place.

### 6.3 Discovery output

`FINDINGS.md` MUST contain: what exists; what is missing; what is unknown; risks; and a short list of decisions you need from leadership (if any), each with options and a recommendation. Proceed with everything that does not depend on those decisions.

---

# PART IV — DESIGN: A HUMAN-MADE INSTITUTIONAL INTERFACE

## 7. The standard

The visual design is a primary acceptance criterion with the same weight as security and correctness.

The interface MUST look and feel as though it was designed by an experienced human design team — a studio with a typographer, an information designer and a government-services practitioner — who spent weeks with the public portal, the institution's documents and the officials who will use the tool. It MUST NOT look generated, templated, or assembled from a component library's defaults.

**Generic UI is never accepted.** A screen that could belong to any SaaS product with the logo swapped is a defect, regardless of how clean it looks.

## 8. The design idea: "The Registry"

Every strong interface has a governing idea. This one has one: **the workbench is a registry office.**

The public portal is the published record — the bound volume on the shelf. The workbench is the room where records are drafted, numbered, examined, countersigned and released. Everything in the interface should draw from that world, translated faithfully into a modern digital tool:

- **Registers, not dashboards.** Lists of records are ledgers: ruled, numbered, dense, aligned, scannable. They are the hero of the product.
- **References as identity.** `AGV-DEC-2026-0007` is how a record is known. It is typeset with care everywhere it appears.
- **The folio.** A single record is presented like a folio: a header block of metadata (reference, institution, classification, status, version), the body, then the chain of custody — every hand that touched it.
- **Countersignature.** Approvals are presented as signatures in a chain, with the officer's name, role, institution, decision and time — not as a green tick.
- **Editions.** The public site dates its edition; the workbench shows when data was last true ("As of 15:42 WAT") where staleness matters.
- **Sections and ordinals.** The `§` marker and two-digit ordinals from the portal are reused with restraint to give internal pages the same editorial skeleton.
- **Contours as the only decorative system.** The portal's contour-line fields are the single permitted ornamental motif — used sparingly (sign-in, empty states, the overview masthead) at very low contrast, never behind data.

This idea must be evident without being literal. No skeuomorphic paper textures, no wax-seal graphics, no fake handwriting, no ledger-line backgrounds behind text.

## 9. Typography — Manrope, and only Manrope

Manrope is the typeface of Aletheia. It is the **only** typeface in the workbench. No secondary sans, no serif, no monospace family, no system-font fallback visible in normal operation.

### 9.1 Loading

- Load Manrope with `next/font/google` (or the self-hosted files used by the portal, if discovery shows that), variable axis, subset `latin` and `latin-ext` (to render names with diacritics correctly), `display: swap`, exposed as a CSS variable.
- Define a metric-matched fallback stack (`next/font` `adjustFontFallback`) so layout does not shift while the font loads.
- VERIFY which weights the portal uses and match them. Manrope's range is 200–800.

### 9.2 Manrope-specific rules

- **Manrope has no italic.** MUST NOT use `font-style: italic` (the browser will fake an oblique, which looks amateur). Express emphasis through weight, colour, or placement. Quotations and Latin phrases (e.g. *Veritas in Foedere*) are set upright.
- **Numerals:** enable tabular figures (`font-variant-numeric: tabular-nums`) for every table column, date, time, amount, count, and reference number, so columns align. Use proportional figures in running prose.
- **Reference numbers** (`AGV-DOC-2026-0001`) are set in Manrope, tabular figures, weight 600, letter-spacing `0.02em`, never wrapped across lines (`white-space: nowrap`), with a copy-to-clipboard affordance on hover/focus. Because there is no monospace font, alignment comes from tabular figures and fixed-width table columns.
- **Uppercase** is reserved for small overlines and metadata labels: size 11–12 px, weight 600–700, letter-spacing `0.08–0.12em`. Never set headings or buttons in all caps.
- **Weights in use:** 400 body, 500 UI text and table cells, 600 labels, references and emphasis, 700 headings, 800 only for the single largest display line on a page if at all. Do not use 200/300 for body text; thin Manrope at small sizes on navy fails contrast and looks weak.
- **Optical tracking:** tighten large headings slightly (`-0.01em` to `-0.02em` above 28 px); leave body at `0`.
- **Line length:** prose 60–75 characters; never full-width paragraphs.

### 9.3 Type scale (adjust to match the portal after discovery)

A deliberate, limited scale — every size has a job. Base 16 px for prose; 14 px is the default for dense operational UI (tables, forms, side panels) because officials will spend hours here.

| Token | Size / line height | Weight | Role |
|---|---|---|---|
| `display` | 40 / 44 | 700 | Single page title on the overview masthead only |
| `h1` | 30 / 36 | 700 | Page title |
| `h2` | 22 / 28 | 700 | Section title (often with `§` marker) |
| `h3` | 17 / 24 | 600 | Sub-section, panel heading |
| `body` | 16 / 26 | 400 | Prose, record bodies, guidance text |
| `ui` | 14 / 20 | 500 | Tables, forms, navigation, buttons |
| `meta` | 13 / 18 | 500 | Timestamps, secondary metadata |
| `overline` | 11 / 16 | 700, caps, +0.1em | Labels above values, register column headers |
| `ref` | 14 / 20 | 600, tabular, +0.02em | Reference numbers |

Tokens live in one place (`src/design/tokens.ts` → CSS custom properties) and nothing in the codebase uses arbitrary font sizes.

## 10. Colour

### 10.1 Source of truth

The live portal is authoritative. Start from the observed and previously documented values and reconcile them during discovery:

| Name | Value | Status |
|---|---|---|
| Deep Navy (portal `theme-color`) | `#0B1628` | Observed — VERIFY role |
| Covenant Navy | `#15294A` | Documented — VERIFY |
| Ledger Parchment | `#F4EEDF` | Documented — VERIFY |
| Seal Gold | `#C49A4E` | Documented — VERIFY (contour `field-c-gold` suggests gold use) |
| Laurel Green | `#2F6B4F` | Documented — VERIFY |

### 10.2 Roles, not paint

Build a semantic token layer. Components reference roles, never raw hex values.

- `--surface-canvas` — the application background. Prefer a very slightly warm off-white derived from Parchment for the canvas, with pure white (or near-white) for the working sheet where records are read and edited, so documents feel like documents.
- `--surface-sheet`, `--surface-sunken`, `--surface-raised`.
- `--ink-primary` (navy-black for text), `--ink-secondary`, `--ink-tertiary`, `--ink-inverse`.
- `--rule-strong`, `--rule-hairline` — 1 px rules are the primary structural device instead of shadows.
- `--accent-authority` — navy. Primary actions, active navigation, focus base.
- `--accent-seal` — gold. **Rare.** Reserved for marks of official authority: the published state, a countersignature, the arms, the active section marker. If gold appears more than two or three times on a screen, it has lost its meaning. Gold is never used for body text on light backgrounds (contrast fails); use a darkened gold token for any gold text.
- Status roles: `--status-draft` (neutral ink), `--status-review` (navy/steel), `--status-returned` (amber, darkened for text), `--status-approved` (Laurel Green), `--status-published` (gold mark + green or navy text — published is the one moment of ceremony), `--status-rejected` / `--status-danger` (a disciplined brick red, not pure `#FF0000`), `--status-withdrawn` / `--status-archived` (muted).
- Classification roles: `--class-public`, `--class-internal`, `--class-restricted`, `--class-confidential` — distinct, calm, never alarming red unless the action is destructive.

### 10.3 Dark mode

The portal declares `color-scheme: light`. The workbench SHOULD ship light mode as the primary, fully polished theme. A dark theme MAY be added only if it is designed with the same care (navy-based, not inverted grey) and passes the same contrast tests; an unpolished dark mode is worse than none.

### 10.4 Contrast

All text meets WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI component boundaries). Status is never conveyed by colour alone — every status has a text label and, where useful, a distinct glyph.

## 11. Space, grid and structure

- **Spacing scale** on a 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. No arbitrary values.
- **Structure through rules and space, not boxes.** Prefer hairline dividers, consistent alignment and generous section spacing over wrapping things in cards. A card is used only when content is genuinely a discrete, movable object.
- **Radius:** small and consistent — 2–4 px for inputs and buttons, 0 for tables and the record sheet, at most 6 px for popovers. No pill-shaped buttons. No 16–24 px "bubbly" radii. Status labels MAY use a squared tag shape rather than a pill.
- **Shadows:** almost none. One subtle elevation for popovers, menus and dialogs. Never shadows on cards in a grid.
- **Grid:** a 12-column grid with fixed maximum widths per page archetype (see §13). Align metadata columns across a page; the eye should be able to run down a vertical line of labels.
- **Density:** a user-selectable density setting (Comfortable / Compact) for registers. Default Comfortable on first sign-in.

## 12. The anti-generic charter

### 12.1 Banned outright

The following MUST NOT appear anywhere in the workbench:

1. The stock admin template: dark sidebar + white top bar + a row of four KPI cards + two charts + a "recent activity" card.
2. Rows of interchangeable metric cards with a big number, a label and a green "+12%".
3. Charts that exist to fill space. A chart is permitted only when it answers a real operational question with real data and is better than a table.
4. Gradient backgrounds, mesh gradients, glows, aurora blobs, glassmorphism, frosted panels, neon accents, purple-to-blue anything.
5. Emoji used as icons, status, or decoration — anywhere, including empty states and toasts.
6. Generic illustration packs (flat people with laptops, isometric servers, 3D blobs, "undraw"-style art).
7. A marketing hero section inside the application.
8. Oversized rounded corners, pill buttons everywhere, and floating cards with heavy drop shadows.
9. Default component-library appearance left unstyled (recognisable shadcn/ui, MUI, Chakra or Tailwind UI defaults). Libraries MAY be used for behaviour and accessibility; their look MUST be re-designed.
10. Sparkle icons, "AI" badges, "magic" wording, or any visual language implying automation that is not there.
11. Fake data of any kind: invented officials, invented counts, placeholder lorem ipsum in shipped screens, fabricated activity feeds, demo charts.
12. Centred-everything layouts, three-column feature grids, and "Welcome back, John! 👋" greetings.
13. Generic copy: "Seamlessly manage your workflow", "Unlock powerful insights", "All-in-one platform", "Get started in seconds".
14. Indiscriminate gold: gold borders on every panel, gold headings, gold icons.
15. Skeleton loaders that shimmer for content that loads in 100 ms; spinners as the only loading feedback for long operations.
16. Toasts as the only record of an important outcome (a publication result belongs on the record, not in a vanishing toast).

### 12.2 Signals of human craft (required)

These are the details that separate a designed product from a generated one. Implement them deliberately:

- **A real typographic hierarchy** where you can tell what matters on a page from across the room.
- **Alignment that holds:** labels share a left edge; numbers right-align on tabular figures; dates use one format everywhere.
- **Asymmetric, purposeful layouts.** The overview is not a grid of equal boxes; it reads like a briefing — what needs you, then what is moving, then what happened.
- **Editorial voice in the UI.** Copy written by someone who understands government work: precise, calm, plain, British English. See §15.
- **Considered empty states** that say exactly what is absent and why, and what will appear there, in the portal's own voice ("Nothing published yet. Decisions are published only once adopted and approved by a second officer.") — with a placeholder reference such as `AGV-DEC-····-····` where it fits, mirroring the portal.
- **Details that reward attention:** a reference that copies on click; a timestamp that shows absolute time on hover ("15 Oct 2026, 15:59 WAT"); a "since your last visit" marker in a register; a keyboard shortcut hint in a menu.
- **Real states for everything:** long institution names ("Data Protection and Registry Ombudsman" must not break a layout), 200-character document titles, zero rows, ten thousand rows, validation errors on every field, slow networks, permission-denied.
- **Restraint.** The finished interface should feel quiet and confident. If a screen looks busy, remove things.

### 12.3 Iconography

- One icon family throughout — Lucide is acceptable — at 1.5 px stroke, sized 16 px in dense UI and 20 px in navigation, optically aligned to text baselines.
- Icons support labels; they rarely replace them. Navigation items have text labels.
- The arms of Aletheia are an emblem of state, not an icon. Use it in the application masthead, the sign-in screen, printed/exported records, and nowhere decorative.

### 12.4 Motion

- Purposeful and brief: 120–200 ms for state changes, 200–280 ms for panels and dialogs, standard ease-out curves. No bounce, spring overshoot, parallax, or animated backgrounds.
- Motion confirms an action or clarifies a spatial change (a side panel sliding from the record it belongs to). It never delays work.
- Respect `prefers-reduced-motion` fully.
- The single moment of ceremony is **publication**: when a record is confirmed published by the portal, the record's status mark changes to the published state with a short, dignified transition and the publication receipt appears in the chain of custody. Nothing louder than that.

## 13. Application frame and page archetypes

### 13.1 The frame

Design the frame from the portal outward, not from an admin template inward.

- **Masthead:** the arms (small), "Aletheia Government Operations", an environment marker visible only in non-production environments (`STAGING`, `DEVELOPMENT` — clearly and unmistakably), global search (⌘K / Ctrl+K), notifications, and the signed-in official (name, role, institution) with a menu for profile, security (MFA), and sign out.
- **Primary navigation:** a light, editorial navigation — NOT a heavy dark slab. A left rail on a parchment-tinted or white surface with navy text, grouped under small overline headings, is a reasonable starting point; the final form MUST be justified against the portal's navigation. Proposed grouping (refine after discovery):
  - **Work** — Overview · My queue · Assigned to my institution
  - **The Record** — Documents · Decisions · Dispatches · Public Finance · Appointments · Opportunities & Applications · Events
  - **Institutions** — Directory · Officials & Access
  - **Oversight** — Audit Register · Publication Log · Integration Health
  - **Settings** — Workflow Policies · Notification Preferences · System
  The register names deliberately mirror the public record so an official's mental model maps one-to-one onto what the public sees.
- Navigation items appear only if the user has permission to see them. Counts beside items show only what the user is authorised to know.
- **Footer line** (subtle): build/version, environment, and "Data as of HH:MM WAT" where relevant.

### 13.2 Page archetypes

Every page is one of a small number of designed archetypes. Do not invent a new layout per page.

1. **Briefing (Overview).** An asymmetric, editorial composition. Masthead line with the official's name, role and the date in the portal's edition style. Then, in priority order: *Requires your action* (approvals, reviews, returned items — the only large element); *Due and overdue*; *Moving through your institution*; *Recently published to the public record* (with references linking to the live portal); *Warnings* (integration or workflow problems, only if real). Every number is a link to the filtered register behind it. With no records, the briefing reads as a calm, honest statement of an institution in formation — not an empty grid.
2. **Register (list).** Full-width ruled table, sticky column headers in overline style, reference column first, title, institution, status tag, assignee, updated, due. Filter bar above (institution, type, status, assignee, classification, date range), saved views, keyboard navigation (j/k, Enter), bulk actions only where safe, server-side pagination and sort. On narrow screens, the register becomes a stacked list of entries with reference, title and status — designed, not squeezed.
3. **Folio (single record).** Two zones: the **sheet** (left/centre, max ~760 px measure) with the header block — reference, register, institution, classification, status, version, author — then the body; and the **custody column** (right) with the workflow stepper, current assignee, next required action as the only primary button, the countersignature chain, comments, attachments, version list, and the publication receipt. On mobile the custody column follows the sheet.
4. **Composer (create/edit).** A focused writing surface: title, structured metadata in a calm side panel, rich text with a deliberately limited toolbar (headings, lists, emphasis by weight, links, tables, footnotes if the portal supports them), attachments, autosave with visible "Saved 15:42", and a preview that renders exactly as the public portal will.
5. **Review.** Side-by-side or inline diff between the version under review and the previous version, reviewer comments anchored to passages, and the decision panel (Approve · Request revision · Reject) with mandatory reasoning for non-approval.
6. **Publication.** A pre-flight sheet: destination register, homepage/preview inclusion (if supported), schedule (if supported), a rendered preview, the public-disclosure checklist (personal data, classification, attachments), required authorisations shown as satisfied or not, and a single deliberate confirmation step that names the consequence: "This will appear on aletheiagov.org under Decisions as AGV-DEC-2026-0007."
7. **Administration.** Dense, careful forms for institutions, officials, roles and policies, with a pending-change pattern for privileged changes that require a second administrator.
8. **Audit.** A read-only, filterable ledger of events with correlation IDs, actor, action, target, outcome and integrity verification status.

### 13.3 Component specification

Build a small, owned component library in `src/components/ui` with documented variants. Each component specifies default, hover, focus-visible, active, disabled, loading and error states. At minimum: Button (primary/secondary/quiet/danger; only one primary per view), Link, Text input, Textarea, Select, Combobox (people/institutions), Date picker (dates shown as `15 Oct 2026`), Checkbox, Radio, Switch (only for immediate-effect settings), Status tag, Classification tag, Reference (with copy), Timestamp (relative + absolute on hover), Register table, Filter bar, Pagination, Stepper/timeline, Countersignature entry, Comment thread, Attachment row (name, type, size, scan status), Diff view, Dialog, Confirmation dialog (consequence-led wording, typed confirmation for irreversible actions), Side panel, Menu, Toast (secondary feedback only), Inline alert (info/warning/danger/success), Empty state, Permission-denied state, Error state, Skeleton (only for loads >300 ms), Command palette.

Provide a private, authenticated `/design` route (non-production or admin-only) that renders every component in every state with real-length content, so the system can be reviewed visually.

## 14. Responsive behaviour

- Breakpoints: 375, 768, 1024, 1280, 1600 px. Design each archetype at each — do not simply shrink.
- Primary work (review, approval, publication) MUST be fully usable on a tablet and SHOULD be usable on a phone; administration and audit MAY be desktop-optimised but must not break on small screens.
- Tables become structured lists on narrow screens; the custody column stacks below the sheet; the composer hides metadata behind a clearly labelled panel.
- Touch targets ≥ 44 × 44 px on touch devices.

## 15. Voice and copy

The interface speaks like a competent civil servant: exact, plain, calm, never cute.

- British English (`organisation`, `authorise`, `programme`, `licence`), dates as `15 October 2026` in prose and `15 Oct 2026` in tables, 24-hour time with timezone (`15:59 WAT`) for officials across timezones — show the user's local timezone and store UTC.
- Sentence case for headings, buttons and labels ("Request revision", not "Request Revision").
- Buttons say what they do, with the object: "Submit for review", "Approve decision", "Publish to the public record". Never "OK", "Submit", "Go".
- Confirmations name the consequence. Errors say what happened, why if known, and what to do next — never a stack trace, never "Something went wrong".
- Empty states use the portal's honesty: what is absent, why, and what will appear.
- Status vocabulary is defined once in a glossary (`docs/GLOSSARY.md`) and used identically in the UI, the API, the audit log and the public portal mapping.

## 16. Design verification protocol

Design is not complete until verified on the rendered application:

1. Run the app with a realistic, clearly-labelled **development seed** (fictional but plausible, never presented as real officials, never deployed to production) including long names, long titles, every status and every classification.
2. Capture screenshots (Playwright) of every archetype at 375, 768, 1280 and 1600 px, in populated, empty, loading, error and permission-denied states. Store them under `docs/design/screenshots/`.
3. Place each next to the corresponding portal page and review against these questions — and write the answers in `docs/design/REVIEW.md`:
   - Could this be mistaken for a generic admin template or an AI-generated dashboard? If yes, it fails.
   - Does it visibly belong to the same family as `aletheiagov.org` — type, colour, rules, voice, section devices?
   - Is the most important action on each screen obvious within two seconds?
   - Is gold rare enough to still mean "official"?
   - Are authority, neutral information, warnings and destructive actions unmistakably distinct?
   - Does it still look composed with 200-character titles, 40 validation errors, and zero records?
   - Is there anything on the screen that does no work? Remove it.
4. Fix and re-screenshot until every answer is satisfactory.

---

# PART V — PRODUCT SCOPE AND MODULES

## 17. Scope principle

The workbench administers the functions of the existing public record. It MUST NOT duplicate the public website, create a second public registry, or build a citizen-facing application without a verified need. Reuse what the portal already provides; build the internal operational layer around it.

## 18. Modules

### 18.1 Overview (Briefing)

Personal to each official, scoped strictly to their authorisation. Sections, in priority order: requires my action; returned to me for revision; due within 7 days and overdue; moving through my institution; recently published (with live portal links); real warnings (failed publications, integration health, policy misconfiguration). Every figure is computed from authoritative records at request time or from a correctly invalidated cache. Every item links to its record or filtered register. No invented figures — ever.

### 18.2 My queue and task management

A task is a unit of required action on a record or a free-standing assignment. Fields: title, description, type, owning institution, assignee, priority (Routine / Priority / Urgent — defined in the glossary), status, created, due, related record, required next action, comments. Capabilities: filter, search, sort, server-side pagination, saved views, assign and reassign (permission-checked, reasoned, audited), escalation indicator when overdue past policy threshold.

### 18.3 The Record — one module per public register

Each register below shares the workflow engine and the folio pattern but has its own schema, policy and publication mapping. VERIFY each against the portal.

| Register | Reference | Core content | Notes |
|---|---|---|---|
| Documents | `AGV-DOC` | Founding and official documents | Version history and content hash are public; hashing MUST match the portal's algorithm |
| Decisions | `AGV-DEC` | Adopted institutional decisions | Publication requires adoption + approval by a second officer (enforced, not advisory) |
| Dispatches | `AGV-DSP` | Announcements and notices | Homepage/preview inclusion where supported |
| Public Finance | `AGV-FIN` | Budgets, receipts, expenditure, reports | Each item traces to a source document; restricted until published |
| Appointments | VERIFY | Verified appointments | "Verified appointments only" — verification is a mandatory stage; personal data minimised |
| Opportunities & Applications | `AGV-OPP` | Positions with mandate and criteria; applications | Applications reviewed by two people; applicant data is never published |
| Events | VERIFY | Public sessions and meetings | Date/time/timezone handling; cancellation and amendment notices |

Common capabilities for every register:

- Create, edit, submit, review, revise, approve, reject, withdraw, authorise publication, publish, correct, archive — each only where policy and permission allow.
- **Immutable history:** once a record is approved, its approved version is frozen. Further edits create a new version that re-enters review per policy. Once published, the published version is never altered in place; corrections create a new version and, where the portal supports it, a public correction notice. Historical approvals always refer to the exact version (by content hash) they approved.
- **Reference issuance:** references are issued by a single atomic allocator at the policy-defined moment (VERIFY when the portal considers a reference "issued" — at publication or at registration). A reference, once issued, is never reused or changed.
- **Classification:** Public · Internal · Restricted · Confidential (refine after discovery). Classification constrains who can see the record, whether it may be published, and what search and counts reveal.
- **Attachments:** size limits, allow-listed MIME types verified by content sniffing (not extension), filename sanitisation, storage outside the web root with authorised, short-lived signed URLs, per-attachment classification, and a malware-scanning hook (implement if a scanner is available; otherwise a clearly documented interface with attachments held as "Unscanned" and blocked from publication).
- **Public-disclosure checks** before publication: personal data fields, classification, attachment status, required approvals.

### 18.4 Institutions and Directory

Manage institutional records mirroring the portal's ten institutions and any added later: name, short name, kind (Founding body, Legislature, Executive, Judiciary, Independent body…), description, status (Proposed / In formation / Operational — the portal's vocabulary), positions, and which public Directory entries derive from them.

Public directory information and private access-control records are separate models. A person listed publicly is not thereby a user; a user is not thereby listed publicly.

### 18.5 Officials and Access

Provision officials by invitation only. Manage accounts (Invited, Active, Suspended, Revoked), role grants scoped to institutions, MFA status, active sessions (with remote revocation), and last sign-in. Privileged changes (granting administrator, approver or publisher roles; changing workflow policy) use a **two-person rule**: one administrator proposes, a different administrator confirms; the proposer can never confirm their own change; nobody can grant themselves a role.

### 18.6 Oversight

- **Audit Register** (Part VII §26).
- **Publication Log:** every publication attempt with destination, reference, idempotency key, request time, portal response, final state (Pending / Confirmed / Failed / Needs reconciliation), and retry history.
- **Integration Health:** real checks against the portal and AletheiaDB (reachability, authentication, last successful publication, outbox depth, oldest pending item). Show "Not configured" honestly when an integration is not configured.

### 18.7 Settings

Workflow policies (versioned, two-person-approved), notification preferences, density, timezone display, and system information.

### 18.8 Explicit non-goals for this release

No live banking, reserve management, payments, or central-bank functionality; no on-chain writes to the StableChain; no citizen-facing services; no visual workflow designer; no chat or messaging system. Finance records here are documents and submissions about finance, not money movement. If the portal's Public Finance register expects ledger-verifiable proofs (the Auditor-General is described as publishing proofs against the public ledger), record that as a future integration requirement — do not imitate it.

---

# PART VI — THE WORKFLOW ENGINE

## 19. Requirements

A real, small, versioned, server-side state machine — not buttons that change a label.

## 20. Model

- **WorkflowDefinition** — id, register type, version, states, transitions, guards, required approvals, separation-of-duties rules, due-date rules, escalation thresholds. Definitions are versioned; a record runs on the definition version it started with unless explicitly migrated (with an audit event).
- **Transition** — `from`, `to`, `action`, `requiredPermission`, `guards[]` (e.g. "actor is not the author", "all required approvals present for current version", "attachments scanned", "classification is Public"), `effects[]` (create task, notify, issue reference, enqueue publication).
- **WorkflowInstance** — record id, definition id + version, current state, current version id, row version for optimistic concurrency.
- **TransitionEvent** — append-only: instance, from, to, action, actor, role used, reason/comment, record version hash, timestamp, idempotency key, correlation id.

## 21. Baseline lifecycle (to be refined per register)

```
Draft
  → Submitted            (author submits)
  → Under review         (reviewer accepts / auto-assigned)
      → Revision requested → (author revises → new version) → Submitted
      → Rejected            (terminal unless reopened by policy)
      → Approved            (required approvals for THIS version satisfied)
  → Publication authorised (publishing authority, distinct from approval)
  → Publishing             (outbox entry created; awaiting portal confirmation)
      → Published          (portal confirmed; receipt stored)
      → Publication failed (visible, reconcilable, retryable)
Published → Correction in progress → (new version through review) → Published (vN+1)
Any pre-publication state → Withdrawn (author or authorised officer, with reason)
Published / Rejected / Withdrawn → Archived (by policy)
```

Suggested register-specific differences (VERIFY with leadership and portal):

- **Decisions:** add `Adopted` before approval; publication requires an approving officer different from the proposer ("second officer" rule).
- **Appointments:** mandatory `Verified` stage performed by someone other than the drafter; publication of personal fields requires explicit disclosure authorisation.
- **Public Finance:** link to a source document is a guard on submission; approval by a finance-authorised officer; restricted classification until publication authorised.
- **Opportunities/Applications:** position records follow the publication lifecycle; applications follow a separate internal lifecycle (Received → Under review by reviewer A and reviewer B → Shortlisted / Not progressed → Appointed), never published; an appointment arising from an application creates an Appointment record.
- **Dispatches:** a lighter path (one reviewer + publishing officer) where policy allows.

## 22. Engine guarantees

- Every transition is validated on the server against: current state, record version, definition guards, the actor's permissions and institutional scope, and separation-of-duties rules. Client payloads never decide state.
- **Separation of duties** is configurable per definition: author ≠ approver; approver ≠ publisher where required; two distinct approvers where required; nobody approves a version they authored or materially edited. The founder or any individual is never hard-coded as a universal approver.
- **Version-aware approval:** approvals bind to a version's content hash. Editing after approval invalidates approvals for the new version.
- **Concurrency:** optimistic locking (row version / ETag) on every mutation; a stale update fails with a clear, recoverable message ("This record changed while you were reviewing it. Review the changes and try again.").
- **Idempotency:** every state-changing request carries an idempotency key; replays return the original result.
- **Atomicity:** state change, transition event, audit event, task creation, notification and outbox entry commit together, or not at all.
- **Due dates and escalation:** computed from policy; overdue status derived, not cron-dependent; escalation surfaces in the queue and briefing (and notifications when a durable scheduler is available — see §31).

## 23. Visual representation

On every folio: the stepper of the record's actual definition (not a generic one), completed stages with actor and time, current stage and assignee, outstanding approvals by name/role, the single next action available to the current user (or a clear statement of why they have none), the countersignature chain, and publication eligibility with each failing condition named.

---

# PART VII — AUTHENTICATION, AUTHORIZATION, AUDIT AND SECURITY

## 24. Authentication

- Use a maintained authentication solution compatible with Next.js on Vercel (for example Auth.js or a managed provider). Do not implement password hashing, session cryptography or token formats by hand. Record the choice in an ADR, including whether identity is shared with the portal's existing Sign in (VERIFY).
- Invitation-only provisioning. No public self-registration. Invitations are single-use, time-limited, and bound to an email address.
- MFA required for every role able to approve, publish, administer, or view Restricted/Confidential records; TOTP minimum, WebAuthn/passkeys preferred.
- Secure, `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) cookies; session rotation on sign-in and privilege change; idle and absolute session timeouts; server-side session revocation (suspension or role removal takes effect on the next request, not at token expiry).
- Brute-force protection and rate limiting on sign-in, MFA, recovery and invitation acceptance; generic error messages that do not reveal whether an account exists.
- Account recovery through the provider's secure flow or administrator-mediated reset — never by an unauthenticated change of email.

## 25. Authorization

- Server-enforced RBAC with institutional scoping (role × institution × classification). Deny by default.
- Proposed roles (refine after discovery): System Administrator, Government Administrator, Institutional Administrator, Departmental Officer, Author, Reviewer, Approving Officer, Publishing Officer, Finance Officer, Appointments Verifier, Auditor (read-only).
- Produce `docs/security/PERMISSION_MATRIX.md`: every permission × role × scope, and which transitions each permission enables. Generate it from the code's policy definitions if possible so documentation cannot drift.
- Authorization is checked in one policy module, invoked by every server action, route handler, data-access function and publication call. UI hiding is a convenience, never a control.
- Record-level checks prevent insecure direct object references: every lookup is scoped by the caller's permissions; unauthorised records return the same response as non-existent ones.
- Search, counts, autocomplete, notifications, and error messages respect the same rules — a user cannot infer the existence of a record they cannot see.

## 26. Audit

- Append-only audit events for: authentication events (success, failure, MFA, sign-out, session revocation); invitation and account changes; role and permission changes (proposed, confirmed, rejected); record creation, edit, version creation; workflow transitions; assignments; comments on restricted records; publication requests, results and reconciliations; policy changes; access to Confidential records; authorization failures.
- Fields: id, timestamp (UTC), actor id and role used, institution scope, action, target type and id, record version hash where relevant, outcome, reason, correlation id, request metadata (IP and user agent, retained per a documented policy).
- Never log passwords, tokens, secrets, full document bodies, or unnecessary personal data.
- **Tamper evidence:** chain events with a hash of the previous event (per-stream or global), and provide a verification routine and an "Integrity verified as of…" indicator in the Audit Register. Describe this accurately as tamper-*evident*, not immutable; do not claim cryptographic immutability unless an external anchor is genuinely implemented.
- No user — including administrators — can edit or delete audit events through the application. Storage-level permissions should prevent the application role itself from updating or deleting them where the storage supports it.

## 27. Additional protections (implement and test)

Broken access control; XSS (sanitise rich text server-side with an allow-list, strict Content Security Policy with nonces, no `dangerouslySetInnerHTML` on unsanitised content); injection; CSRF on any cookie-authenticated mutation not covered by Next.js server-action protections; IDOR; mass assignment (explicit schema-validated DTOs, never spreading request bodies into models); unsafe uploads; session fixation; open redirects; information leakage in errors; rate-limit bypass; unauthorised publication; duplicate transitions; race conditions; clickjacking (`frame-ancestors 'none'`); security headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).

Validate every untrusted input with a schema library (e.g. Zod) at the boundary. Never commit `.env` files, credentials, keys or production data. Add a secret-scanning step to CI.

---

# PART VIII — PERSISTENCE AND ALETHEIADB

## 28. Investigate, then decide

AletheiaDB exists as a project initiative. VERIFY its implementation before choosing persistence. In particular, do not assume a store built on files (for example, JSON documents in a Git repository) provides transactions, concurrency control, atomic sequence allocation, durable workflow semantics, query performance, or fine-grained authorization.

Assess and document:

- read and write operations available; query capabilities and pagination;
- authentication, authorization and credential scope;
- atomicity of single and multi-record writes; conflict detection;
- consistency after write (read-your-writes);
- validation; size and rate limits;
- backup, restore and point-in-time recovery;
- runtime compatibility with Vercel serverless/edge functions;
- error semantics and retry safety.

## 29. Decision rule

- If AletheiaDB provides the required guarantees for authoritative workflow state, integrate it through a typed, documented server-side adapter.
- If it does not, explain the gap precisely and propose the smallest safe adjustment — for example, AletheiaDB remains the system of record for published public content while workflow state, audit events and the outbox live in a transactional store — and present it to leadership with cost. Do not silently replace AletheiaDB, and do not introduce a new paid dependency without approval.
- In all cases, business logic depends on repository interfaces (`RecordRepository`, `WorkflowRepository`, `AuditRepository`, `OutboxRepository`, `ReferenceAllocator`), never on a storage technology.

## 30. Data discipline

Typed domain models; schema validation on read and write; versioned records; migrations or controlled schema evolution; UTC timestamps; soft deletion only where policy allows (never for audit); authoritative state never held only in React state, browser storage, process memory, or temporary files.

---

# PART IX — PUBLICATION, NOTIFICATIONS, SEARCH, PLATFORM

## 31. Publication integration — the most important functional requirement

### 31.1 Principle

Approval is internal. Publication is public. They are separate, explicitly authorised acts. The workbench confirms publication **only** on authoritative confirmation from the public portal.

### 31.2 Discovery (before writing the connector)

VERIFY where and how each register is stored and rendered, whether a content API exists, how it authenticates, how references and hashes are generated, how homepage/preview inclusion and scheduling work, and whether the portal can safely accept writes. Record findings in `docs/integration/PUBLICATION.md`.

### 31.3 Contract

If no suitable API exists, define and implement the smallest appropriate extension in the portal's backend (or a precise contract for whoever owns that codebase), covering:

- `POST /publications` — body: register, workbench record id, version id, content hash, payload (validated per register), reference (if issued by the workbench) or a request for one, display options (homepage/preview inclusion, schedule) only where supported, idempotency key. Response: public reference, public URL, published-at, stored content hash.
- `GET /publications/{idempotencyKey}` — reconciliation: returns the authoritative state of a previous request.
- Correction/supersession and, if policy allows, withdrawal endpoints.
- **Authentication:** service-to-service, independently validated by the portal — e.g. request signing (HMAC over method, path, timestamp, body hash) with a short timestamp window and key rotation, or mutual TLS, or a scoped token from a managed secret store. Credentials live only in server-side environment variables or a secret manager; never in client bundles or API responses.
- The portal re-validates everything: schema, register, eligibility flags, hash match, and the authority of the calling service.

Do not scrape or automate the public site's UI. Do not create a parallel database for the public site.

### 31.4 Delivery mechanics

1. Publishing officer confirms on the Publication sheet.
2. In one transaction: transition to `Publishing`, write audit event, write **outbox** entry with idempotency key.
3. The request handler attempts delivery immediately; a durable retry path (Vercel Cron or Vercel Queues / equivalent, chosen and justified in an ADR) processes any undelivered or uncertain entries with backoff.
4. On success, store the receipt (reference, URL, timestamp, hash), transition to `Published`, audit, notify.
5. On a definitive rejection, transition to `Publication failed` with the portal's reason, audit, notify.
6. On a **timeout or ambiguous response**, do not assume failure: mark `Needs reconciliation`, query the portal by idempotency key, and only then retry or confirm.
7. Retries reuse the same idempotency key, so duplicates are impossible.

### 31.5 Destinations

Offer only destinations and display options that discovery confirms exist on the portal. Anything else is listed in the final report as a new development requirement, not built as a fake option.

### 31.6 Development adapter

If the portal integration cannot be completed during development, implement the `PublicationGateway` interface with a development adapter that is unmistakable: it is enabled only when `PUBLICATION_MODE=development`, the UI shows a persistent "Publication is simulated in this environment" banner, receipts are marked simulated, and the production build refuses to start with the development adapter configured.

## 32. Notifications

In-application notifications for: assignment, submission for review, review requested, approval recorded, revision requested, rejection, deadline approaching, overdue, publication confirmed, publication failed, privileged change awaiting confirmation. Read/unread state, history, per-type preferences. Email via an approved provider only if credentials are supplied — behind a `NotificationChannel` interface — tested before being described as working; never sent to invented addresses. Time-based notifications (approaching, overdue) require a durable scheduler (Vercel Cron); document this dependency.

## 33. Search and filtering

Global search (command palette) and contextual register search across references, titles and permitted metadata. Filters for institution, register, status, assignee, classification, priority and dates. Results, counts, previews and autocomplete obey authorization exactly. Exact reference match (`AGV-DEC-2026-0007`) jumps straight to the record.

## 34. Forms and interaction

Inline validation on blur and on submit, with errors summarised at the top and linked to fields; preserved input on failure; autosave for long-form content; unsaved-changes guard; confirmation for destructive or irreversible actions with consequence-led wording; typed confirmation (e.g. the reference) for publication withdrawal and role revocation. No browser `alert()`/`confirm()`.

## 35. Accessibility and performance

- WCAG 2.2 AA: keyboard operability everywhere (including tables, steppers, comboboxes, the command palette), visible focus (a 2 px navy outline with offset, gold reserved — do not use gold focus on light backgrounds where it fails 3:1), semantic landmarks and headings, labelled controls, `aria-live` status for asynchronous outcomes, accessible names on icon buttons, skip link, zoom to 200% without loss, reduced motion.
- Automated checks with axe in end-to-end tests; manual keyboard and screen-reader pass (VoiceOver and NVDA) on the core workflow.
- Performance: Server Components by default; client components only where interaction requires; server-side pagination; no loading entire registers into the browser; optimised arms and contour assets; Core Web Vitals budgets (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) on a mid-range laptop.
- Caching: authenticated responses are `private, no-store` unless proven safe; never cache authenticated data in shared caches or static generation; no user data in the client router cache across sign-outs.

---

# PART X — ARCHITECTURE, TESTING, DELIVERY

## 36. Stack

Next.js (App Router) · React · TypeScript `strict` (plus `noUncheckedIndexedAccess`) · TSX · Tailwind CSS driven entirely by the token layer (no arbitrary values in components) · an accessibility-primitive library (e.g. Radix) for behaviour, restyled · a maintained auth solution · Zod · AletheiaDB via adapter (or the approved alternative) · Vitest · Playwright · axe-core · ESLint + Prettier · GitHub Actions (or the existing CI) · Vercel. Add nothing for appearance's sake.

## 37. Structure

A modular monolith with enforced boundaries:

```
src/
  app/                     # routes, layouts, server actions (thin)
    (auth)/  (workbench)/  api/  design/
  design/                  # tokens, typography, theme
  components/ui/           # owned component library
  components/patterns/     # register table, folio, custody column, stepper…
  domain/                  # entities, value objects, glossary types — no framework imports
    records/ workflow/ institutions/ access/ publication/ audit/
  policy/                  # authorization policies, SoD rules, permission matrix source
  workflow/                # engine, definitions (versioned), guards, effects
  services/                # application services orchestrating domain + ports
  ports/                   # repository and gateway interfaces
  adapters/                # aletheiadb/, publication-portal/, notifications/, storage/
  lib/                     # validation, idempotency, correlation, errors, time
  tests/                   # fixtures and helpers (dev seed lives here, never in prod paths)
docs/
  discovery/ decisions/ design/ integration/ security/ deployment/
  GLOSSARY.md IMPLEMENTATION_LOG.md
```

UI components never import adapters or database code. Lint rules enforce the dependency direction.

## 38. Testing

**Unit:** every workflow transition and guard for every register definition; SoD rules; permission policy (table-driven from the matrix); publication eligibility; reference allocation; content hashing (cross-checked with the portal's algorithm); validation schemas; audit chain verification.

**Integration:** repository adapters against a disposable test instance; authentication boundaries; atomic commit of transition + audit + outbox; publication gateway against a contract-test server or a staging portal; reconciliation on timeout.

**End-to-end (Playwright), at minimum:**

1. An invited official accepts an invitation, enrols MFA, and signs in.
2. An unauthenticated visitor cannot reach any protected route or API.
3. An official creates and saves a draft; autosave persists across reload.
4. An author submits for review.
5. A reviewer requests revision with comments.
6. The author submits a corrected version; the diff shows the change.
7. An authorised officer approves the corrected version.
8. An unauthorised user cannot approve it via UI, crafted request, or direct API call.
9. The author cannot approve their own submission where SoD applies.
10. An approved item cannot be published without publication authorisation.
11. An authorised publishing officer publishes an eligible Dispatch.
12. The public portal (staging) displays the correct content, reference and hash.
13. A publication failure is recorded, visible, and reconcilable.
14. A retried publication does not create a duplicate public record.
15. A Restricted finance record is invisible to an unauthorised user in registers, search, counts and direct URLs.
16. Audit events accurately record every sensitive transition, and chain verification passes; a tampered event is detected.
17. A concurrent stale edit is rejected without overwriting authoritative state.
18. An unpublished draft never appears on the public portal.
19. Revoking access stops the next protected operation immediately.
20. A user cannot grant themselves a role; a privileged change requires a second administrator.
21. Editing an approved record creates a new version and invalidates approvals for it.
22. Core screens pass axe checks at 375 px and 1280 px.

Tests run against isolated data. Never run destructive tests against production. Visual regression snapshots for each page archetype.

## 39. Vercel deployment and domain

1. Use or create the Git repository; import into Vercel; configure build, Node runtime and regions (consider proximity to the data store and to officials in Africa and Europe).
2. Separate Preview, Staging and Production environments with separate secrets and separate data. Preview deployments must never use production credentials or data, and should be protected (Vercel deployment protection).
3. Add `ops.aletheiagov.org` as a custom domain in the Vercel project; use **exactly** the DNS record Vercel provides — never guess the target.
4. Add that single record at the authoritative DNS provider without modifying apex, `www`, MX, SPF, DKIM, DMARC or any other record. Take a screenshot or export of the zone before and after.
5. Verify domain, HTTPS certificate, HSTS, and security headers on the production URL.
6. Configure production environment variables; document each in `.env.example` (names, purpose, required/optional, example format — never values).
7. Design for serverless constraints: no long-lived processes, no reliance on in-memory state between requests; durable outbox and Cron for retries and time-based work. Recommend a separate worker service only if measured need justifies it, with cost.

## 40. Phases and exit criteria

| Phase | Work | Exit criteria |
|---|---|---|
| 1 Discovery | Sites, repos, AletheiaDB, portal backend, auth, deployment | `FINDINGS.md`, `DESIGN_REFERENCE.md`, `SYSTEM_REFERENCE.md`, decisions list |
| 2 Design system & frame | Tokens, Manrope setup, components, frame, archetype layouts, `/design` route | Screenshots at all breakpoints; `REVIEW.md` passes §16 |
| 3 Identity & access | Auth, invitations, MFA, sessions, RBAC, permission matrix, two-person rule | Auth E2E tests pass; matrix generated |
| 4 Workflow & persistence | Domain models, adapters, engine, versions, tasks, audit chain | Unit + integration suites pass; concurrency and idempotency proven |
| 5 Registers | Documents, Decisions, Dispatches, Finance, Appointments, Opportunities, Events, Institutions | Each register's lifecycle E2E passes |
| 6 Publication | Contract, gateway, outbox, reconciliation, portal extension if needed | Publication E2E (11–14, 18) pass against staging portal, or blocker documented |
| 7 Hardening | Security review, headers, CSP, rate limits, a11y, performance, visual regression | All suites green; a11y and perf budgets met |
| 8 Deployment & handover | Vercel, domain, docs, final report | Production URL live over HTTPS; no collateral DNS change; report delivered |

## 41. Deliverables

1. The complete Next.js/TypeScript application.
2. The Aletheia Operations design system (tokens, components, `/design` reference route, design documentation).
3. Discovery reports and ADRs.
4. Authentication, invitation, MFA and server-side authorization.
5. The documented role and permission matrix.
6. The versioned workflow engine with per-register definitions.
7. Persistent records, versions, tasks, audit chain and outbox.
8. Review, approval and countersignature functionality.
9. A working publication integration — or a precisely documented blocker with the development adapter clearly marked.
10. Notification framework.
11. Unit, integration, end-to-end, accessibility and visual-regression tests, wired into CI.
12. `.env.example` without secrets.
13. README: purpose, architecture, setup, scripts, testing, conventions.
14. Vercel deployment guide and DNS instructions.
15. Security and operational limitations report.
16. Glossary.
17. Final report (§43).

## 42. Final acceptance criteria

The project is complete only when every applicable item is true:

- [ ] It visibly belongs to the `aletheiagov.org` family: Manrope throughout, the verified palette, the editorial devices, the voice.
- [ ] Manrope is the only typeface; no faux italics; tabular figures in all data.
- [ ] It cannot reasonably be mistaken for a generic or AI-generated admin template; every item in §12.1 is absent.
- [ ] No fake production data, figures or integrations exist.
- [ ] Every protected route, action and API enforces authorization on the server; default is deny.
- [ ] No user can grant themselves privileges; privileged changes require a second administrator.
- [ ] Workflow transitions are validated, atomic, idempotent and persisted.
- [ ] Separation of duties is enforced where policy requires it.
- [ ] Approvals bind to specific versions; revisions never silently rewrite approved or published history.
- [ ] References are unique, atomically allocated and never changed.
- [ ] Publication requires explicit authorisation and is confirmed only by the portal.
- [ ] Retries cannot duplicate public records; ambiguous results are reconciled.
- [ ] Private and restricted records never leak through registers, search, counts, notifications or errors.
- [ ] Critical operations produce tamper-evident audit records.
- [ ] Responsive at every breakpoint; WCAG 2.2 AA on core flows.
- [ ] All test suites pass in CI; the production build passes.
- [ ] Deployed to `https://ops.aletheiagov.org` over HTTPS.
- [ ] No existing Aletheia website, domain, email configuration or service was disrupted.
- [ ] Every incomplete feature, unverified assumption and unconfigured dependency is reported.

## 43. Final report format

Deliver `docs/FINAL_REPORT.md` with these sections, in this order, written plainly:

1. **Summary** — what was built, in five sentences or fewer.
2. **Verified working** — each feature with the test(s) that prove it.
3. **Built but not verified in production** — and why.
4. **Not built** — with reason and recommended next step.
5. **Assumptions** — every assumption made in place of verification.
6. **Decisions required from leadership.**
7. **External configuration required** — secrets, DNS, provider accounts, with exact steps.
8. **Security posture and known limitations.**
9. **Design review outcome** — with links to final screenshots.
10. **Test results** — passed, failed, skipped, unconfigured, with counts.

---

# PART XI — BEGIN

1. Read this entire prompt.
2. Inspect the workspace: existing files, repositories, configuration.
3. Inspect `https://aletheiagov.org` and `https://www.stateofaletheia.org` thoroughly, as specified in Part III.
4. Write the discovery documents. Raise only the decisions that are genuinely blocking.
5. Then — and only then — begin the design system, and build outward phase by phase.

Do not open with a dashboard. Open with understanding.

The objective is a beautiful, dependable, human-made internal government platform that feels native to Aletheia, enforces institutional discipline, and connects approved government business to the public record — where nothing is real until it is published, and nothing is published without authority.

Visual excellence, security, workflow correctness and maintainability are equal engineering responsibilities. None may be traded for another.
