# MASTER ENGINEERING PROMPT — v2

# ALETHEIAGOV.ORG — THE FOUNDING GOVERNMENT PLATFORM

Production implementation brief for an autonomous senior engineering agent.

---

## 0. HOW TO READ THIS BRIEF

This brief is long. Requirements are ranked, and when two of them conflict, the higher tier wins:

| Tier | Meaning | Examples |
|---|---|---|
| **T0 — Inviolable** | Never break this, even if the result is an incomplete feature. | Truthfulness about status, no secrets in the browser, server-side authorization, no fake persistence, no confidential data in readable Git history. |
| **T1 — Release-blocking** | The release cannot ship without it. | Quality gates in §20, security controls in §14, accessibility AA, honest error states. |
| **T2 — Expected** | Build it in this release unless a documented blocker prevents it. | Full recruitment flow, document publication workflow, workbench core. |
| **T3 — Ambition** | Build when T0–T2 are green. | Command palette, View Transitions, advanced motion, i18n beyond English. |

Section §1 contains every T0 rule. If you only remember one page, remember §1.

**You do not stop at a plan.** Audit, implement, run every check, fix what fails, and report what is actually true. Ask the human only when blocked by a missing credential, a destructive action, or a genuine ambiguity that changes the architecture. Otherwise, make the decision, record it in `docs/decisions/` (ADR format), and continue.

---

## 1. THE INVIOLABLE RULES (T0)

1. **Truth about status.** Aletheia is a proposed maritime republic and nation-building project. It has no recognized territory, no international recognition, and no diplomatic relations. The platform must never state or imply otherwise — in copy, imagery, metadata, structured data, or Open Graph tags. Every institution, programme, and position carries a typed status (§5.2) that is rendered visibly.
2. **No fabrication.** No invented officeholders, appointments, budgets, reserves, statistics, progress percentages, partners, investors, testimonials, endorsements, decisions, licences, or historical announcements. An honest empty state is always preferable to a plausible fake.
3. **No secrets client-side.** No database, GitLab, mail, or auth secret ever reaches the browser. Nothing secret is prefixed `NEXT_PUBLIC_`. A CI check enforces this (§20).
4. **The browser never talks to AletheiaDB or GitLab.** All data access goes through server-only modules guarded with `import "server-only"`.
5. **Server-side authorization on every protected operation.** Hidden UI is not access control. Deny by default.
6. **No simulated persistence.** Success is shown only after AletheiaDB confirms the write. Production never falls back to an in-memory or fixture store.
7. **Confidential data never lands in plaintext Git history.** AletheiaDB persists to Git; Git history is effectively permanent and is copied by every clone and mirror. See §8.4 — this rule shapes the entire data design.
8. **No invented AletheiaDB capabilities.** Read the real SDK/API before integrating. If a capability is missing, build a typed adapter boundary, document the gap, and fail honestly.
9. **No privilege self-assignment.** No user can approve their own application, grant their own role, or publish their own content where approval is required.
10. **Never claim a check passed that you did not run.**

---

## 2. ROLE

Act as a single senior team covering: principal full-stack engineering (Next.js, Node.js, TypeScript), Rust database integration, application security, product and editorial design, design systems, accessibility, DevOps, QA automation, and technical writing.

The standard is a platform a serious institution would be proud to launch: visually unforgettable, technically sober, and truthful.

---

## 3. PROJECT IDENTITY

| Field | Value |
|---|---|
| Official name | Sovereign Covenant State of Aletheia |
| Common name | Aletheia |
| Government website (this project) | https://aletheiagov.org |
| National website (separate) | https://stateofaletheia.org |
| Proposed capital | Antioch |
| Motto | *Veritas in Foedere* — Truth in Covenant |
| Currency | Aletheian Guilder (AEY) |
| Monetary infrastructure | Aletheia StableChain |
| Database | AletheiaDB (Rust engine, GitLab-backed storage) |
| Working language | English (German, Serbian, Italian planned) |

### 3.1 The two-website distinction

- **stateofaletheia.org answers "What is Aletheia?"** — identity, symbols, constitutional vision, currency, national ambition.
- **aletheiagov.org answers "Who is building it, how, and how can they be held to account?"** — the founding government, its institutions-in-formation, programmes, opportunities, records, decisions, finance, and progress.

Do not duplicate national content. Link across where useful. The government site's tone is closer to a public gazette and an annual report than a national brochure.

---

## 4. PRODUCT SCOPE

One Next.js application, two security contexts:

**A. Public Government Website** — editorial, fast, statically rendered where possible, fully usable without an account.

**B. Government Workbench** (`/workbench`) — authenticated, dynamic, never cached publicly, never indexed.

Plus **C. Applicant Portal** (`/account`) — the narrow authenticated surface for registered applicants to manage their own applications. Applicants never enter the workbench shell.

---

## 5. CONTENT TRUTH SYSTEM

Truthfulness is a design system, not a disclaimer.

### 5.1 The founding-stage notice

A single, well-designed notice component appears in the footer colophon on every page, and as an inline banner on `/government`, `/institutions`, `/public-finance` and `/appointments`:

> The Government of Aletheia is a founding government-in-formation. Aletheia does not currently hold recognized territory or international recognition. Institutions described here are proposed or in formation unless marked Operational.

Copy is editable via the content system; the component is not removable from those routes.

### 5.2 Status taxonomy (typed, shared, rendered everywhere)

```ts
type InstitutionalStatus =
  | "proposed"        // described in a draft framework only
  | "planned"         // approved for development, no work started
  | "in_formation"    // people and work assigned, not yet functioning
  | "in_development"  // for programmes/projects with active work
  | "recruiting"      // actively seeking founding contributors
  | "established"     // established within the project's own framework
  | "operational"     // verified to be functioning; requires evidence link
  | "suspended"
  | "archived";
```

Rules:
- `operational` cannot be set without an `evidence` reference (document or decision ID) and a second authorized approver. Enforced server-side.
- Status is rendered by a `StatusSeal` component: a small circular mark plus a text label. Never colour alone.
- Every status change writes an audit event and appears in the public change history of that record.

### 5.3 Imagery truth
Conceptual renders, maps, and visualizations of proposed sites carry a visible caption: "Conceptual visualization — not an existing site." Stock photography of real coastlines is never captioned or implied as Aletheian territory.

---

## 6. ART DIRECTION — "THE LEDGER AND THE SEA"

The visual quality is a release-blocking requirement. This section is deliberately specific so the result has a recognizable identity rather than a template look.

### 6.1 Concept

The site is a **living public gazette for a maritime republic-in-formation**. Two worlds meet:

- **The Ledger** — warm parchment pages, hairline rules, reference numbers, margins carrying metadata, the calm authority of a well-set public record.
- **The Sea** — deep navy chapters, vast open-water photography, slow tidal motion, abstract bathymetric contour lines.

The page alternates between these worlds like turning from the register to the window. Every design decision should be explainable by one of the two.

It must never look like: a SaaS landing page, a crypto launch, a generic Tailwind dashboard, a WordPress government theme, a glassmorphism demo, or a micronation hobby page.

### 6.2 Colour system

Core colours (exact):

| Token | Hex | Role |
|---|---|---|
| `--covenant-navy` | `#15294A` | Dark chapters, navigation on scroll, workbench chrome |
| `--ledger-parchment` | `#F4EEDF` | Primary page ground, document surfaces |
| `--seal-gold` | `#C49A4E` | Hairline rules, seal marks, large display accents, focus ring on navy |
| `--laurel-green` | `#2F6B4F` | Verified/operational states, sparing institutional accents |

Derive full tonal scales (50–950) for each in `styles/tokens.css` using OKLCH so steps are perceptually even. Suggested anchors (verify contrast, adjust if needed):

- `--navy-950: #0B1628` (deepest chapter ground), `--navy-800: #15294A`, `--navy-600: #2A4470`
- `--parchment-50: #FBF8F1`, `--parchment-100: #F4EEDF`, `--parchment-300: #E4D9C0`
- `--ink-900: #141A24` (body text on parchment), `--ink-600: #4A5263` (muted text)
- `--gold-700: #8A6A2F` (gold **text** on parchment)

**Contrast rules that are easy to get wrong:**
- Seal Gold `#C49A4E` on parchment is roughly 2.3:1. It **fails** for text. On parchment use it only for rules, ornaments, and non-text marks; use `--gold-700` for gold-coloured text.
- Seal Gold on navy passes for text and is the preferred focus-ring colour on dark chapters.
- Every token pair used for text is listed in `docs/design/contrast.md` with its measured ratio. A unit test asserts AA for that list.

Usage hierarchy: parchment and navy carry ~90% of the surface area; gold ~5% (lines and marks); green under 2%. Never place all four colours in one component.

Dark mode: the public site has a single deliberate theme (parchment pages, navy chapters). The workbench supports light (parchment) and dark (navy-950) themes via tokens, respecting `prefers-color-scheme` with a user override.

### 6.3 Typography

Manrope (variable, self-hosted via `next/font/local` or `next/font/google` with `display: "swap"`, subset Latin + Latin Extended for future German/Serbian/Italian).

A monospace face is permitted **only** for reference numbers and code (e.g. JetBrains Mono or IBM Plex Mono, self-hosted). Use `font-variant-numeric: tabular-nums` for all figures, dates and references.

Fluid type scale (desktop → mobile via `clamp()`):

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | `clamp(3.5rem, 9vw, 9rem)` | 300 | −0.04em | Homepage "ALETHEIA" only |
| `display` | `clamp(2.75rem, 5.5vw, 5.5rem)` | 300 | −0.03em | Chapter titles |
| `h1` | `clamp(2.25rem, 4vw, 3.75rem)` | 400 | −0.02em | Page titles |
| `h2` | `clamp(1.75rem, 2.6vw, 2.5rem)` | 500 | −0.015em | Section headings |
| `h3` | `1.375rem` | 600 | −0.01em | Sub-sections |
| `lede` | `clamp(1.25rem, 1.6vw, 1.5rem)` | 400 | −0.005em | Introductory paragraphs |
| `body` | `1.0625rem` / 1.65 | 400 | 0 | Reading text, max 68ch |
| `meta` | `0.8125rem` | 600 | +0.12em, uppercase | Eyebrows, margin labels — sparingly |
| `ref` | `0.8125rem` mono | 500 | 0 | `AGV-DEC-2026-0004` |

Light weights at large sizes are the signature: confident through scale and space, not through boldness. Never set every heading in uppercase.

### 6.4 Grid and space

- 12-column grid, max content width 1440px, outer gutter `clamp(1.25rem, 4vw, 4rem)`.
- **The margin column**: on public reading pages (documents, decisions, dispatches, institutions), columns 1–3 hold sticky metadata (reference, status, issuing body, dates, version) set in `meta`/`ref` styles; columns 4–10 hold the text. On mobile the margin collapses into a metadata block above the title. This is the single most recognizable layout device on the site — use it consistently.
- Spacing scale on a 4px base; section rhythm uses large steps (`clamp(6rem, 12vw, 12rem)` between chapters).
- Prefer hairline rules (`1px`, `--seal-gold` at 45% opacity on parchment, 30% on navy) over boxes. Cards only where grouping genuinely needs a container. No drop shadows on the public site; radius at most 2px.

### 6.5 Signature motifs

1. **Reference numbers.** Every public record has an official reference in the form `AGV-{TYPE}-{YEAR}-{SEQ}` (e.g. `AGV-DOC-2026-0012`, `AGV-OPP-2026-0003`). Generated server-side, unique, immutable, shown in the margin column and in search results. They make the site feel like an institution of record.
2. **Section marks.** Chapters are numbered `§ 01`, `§ 02` in the `meta` style, preceded by a 48px gold hairline.
3. **Bathymetric contours.** A subtle SVG field of concentric contour lines, generated procedurally (seeded noise), used as background texture on navy chapters at 6–10% opacity. It must be clearly abstract — never a real coastline or a map of a claimed area.
4. **The seal.** The official emblem appears in the header (small), the hero (once, restrained), and the colophon. Not on every section. If no approved emblem asset exists, render a neutral monogram placeholder labelled in code as `PlaceholderMark` and record the gap.
5. **The colophon footer.** The footer is set like the colophon of a printed book: identity, motto in Latin and English, founding-stage notice, link columns, last-published timestamp, and a link to stateofaletheia.org.

### 6.6 Photography

- Subjects: open ocean from altitude, storm light over water, harbour engineering, lighthouses, contemporary civic interiors, architectural models, people at work over drawings and screens. Documentary, unposed, atmospheric.
- Grade every image consistently: slightly cooled shadows, lifted blacks, restrained saturation, so the set reads as one body of work. Apply the grade at build time (sharp) or via a consistent CSS treatment; document the recipe.
- Download and self-host licensed images in `public/images/` with a `credits.json` manifest (source, author, licence, URL). Render attribution where the licence requires it and on an `/image-credits` page. Never hotlink.
- Use `next/image` with explicit `sizes`, AVIF/WebP, blur placeholders, and `priority` only on the hero.
- Never overlay slogans or paragraphs on photographs. Typography sits beside, below, or over large calm areas of sky/water only — the hero title is the single exception.

### 6.7 Motion system

Motion is tidal: slow, settled, never bouncy.

| Token | Value |
|---|---|
| `--ease-tide` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--dur-quick` | 180ms (hover, focus) |
| `--dur-base` | 320ms (drawers, dialogs) |
| `--dur-reveal` | 720ms (section reveals) |
| `--dur-hero` | 1600–2400ms (hero settle) |

Choreography:
- **Hero**: photograph settles from `scale(1.06)` to `1.0` over 2.4s; title lines reveal through a rising mask, staggered 120ms; the ledger strip fades in last.
- **Section reveals**: 24px rise + opacity, triggered once by IntersectionObserver, staggered children at 60ms. Content is fully visible without JavaScript (progressive enhancement — never hide content behind JS that might not run).
- **Images**: clip-path reveal from the bottom edge on first view.
- **Parallax**: at most 6–8% translation on hero and chapter imagery, transform-only.
- **Route transitions**: View Transitions API where supported (T3), cross-fade fallback otherwise.
- Implementation: CSS first; `motion` (Framer Motion) only for orchestrated sequences, loaded in client islands, never on every page.
- `prefers-reduced-motion: reduce` disables parallax, scaling and staggering; reveals become instant opacity.
- Forbidden: scroll-jacking, animated counters, particles, custom cursors, infinite loops, typewriter effects.
- Animate only `transform` and `opacity`. No layout thrash. Motion must not push INP or CLS over budget (§20).

### 6.8 Design review is a build step

After each visual phase, run Playwright to capture full-page screenshots of every public route at 390, 768, 1280 and 1728px widths, review them yourself against this section, fix what is weak, and commit the screenshots to `docs/design/review/` as the visual baseline. Then enable visual regression tests against that baseline.

Self-review questions:
- Could this page be mistaken for a template? If yes, where is the margin column, the reference, the rule, the chapter rhythm?
- Is there one clear focal point per viewport?
- Is the text column readable (≤ 68ch)?
- Does any element shout? Remove it or quiet it.
- Is anything implying recognition, territory, or achievement that does not exist?

---

## 7. HOMEPAGE — CHAPTER BY CHAPTER

The homepage is a sequence of chapters alternating Sea (navy) and Ledger (parchment).

**§ 00 — Hero (Sea).** Full-viewport sea photograph (open water from altitude, no identifiable land). Transparent header that becomes solid navy on scroll. Title composition, left-aligned on the lower third:

```
THE GOVERNMENT OF
ALETHEIA
Sovereign Covenant State of Aletheia
```
"THE GOVERNMENT OF" in `meta`, "ALETHEIA" in `display-xl`, the full name in `lede`. Along the bottom edge, a thin parchment **ledger strip**: *Veritas in Foedere* · "Founding government-in-formation" · date of last publication · a "Read the founding record ↓" anchor link. No buttons competing with the title.

**§ 01 — The founding government (Ledger).** Two-column: a large `lede` statement on what the founding government does (builds institutions, infrastructure, economic frameworks, and accountable records before territory), and in the margin column the current status and a link to `/government`.

**§ 02 — Institutional framework (Sea).** An editorial index, not a card grid: each institution on its own row separated by gold hairlines — name in `h2`, one-line mandate, `StatusSeal` on the right. Rows expand subtly on hover. Data-driven from `institutions` (published only).

**§ 03 — National programmes (Ledger).** A horizontal editorial rail of 4–6 featured programmes, each with a graded photograph, programme name, status, and latest verified milestone (or "No milestones published yet"). Data-driven.

**§ 04 — Founding opportunities (Sea).** A short statement inviting qualified people, then up to five open opportunities as reference-numbered rows (`AGV-OPP-2026-0003 · Chief Monetary Economist · Aletheia Monetary Authority (proposed) · Recruiting`). Honest empty state if none are open.

**§ 05 — The public record (Ledger).** Four columns: latest documents, latest decisions, latest dispatches, public finance. Each shows the three most recent published items with references and dates, or an empty state explaining what will be published there.

**§ 06 — Build the institutional operating system (Sea).** Closing chapter: the guiding principle — *Build the institutional operating system before the physical state* — set large and quiet over a contour-field background, with two links: Explore the record · Contribute your expertise.

**Colophon footer.**

---

## 8. ARCHITECTURE

### 8.1 Stack

Pin exact versions in the lockfile at audit time. Use the latest stable releases available when you start; do not use canary or release-candidate versions.

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), React, TypeScript `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS with tokens from `styles/tokens.css`; no runtime CSS-in-JS |
| Validation | Zod — one schema per entity, shared between server and forms |
| Forms | React Hook Form + Zod resolver, progressive enhancement via Server Actions where suitable |
| Auth | A maintained library (Auth.js or Better Auth); justify in an ADR. Argon2id via `@node-rs/argon2` if passwords are app-managed |
| Logging | Pino, JSON, with request correlation IDs |
| Errors | Self-hostable error tracking (GlitchTip or Sentry) behind an adapter, optional by config |
| Testing | Vitest (unit/integration), Playwright (e2e + visual + screenshots), `@axe-core/playwright` (a11y) |
| Package manager | Whatever the repo already uses; otherwise pnpm |

Every new dependency needs a one-line justification in `docs/dependencies.md`. Prefer the platform and the standard library.

### 8.2 Layering

```
app/ (routes, layouts, UI)            ← no business logic, no DB access
  └─ calls → features/*/actions.ts | app/api/v1/* (thin)
        └─ server/services/*          ← business rules, authorization, audit
              └─ server/repositories/* ← typed persistence per entity
                    └─ server/aletheiadb/ ← the only module that speaks to AletheiaDB
```

- Every file under `server/` starts with `import "server-only"`.
- Services receive an explicit `Actor` (user, roles, scopes) and call `authorize(actor, action, resource)` before any read of non-public data or any write.
- An ESLint rule (`no-restricted-imports`) forbids `app/` and `components/` from importing `server/repositories` or `server/aletheiadb` directly.

### 8.3 AletheiaDB integration

Request path:
`Browser → Next.js server → services → repositories → AletheiaDB client (SDK or typed HTTP) → AletheiaDB HTTP API → Rust engine → storage abstraction → GitLab`

Before writing any integration code:
1. Locate the AletheiaDB source, SDK, and API docs. Read the actual endpoints, auth scheme, query language, error shapes, consistency model, concurrency behaviour, index support, and transaction support.
2. Write `docs/database-integration.md` documenting what exists, what does not, and what the application will do about each gap.
3. Write a **contract test suite** (`tests/contract/aletheiadb.spec.ts`) that exercises every operation the app relies on against a disposable test database. These tests are the source of truth for what the adapter may assume.

The adapter (`server/aletheiadb/client.ts`) provides: config validation, auth headers, per-operation timeouts, retries only for idempotent reads (and for writes only with an idempotency key the engine honours), error mapping to typed `DbError` variants (`NotFound`, `Conflict`, `Unavailable`, `Timeout`, `Invalid`, `Unauthorized`), correlation-ID propagation, structured logging without payloads, and a health probe.

Concurrency: use the engine's revision/version field for optimistic concurrency on every update (`updateOne` with an expected revision). On `Conflict`, surface a clear "this record changed since you opened it" state in the UI — never silently overwrite.

### 8.4 Designing for a Git-backed database (critical)

A Git-backed store has properties a conventional database does not. Design for them explicitly:

1. **History is permanent.** Every committed version of a record stays in history and in every clone. Deleting a record does not erase earlier versions. Therefore:
   - **Confidential and personal data is encrypted at the application layer before it is written** (envelope encryption: AES-256-GCM data keys per record or per subject, wrapped by a master key held in the server's secret store, never in Git). Fields in scope: applicant contact details, CVs and supporting documents, review notes, conflict declarations, internal minutes, personnel records.
   - **Erasure is done by crypto-shredding**: destroy the subject's data key and the history becomes unreadable. Document this in the privacy notice and `docs/data-governance.md`.
   - Public, non-personal records (published documents, decisions, dispatches) may be stored in plaintext.
   - The GitLab repositories backing AletheiaDB must be **private**, with access restricted to the database service account. Recommend separate repositories/namespaces per classification (public-record vs confidential) if the engine supports it.
2. **Writes are expensive and serialized.** Each write is likely a commit. Therefore:
   - **Never write per request for reads.** Sessions, rate-limit counters, view counts, and "last seen" timestamps must not be stored in AletheiaDB (see §8.5).
   - Batch high-volume, low-urgency writes (audit events, notifications) through a small server-side write queue with flush intervals, if and only if the engine's semantics allow batching safely. Audit events for high-risk actions are written synchronously.
   - Expect write latency in the hundreds of milliseconds to seconds; design forms with honest pending states.
3. **Reads must not scan the repository.** Use the engine's indexes where they genuinely exist. For public content, render statically and revalidate on publish (§16), so most public traffic never reaches the database.
4. **Binary files.** Embedded Base64 attachments are allowed only for small public files below a configured limit (default 512 KB). Confidential attachments are encrypted before storage. Larger files go through the `AttachmentStorage` adapter (§12.3) — implement an S3-compatible backend (e.g. self-hosted MinIO or a low-cost provider) if one is configured; otherwise reject with a clear message.
5. **Backups and recovery.** Configure a mirrored backup of the GitLab repositories and document a tested restore procedure. Restore must be rehearsed once in staging before launch.
6. **Exit path.** Repositories depend only on the adapter interface, so a future storage backend requires no changes above `server/aletheiadb/`.

### 8.5 State that does not belong in AletheiaDB

| State | Where it lives |
|---|---|
| Sessions | Signed, encrypted, `HttpOnly` cookie sessions (short TTL, rolling) with a server-side revocation list held in a fast store or in AletheiaDB keyed by session family (written only on sign-out/revocation, not per request) |
| Rate-limit counters | Redis/Valkey or the hosting platform's KV. In-memory limiters are acceptable only on a single long-lived Node process and must be documented as such |
| Caches | Next.js data cache / CDN for public data only |
| Background jobs | A small job runner on the Node host (e.g. a cron route protected by a secret, or a worker process). No assumption that serverless functions persist |

### 8.6 Deployment model

Decide in an ADR after inspecting the actual infrastructure. The default recommendation:

- **AletheiaDB** runs as its own long-lived service (container or VPS) with private networking to the app.
- **The Next.js app** runs as a long-lived Node server (`output: "standalone"`) in a container on the same private network, behind a reverse proxy/CDN that terminates TLS. This avoids serverless cold starts against a slow write path and lets in-process queues work.
- A managed serverless host is acceptable for the app only if the ADR addresses: connection latency to AletheiaDB, queue/job placement, rate-limit storage, and revalidation.

Environments: `local`, `staging`, `production`, each with its own AletheiaDB database/namespace, its own secrets, and its own GitLab backing repositories. Staging is password-protected and `noindex`. Preview builds can never point at production data — enforced by config validation.

---

## 9. INFORMATION ARCHITECTURE

### 9.1 Public routes

| Route | Purpose |
|---|---|
| `/` | Home (§7) |
| `/government` | The founding government: purpose, status, how it is organized, how it is accountable |
| `/institutions`, `/institutions/[slug]` | Institutional framework and each institution |
| `/founding-programme` | The founding programme: phases, principles, current focus |
| `/projects`, `/projects/[slug]` | National projects and programmes |
| `/opportunities`, `/opportunities/[slug]` | Founding roles and how to apply |
| `/appointments` | Verified, published appointments only |
| `/directory` | Public directory of institutions, positions, and published officeholders |
| `/documents`, `/documents/[slug]` | Document library with versions |
| `/decisions`, `/decisions/[slug]` | Published institutional decisions |
| `/public-finance` | Monetary Authority vs Treasury, budgets, procurement, reports |
| `/dispatches`, `/dispatches/[slug]` | Announcements and dispatches |
| `/events` | Public events |
| `/development` | Long-term development framework |
| `/build-aletheia` | Ways to contribute |
| `/search` | Unified search across published records |
| `/contact` | Office-specific enquiry routes |
| `/privacy`, `/terms`, `/accessibility`, `/image-credits` | Policies |
| `/sign-in`, `/register`, `/recover`, `/verify` | Authentication |
| `/account/**` | Applicant portal |
| `/workbench/**` | Government workbench |

Plus `not-found`, `error`, `global-error`, `robots.txt`, `sitemap.xml`, `/.well-known/security.txt`, and `/api/health`.

### 9.2 Navigation

Primary (desktop, max six): Government · Institutions · Programmes · Opportunities · Documents · Search (icon + label). A "Record" menu groups Decisions, Dispatches, Public Finance, Appointments, Directory, Events. "Sign in" is a quiet text link, right-aligned.

Mobile: full-screen navy drawer with large type, focus-trapped, Escape closes, focus returns to the trigger, body scroll locked, links staggered in on open (reduced-motion aware).

Skip link to `#main` on every page.

---

## 10. DOMAIN MODULES

Each module ships with: Zod schema, repository, service with authorization, audit events, public queries (published-only), workbench UI, public UI, tests.

### 10.1 Common record envelope

```ts
interface RecordEnvelope {
  id: string;              // server-generated, opaque (e.g. UUIDv7)
  reference?: string;      // AGV-{TYPE}-{YEAR}-{SEQ}, immutable, public records only
  schema_version: number;  // for lazy migrations
  revision: number;        // optimistic concurrency
  status: string;          // entity-specific typed union
  visibility: "public" | "internal" | "confidential";
  publication: {
    state: "draft" | "in_review" | "approved" | "published" | "withdrawn" | "archived";
    published_at?: string; // ISO 8601 UTC
    published_by?: string;
  };
  created_at: string; updated_at: string;
  created_by: string; updated_by: string;
}
```

Clients never set `id`, `reference`, `revision`, timestamps, `*_by`, publication state, or status directly — these are set by services after authorization.

**Migrations**: each schema has a `schema_version`. Repositories upgrade older documents on read (pure, tested migration functions) and persist the upgrade on next write. A one-off backfill script is available but never runs automatically in production.

### 10.2 Institutions
Name, slug, type, mandate, legal or proposed basis (linked document), status (§5.2), parent, published leadership (links to appointments), public contact (approved only), responsibilities, related projects/documents/decisions, public change history.

### 10.3 Positions, appointments, and directory
Three distinct records: **Position** (may be vacant), **Application** (may be accepted), **Appointment** (a separate, auditable instrument issued by an appointing authority, with term dates and a published appointment document). An accepted application never becomes an appointment automatically. The public directory shows only published appointments.

### 10.4 Recruitment
- **Opportunities**: reference, title, institution, discipline, role type, commitment, responsibilities, reporting line, deliverables, qualifications, compensation **only if approved** (otherwise "Voluntary founding role" or "To be determined" as recorded), deadline, configurable role-specific questions, status lifecycle (draft → approved → open → closed → archived, reopenable).
- **Application state machine** (server-enforced, unit-tested exhaustively):
  `draft → submitted → eligibility_review → under_review → interview? → decision_pending → accepted | declined`, with `info_requested ↔ under_review` and `withdrawn` reachable by the applicant from any pre-decision state.
- **Applicant wizard**: identity & contact → background → expertise & experience → evidence & portfolio → qualifications → proposed contribution → the problem you would address → first 90-day plan → availability → conflict-of-interest → documents → consent → review & submit. Autosaved drafts (debounced, with explicit "Saved at 19:42" confirmation only after the DB confirms), per-step validation, keyboard-complete, resumable, accessible error summary.
- On submission: reference `AGV-APP-2026-0042`, confirmation page, confirmation email **only if mail is configured** (otherwise the page says no email was sent).
- **Data minimization**: no passport numbers, ID numbers, biometric data, banking details, date of birth, or protected characteristics in general applications.
- **Reviewer tools**: assignment queue, structured scoring rubric per opportunity, internal notes (never applicant-visible), information requests (applicant-visible thread), interview scheduling record, conflict-of-interest recusal (a reviewer who declares a conflict loses access), decision with reasons, referral to appointing authority. Every action audited.

### 10.5 Projects, milestones, and tasks
Shared records for public and workbench views with server-enforced field-level visibility (internal risks and notes are never serialized into public responses — use separate public DTOs). Progress is derived only from milestone completion with a documented rule; no manual percentage field.

Tasks: assignee, project, priority, status, due date, dependencies, comments, completion evidence, audit history.

### 10.6 Documents
Metadata per the original brief (type, issuing institution, owner, version, language, classification, access policy, tags, content hash SHA-256, revision history). Lifecycle: draft → in_review → approved → published → superseded | withdrawn → archived. Authors cannot approve their own documents. Public pages show the version list, the hash, and the publication record; superseded versions remain accessible and clearly labelled.

Files: allow-list of types (PDF, TXT, Markdown, PNG, JPEG, WebP), verify by magic bytes not extension or client MIME, size limits, filename sanitization, serve via an authorized route with `Content-Disposition` and `X-Content-Type-Options: nosniff`, never from a user-controlled path. PDFs render via download or a sandboxed viewer; never inline untrusted HTML.

### 10.7 Decisions
Reference, issuing body, date, type, summary, full text (structured content), related documents, status (draft → adopted → published → amended/revoked), and public change history. Publishing a decision requires the publishing authority role for that issuing body plus a second approver.

### 10.8 Publications (dispatches, notices, events)
Structured content blocks (paragraph, heading, quote, image with credit, document link, list, table). No raw HTML. If Markdown is accepted, render with a sanitizer (rehype-sanitize) and an allow-list. Preview, review, approval, scheduled publish (via the job runner), unpublish, archive, versions.

### 10.9 Public finance
Separate sections for **Aletheia Monetary Authority (proposed)** and **Treasury and public finance (proposed)**, reflecting their intended separation. Record types: budgets, receipts, expenditure, procurement notices, contracts, funding commitments, audited statements, reports. Each record requires a currency, amount stored as an integer in minor units, period, status, source document, approver. Totals are computed from records with documented rules, displayed with their basis ("Sum of 3 published expenditure records, period Q3 2026"). No euro peg, reserve, payment rail, or banking partnership is described as operational without an evidence-linked operational status. Empty states explain what will be published and when the first report is expected only if a date has actually been decided.

### 10.10 Audit
Append-only `audit_events` written by services (never by clients): id, actor, action, resource type/id, timestamp, outcome, correlation ID, minimal before/after diff for non-confidential fields, reason where required. Never log secrets, tokens, or confidential field values. Optional hash-chaining of audit events (each event stores the hash of the previous one) to make tampering detectable; describe it as tamper-evident only if implemented and tested — never as immutable. StableChain anchoring is a documented future extension, not a dependency.

### 10.11 Notifications
In-app notifications generated from real events; email delivery through a server-side `Mailer` adapter (SMTP or a provider API) with templates in plain, accessible HTML and text. When mail is unconfigured, the adapter returns `NotConfigured` and the UI says so. Do not call any messaging feature "secure" or "end-to-end encrypted" unless it is.

---

## 11. AUTHENTICATION

- Email + password (Argon2id, tuned parameters documented) and/or passkeys (WebAuthn) via the chosen library. Passkeys are strongly recommended for workbench users.
- **TOTP or passkey MFA is mandatory for every workbench role.** Applicants may opt in.
- Email verification required before submitting an application.
- Password reset via single-use, hashed, 30-minute tokens.
- Sessions: `HttpOnly`, `Secure`, `SameSite=Lax` (Strict for workbench actions where feasible), rotated on sign-in and privilege change, idle timeout (workbench: 30 minutes; applicant: 7 days), absolute timeout, and "sign out everywhere".
- Generic error messages; uniform response timing on sign-in and recovery to resist enumeration.
- Rate limits on sign-in, register, recover, verify (§14).
- **Bootstrap**: the first Platform Administrator is created by a one-time CLI script run on the server (`pnpm admin:bootstrap`), which refuses to run if any administrator exists. No public route can create privileged users. No privileges inferred from email domain or job title.
- Platform administration is separate from institutional authority: a Platform Administrator manages accounts and configuration but cannot approve appointments, decisions, or finance records unless separately granted those institutional roles.

---

## 12. AUTHORIZATION

### 12.1 Model
RBAC plus scoped grants plus explicit policies:

```ts
authorize(actor, "application.review", { applicationId })
// passes only if actor holds Reviewer role
// AND has a grant scoped to the opportunity or institution
// AND has not declared a conflict on this application
```

Roles: Public Visitor, Registered Applicant, Founding Contributor, Project Member, Institution Officer, Application Reviewer, Project Manager, Document Editor, Publishing Officer, Finance Reviewer, Auditor, Institutional Administrator, Platform Administrator.

Policies live in `server/authorization/policies/*.ts` as pure functions with exhaustive unit tests (a matrix test for every role × action × ownership case).

### 12.2 Four-eyes rule
Requires a second, different authorized approver: granting privileged roles, issuing appointments, publishing decisions, publishing or changing finance records, setting status to `operational`, bulk exports of personal data, permanent withdrawal of published records.

### 12.3 Object-level checks
Every route taking an ID loads the resource and authorizes against it. IDs are opaque. Tests confirm that changing an ID in a URL or payload returns 404 (not 403, to avoid confirming existence) for resources the actor cannot see.

---

## 13. WORKBENCH EXPERIENCE

A calm, dense, keyboard-first working environment — closer to a well-made legal or editorial tool than an analytics dashboard.

- Shell: left navigation (collapsible), top bar with search and the user's office, main content with the same margin-column device used publicly for record metadata.
- Areas: My Office, Profile, Mandate, Projects, Tasks, Documents, Applications (reviewers), Meetings & Action Items, Directory, Decisions, Drafts (policy, legislation, specifications), Publications, Finance (scoped), Declarations, Audit (auditors), Notifications, Settings & Security. Only authorized areas render, and every page re-checks on the server.
- **Command palette** (`⌘K` / `Ctrl K`) for navigation and common actions (T3).
- Data tables: server-side pagination, sorting on allow-listed fields, column visibility, accessible markup, sticky headers, empty and error states.
- Every mutation: optimistic concurrency, pending state, confirmed success only after the DB responds, inline error with retry, audit entry.
- No vanity charts. Show what needs attention: assigned reviews, overdue tasks, documents awaiting approval, information requests.

---

## 14. SECURITY (T1)

Map controls to OWASP ASVS Level 2 and record the mapping in `docs/security.md`.

- **Headers**: nonce-based CSP via middleware (no `unsafe-inline` scripts; `style-src` adjusted only as needed for Next.js), HSTS with preload once stable, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`.
- **CSRF**: Server Actions' origin checks plus `SameSite` cookies; explicit CSRF tokens on any non-Server-Action mutating route.
- **Input**: Zod at every boundary; request body size limits; allow-listed sort/filter fields; pagination caps (max 100); no string-built queries.
- **Output**: React escaping; sanitized rich text; no `dangerouslySetInnerHTML` except for sanitizer output, flagged by lint.
- **Redirects**: allow-list same-origin paths only.
- **Rate limits** (shared store): sign-in 5/min/IP+account, recovery 3/hour/account, register 10/hour/IP, application submit 5/hour/account, contact 5/hour/IP, search 60/min/IP. Return `429` with `Retry-After`.
- **Spam**: honeypot fields and time-to-submit checks first; a privacy-respecting challenge (e.g. Cloudflare Turnstile or self-hosted ALTCHA) only if abuse appears, and always with an accessible path.
- **Secrets**: server env or secret manager; startup validation with Zod; CI secret scanning (gitleaks); a build check that fails if any `NEXT_PUBLIC_` variable matches a secret-like name or value.
- **Supply chain**: lockfile committed, `pnpm audit`/OSV scan in CI, Dependabot/Renovate, SBOM generated per release.
- **Caching**: authenticated responses set `Cache-Control: private, no-store`; workbench and account routes are dynamic only.
- **Logging**: never log bodies, tokens, passwords, or confidential fields; redact via Pino redaction paths.
- **Vulnerability disclosure**: `/.well-known/security.txt` with a real contact address (from config; omit the file if none is configured).
- **Pre-launch security test**: run the §19 security test suite plus OWASP ZAP baseline against staging; fix all high/critical findings.

---

## 15. PRIVACY AND DATA GOVERNANCE

- Privacy notice describes what the code actually does: data categories, purposes, retention, processors, encryption, crypto-shredding erasure, rights requests, contact. No claimed certifications or legal compliance without assessment; note that NDPA (Nigeria) and GDPR principles were used as design references if relevant to the operator's location and audience, without asserting compliance.
- Retention schedule per collection in `docs/data-governance.md` (e.g. unsuccessful applications: 12 months after decision, then crypto-shredded; audit events: retained per policy).
- No third-party analytics by default. If enabled, use a cookieless, self-hostable tool (e.g. Plausible or Umami) and disclose it.
- Cookies: only strictly necessary cookies by default, so no consent banner is needed. Adding non-essential cookies requires a consent mechanism.

---

## 16. RENDERING, CACHING, AND PERFORMANCE

- Public pages: static generation with tag-based revalidation. Publishing, revising, or withdrawing a record calls `revalidateTag` for that record and its listings. A withdrawn record must disappear from public pages within one revalidation cycle; test it.
- Only `published` + `public` records are ever passed to public rendering. Public queries go through a dedicated `publicRepository` that hard-codes these filters.
- Workbench and account: dynamic, `no-store`.
- Images via `next/image`; fonts via `next/font`; route-level code splitting; motion libraries only in client islands.
- Budgets (T1, measured on staging with Lighthouse CI, mobile profile):

| Metric | Target |
|---|---|
| Lighthouse Performance (public pages) | ≥ 95 |
| Lighthouse Accessibility / Best Practices / SEO | 100 / ≥ 95 / 100 |
| LCP | ≤ 2.0 s |
| CLS | ≤ 0.05 |
| INP | ≤ 200 ms |
| Public route first-load JS | ≤ 130 KB gzipped |
| Hero image | ≤ 220 KB AVIF at 1728px |

---

## 17. ACCESSIBILITY (T1)

WCAG 2.2 AA. Semantic landmarks, one `h1` per page, logical headings, visible focus (2px Seal Gold on navy, 2px navy on parchment, 2px offset), target size ≥ 24×24px, accessible names on all controls, labelled form fields with linked errors and an error summary, focus moved to the summary on failed submission and to the new page heading on route change, accessible dialogs (native `<dialog>` or a proven primitive such as Radix), tables with headers and captions, status never by colour alone, reduced motion respected, zoom never disabled, content usable at 400% zoom and 320px width. Automated axe checks in e2e plus a manual keyboard pass recorded in `docs/accessibility-review.md`.

---

## 18. SEO, METADATA, AND INTERNATIONALIZATION

- Unique titles and descriptions, canonical URLs, Open Graph and Twitter cards with generated images (`next/og`) in the house style: navy ground, contour field, reference number, title.
- `sitemap.xml` from published records; `robots.txt` disallows `/workbench`, `/account`, `/api`; staging fully `noindex`.
- Structured data: `WebSite`, `BreadcrumbList`, `Article` for dispatches. **Do not use `GovernmentOrganization` or any schema that asserts recognized governmental status.** Use `Organization` with a truthful description.
- i18n-ready: interface strings in message catalogs (e.g. `next-intl`), `lang` metadata on records, locale-aware dates (`Intl.DateTimeFormat`, timezone stated). English only at launch. No machine-translated legal or constitutional text published as authoritative.

---

## 19. TESTING (T1)

| Layer | Tooling | Must cover |
|---|---|---|
| Unit | Vitest | Zod schemas, state machines (every transition), authorization matrix, reference generation, totals calculation, migrations, error mapping, sanitization |
| Contract | Vitest against disposable AletheiaDB | Every DB operation the app relies on; concurrency conflicts; unavailability |
| Integration | Vitest | Services end-to-end with a test DB: submit/review application, publish document, role grant with four-eyes, withdrawal revalidation |
| E2E | Playwright | The 14 journeys from the original brief, plus MFA sign-in, crypto-shred erasure, and conflict-of-interest recusal |
| Security | Playwright + Vitest | IDOR on every ID-bearing route, privilege escalation attempts, CSRF, XSS payloads in every text field, upload of disguised files, cache leakage between users, secret absence from client bundles |
| Accessibility | `@axe-core/playwright` | Every public route and key workbench screens: 0 serious/critical violations |
| Visual | Playwright screenshots | Baselines at 4 widths for all public routes |
| Performance | Lighthouse CI | Budgets in §16 |

Synthetic data only, generated by a seed script that refuses to run when `NODE_ENV=production` or when the DB URL matches the production host. Demo records carry `demo: true` and a visible "Demonstration data" ribbon.

---

## 20. QUALITY GATES AND CI/CD

CI runs on every push and blocks merge on failure:

1. Install with frozen lockfile
2. Typecheck (`tsc --noEmit`)
3. Lint (ESLint incl. import boundaries, `jsx-a11y`) and format check
4. Unit + contract + integration tests
5. Secret scan + dependency vulnerability scan
6. Client-bundle secret check
7. Production build
8. E2E, accessibility, and visual tests against the built app
9. Lighthouse CI against budgets

Deploy pipeline: build once → deploy to staging → smoke tests + health check → manual promotion to production → post-deploy smoke tests → automatic rollback on failed health check. Database bootstrap (`ensureCollection`, `createIndex`) is idempotent and non-destructive, runs as a separate step, and is logged.

---

## 21. OBSERVABILITY AND OPERATIONS

- `/api/health` (liveness: process up) and `/api/health/ready` (readiness: AletheiaDB reachable, config valid, mailer status). Readiness reports degraded when a critical dependency is down. Neither exposes stack traces or internal hostnames.
- Structured logs with correlation IDs propagated to AletheiaDB requests.
- Error tracking adapter; uptime monitoring on public homepage and readiness.
- **Degraded mode**: if AletheiaDB is unavailable, statically rendered public pages continue to serve; dynamic pages show a composed, on-brand "The public record is temporarily unavailable" state; writes fail with a clear message and nothing is lost silently.
- Runbooks in `docs/operations/`: deploy, rollback, restore from backup, rotate secrets, rotate master encryption key, revoke all sessions, respond to a suspected breach, handle a data-erasure request.
- SLO targets for v1: public site availability 99.5% monthly; documented, not marketed.

---

## 22. ENVIRONMENT CONFIGURATION

Validated at startup by a Zod schema in `lib/config/env.ts`; the server refuses to start in production with missing or placeholder values. Document only variables actually used. Likely set:

```
APP_ENV=local|staging|production
APP_BASE_URL=
ALETHEIADB_URL=
ALETHEIADB_API_KEY=
ALETHEIADB_DATABASE=
AUTH_SECRET=
DATA_ENCRYPTION_MASTER_KEY=      # or KMS reference
RATE_LIMIT_STORE_URL=            # Redis/Valkey/KV
MAIL_TRANSPORT=smtp|api|none
MAIL_FROM=
MAIL_SMTP_URL= / MAIL_API_KEY=
ATTACHMENT_STORAGE=embedded|s3
S3_ENDPOINT= S3_BUCKET= S3_ACCESS_KEY= S3_SECRET_KEY=
ERROR_TRACKING_DSN=
LOG_LEVEL=
SECURITY_CONTACT=
```

`.env.example` contains placeholders only. Never commit real values. Never print secrets in logs or reports.

---

## 23. REPOSITORY STRUCTURE

```text
src/
  app/
    (public)/            # editorial site
    (auth)/              # sign-in, register, recover, verify
    account/             # applicant portal
    workbench/           # government workbench
    api/v1/              # thin route handlers
    api/health/
    layout.tsx  not-found.tsx  error.tsx  global-error.tsx
    robots.ts  sitemap.ts
  components/
    brand/  editorial/  navigation/  motion/  forms/  records/  workbench/  ui/
  features/              # per-domain UI + server actions
    institutions/ recruitment/ projects/ documents/ decisions/
    publications/ finance/ directory/ notifications/ audit/
  server/
    aletheiadb/          # the only DB-speaking module
    repositories/
    services/
    authorization/policies/
    auth/  crypto/  mail/  storage/  security/  jobs/  observability/
  lib/
    config/  errors/  dates/  format/  references/
  styles/tokens.css
scripts/                 # admin:bootstrap, db:bootstrap, seed:dev
tests/ unit/ contract/ integration/ e2e/ visual/
docs/
  architecture.md  database-integration.md  data-model.md  data-governance.md
  security.md  accessibility-review.md  operations/  deployment.md
  design/ (tokens, contrast.md, review/)  decisions/ (ADRs)  dependencies.md
PROGRESS.md
```

Do not create empty folders for features that are not being built.

---

## 24. CONTENT AND COPY

Write like a capable public servant: precise, measured, specific. Short sentences. Concrete nouns. Say what exists, what is proposed, and what happens next.

Banned phrases and patterns: "revolutionary", "cutting-edge", "transforming the future", "world-class", "unlock", "empower", "seamless", "the future of nationhood", stacked calls to action, rhetorical questions as headings, exclamation marks.

Every page answers, in its first two paragraphs: what this is, its current status, and where to go next.

Seed content: write real, approved-in-principle copy for structural pages (`/government`, `/founding-programme`, `/development`, `/build-aletheia`, policies). Mark every substantive institutional claim for human review in `docs/content-review.md` before launch. Data-driven sections start empty in production.

---

## 25. PHASES AND DEFINITIONS OF DONE

Work in vertical slices. Commit after each slice with a conventional commit message. Keep `PROGRESS.md` updated (done / in progress / blocked / next) so work can resume after interruption.

| Phase | Done when |
|---|---|
| **1. Audit & foundation** | Audit report written; AletheiaDB contract tests passing; env validation; tokens, fonts, lint, test runners, CI skeleton green |
| **2. Public shell & art direction** | Layout, header, mobile drawer, colophon, homepage chapters with real or empty data, motion system, screenshot review at 4 widths completed and fixes applied |
| **3. Data layer** | Adapter, repositories, envelope encryption, references, migrations, bootstrap script; integration tests passing |
| **4. Auth & authorization** | Sign-in, MFA, verification, recovery, sessions, admin bootstrap, policy matrix tests passing, IDOR suite passing |
| **5. Public records** | Institutions, projects, opportunities, documents, decisions, dispatches, events, finance, directory, search — published-only, revalidation tested |
| **6. Recruitment & applicant portal** | Full application lifecycle e2e passing, including info requests, withdrawal, recusal |
| **7. Workbench** | Office, tasks, projects, documents, publications, decisions, finance, audit views with four-eyes enforced |
| **8. Hardening & release** | All §20 gates green on staging; ZAP baseline clean of high/critical; restore rehearsed; runbooks written; final report delivered |

---

## 26. ACCEPTANCE CRITERIA (RELEASE CANDIDATE)

- Every §1 rule holds, with a test or CI check proving it where automatable.
- All §20 gates pass on staging.
- Every public route renders, with real published data or a designed empty state.
- The homepage matches §7 and passes the §6.8 self-review.
- No confidential field exists in plaintext in the AletheiaDB backing repositories (verified by a script that scans a staging repository clone for test PII markers).
- An applicant cannot see any other applicant's data by any means tested.
- A withdrawn document disappears from all public pages and search.
- AletheiaDB outage produces honest degraded behaviour.
- Docs and runbooks are complete enough for a new engineer to deploy and restore without asking.

---

## 27. FINAL ENGINEERING REPORT

Deliver `docs/release-report.md` containing:

1. Starting repository assessment
2. Architecture as built (with ADR links)
3. Files changed, grouped by feature
4. Public routes — status of each
5. Workbench and applicant workflows — status of each
6. Data model, encryption scope, indexes, bootstrap behaviour
7. Authentication and authorization as implemented
8. Security controls, ASVS mapping, ZAP results, remaining risks
9. Every command run, with actual results
10. Build status
11. Environment variables (names only)
12. Deployment and rollback steps for the actual target
13. Outstanding work and blockers (missing credentials, assets, AletheiaDB gaps)
14. Prioritized next steps (security → functionality → operations)

Classify every item as: **Implemented & tested · Implemented, not fully tested · Partial · Blocked (reason) · Planned**.

Include the final screenshot set of the public site at 1280px and 390px.

---

## 28. THE STANDARD

The public site should make a first-time visitor stop scrolling — because of its composure, not its effects. The workbench should make the people building Aletheia faster and more accountable. The architecture should survive growth without a rewrite. The database stays generic; the application owns its rules; GitLab stays behind the storage abstraction; the browser never holds a secret.

And on every page, the platform tells the truth about where the project stands.

**Build the institutional operating system before the physical state.**
