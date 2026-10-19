> **Note (2026-10-19):** This copy is the brief exactly as received. The message carrying it was truncated at 50,000 characters, partway through §10 (SEO). Everything after "Do not use `BankOrCreditUnion`, `Financial" is missing and has been requested (see `OPEN_QUESTIONS.md` Q13).

---

# ENGINEERING BRIEF: RESERVE BANK OF ALETHEIA (`rbaletheia.org`)

**Audience:** Claude Code, the implementing engineer.
**Mode:** Phased delivery with hard verification gates. Each phase ends with a commit, a short phase report, and passing checks before the next phase begins.
**Prime directive:** Build a visually exceptional, production-grade institutional website in **SvelteKit + TypeScript**. It must never state something about Aletheia's monetary position that is not true.
**Project location:** Build the entire project inside a dedicated folder named **`aletheia-rba/`** (see §0.0).

---

## 0.0 PROJECT ROOT: `aletheia-rba/` (MANDATORY)

All application code, configuration, assets, tests, scripts and documentation for this project live inside a single folder named **`aletheia-rba`**, created at the root of the current working directory.

1. **Check first.** Run `ls -la` in the working directory.
   - If `aletheia-rba/` **does not exist**, create it (`mkdir aletheia-rba`) and scaffold the SvelteKit project **inside it**. Run the scaffold from the parent directory as `npx sv create aletheia-rba` (choose: SvelteKit minimal, TypeScript, ESLint, Prettier, Vitest, Playwright), or scaffold into the existing empty folder. Do not scaffold into the parent directory.
   - If `aletheia-rba/` **already exists**, treat it as the existing project. Audit it in Phase 0 and do not overwrite or delete its contents without asking.
2. **Work only inside it.** Every command (install, dev, build, test, lint) runs with `aletheia-rba/` as the working directory (`cd aletheia-rba` before running commands, or use `--prefix` / `-C` equivalents). Do not create `package.json`, `node_modules`, lockfiles, config files or source files in the parent directory.
3. **Self-contained.** `aletheia-rba/` must be a complete, independently runnable project: its own `package.json`, lockfile, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example`, `README.md` and `docs/`. A developer must be able to copy only this folder elsewhere and run `pnpm install && pnpm verify`.
4. **Git.** If the parent directory is already a Git repository, commit within it with all changes scoped to `aletheia-rba/`. If no repository exists, run `git init` inside `aletheia-rba/`. Never modify files outside the folder.
5. **Path convention in this brief.** Every path in this document (`src/…`, `docs/…`, `scripts/…`, `static/…`, `tests/…`, `.github/…`) is **relative to `aletheia-rba/`**. For example, `docs/DISCOVERY.md` means `aletheia-rba/docs/DISCOVERY.md`.
6. **Copy this brief in.** Save a copy of this brief to `aletheia-rba/docs/ENGINEERING_BRIEF.md` in the first commit, so the specification travels with the code.

---

## 0. HOW TO READ AND EXECUTE THIS BRIEF

### 0.1 Operating rules (non-negotiable)

1. **Inspect before you write.** Phase 0 (Discovery) is mandatory. Do not scaffold, install or delete anything until the discovery report exists.
2. **Never fabricate.** This applies to people, dates, figures, reserves, partners, licences, publications, news, contact details, statistics and claimed inspections. If you could not access a source, say so in the report. Do not describe what it "probably" contains.
3. **Do not invent missing information.** Record it in `docs/OPEN_QUESTIONS.md` and ship an honest, well-designed empty or pending state.
4. **No placeholder filler.** No lorem ipsum, no "Coming soon!!" banners, no fake counters, no `TODO` in user-facing output, no dead links (`href="#"`).
5. **Make design decisions explicitly.** Record any non-obvious architectural or design choice as a short ADR in `docs/adr/NNNN-title.md`, covering context, decision, alternatives and consequences.
6. **Verify, don't assert.** Report only the tests you actually ran, with their real output. If a tool (browser, Lighthouse, network) is unavailable, state that and describe what you did instead.
7. **Commit in small, reviewable steps** using Conventional Commits (`feat(banknotes): …`, `fix(a11y): …`, `chore(deps): …`). Do not combine unrelated changes in one commit.
8. **Stop and ask** before any irreversible or out-of-scope action, including deleting existing files or assets, replacing the framework, adding a paid or third-party service, adding a database, or changing deployment targets.

### 0.2 Phase map

| Phase | Name | Exit gate |
|---|---|---|
| 0 | Discovery & audit | `docs/DISCOVERY.md` written; asset inventory complete; open questions logged |
| 1 | Foundation & tooling | Project builds; `svelte-check`, lint, format and tests run clean in CI config |
| 2 | Design system | Tokens, type scale, grid, motion tokens and primitives done; `/_styleguide` route renders everything (dev only) |
| 3 | Content layer & claims guard | Typed + schema-validated content; forbidden-claims linter passing |
| 4 | Shell & global components | Masthead, nav, mobile nav, footer, SEO component, error pages |
| 5 | Pages | All routes in §8 implemented with real content |
| 6 | Signature experiences | Homepage hero, banknote gallery and dialog, motion choreography |
| 7 | SEO, security, performance | Sitemap, robots, JSON-LD, CSP/headers, image pipeline, budgets met |
| 8 | QA & hardening | Full test matrix in §15 executed; defects fixed |
| 9 | Delivery | README, VERIFICATION.md, deployment docs, final report |

Do not start Phase N+1 while Phase N's gate is red.

---

## 1. PROJECT CONTEXT

- **Institution:** Reserve Bank of Aletheia (RBA), the *proposed* central banking institution of the Sovereign Covenant State of Aletheia, which is pursuing the establishment of a maritime nation.
- **Currency:** Aletheian Guilder, code **AEY** (proposed national currency).
- **Intended domain:** `https://rbaletheia.org`
- **Design references (study, don't clone):**
  - Primary: https://www.stateofaletheia.org
  - Secondary: https://www.aletheiagov.org
  - Banknotes: https://www.stateofaletheia.org/aey/paper-currency
- **Character:** A national monetary institution. It is **not** a fintech, crypto project, exchange, SaaS product or startup. Aletheia must never be described as a startup, commercial venture or technology company.
- **Scope:** A public institutional and currency-information website only. **Out of scope:** wallets, custody, exchange, redemption, account login, payments, KYC, admin dashboards, or any collection of financial or identity data.

---

## 2. INSTITUTIONAL TRUTH MODEL (THE MOST IMPORTANT SECTION)

The website's credibility depends on separating four states. This is modelled in code, not just in prose.

### 2.1 Status vocabulary (single source of truth)

```ts
// src/lib/content/status.ts
export const STATUS = {
  proposed:          { label: 'Proposed',          description: 'Intended but not formally adopted.' },
  adopted:           { label: 'Adopted',           description: 'Formally decided; not yet implemented.' },
  in_implementation: { label: 'In implementation', description: 'Adopted and actively being built.' },
  operational:       { label: 'Operational',       description: 'Implemented and functioning.' },
  not_established:   { label: 'Not yet established', description: 'No arrangement exists at present.' },
} as const;
export type StatusKey = keyof typeof STATUS;
```

Every content entity that describes a capability, policy, arrangement or currency form **must** carry a `status: StatusKey` field and a `statusAsOf: string` (ISO date). The UI renders status with a **text label plus an icon or shape**, never colour alone (WCAG 1.4.1). Laurel Green must **not** be used to signal "healthy" on any reserve or financial item.

### 2.2 Known facts (encode exactly; do not embellish)

| Subject | Truth to encode | Status |
|---|---|---|
| AEY | Proposed national currency | `proposed` |
| Monetary model | Preferred direction is a **fiat** currency | `proposed` (unless Phase 0 finds a formal adoption document) |
| Physical banknotes | Immediate design priority; denominations 1, 5, 10, 20, 100 AEY; **designs**, not issued notes | `proposed` (designs exist; issuance `not_established`) |
| StableChain | Part of the wider digital monetary infrastructure | Determine from sources in Phase 0; default `proposed` |
| Euro reserves | **Aletheia currently holds no euro reserves** | `not_established` |
| Foreign reserves (any) | None held by the Bank | `not_established` |
| Euro convertibility / redemption | Not offered; no fixed rate | `not_established` |
| Correspondent banking, licences, audits | None | `not_established` |
| Governance, leadership, founding date | Unknown unless found in sources | Do not populate |

### 2.3 Forbidden claims (enforced by a linter in CI)

Implement `scripts/claims-lint.ts`. It scans `src/**/*.{svelte,ts,md}` and the built HTML in `build/` or `.svelte-kit/output/`, and **fails the build** on any of the patterns below. False positives may be allow-listed only per line, with a justification comment: `// claims-lint-allow: <reason>`.

```
/100\s*%\s*(euro[- ]?)?back/i
/fully\s+backed/i
/(€|EUR)\s*1(\.00)?\s*(=|per|to)\s*1?\s*AEY/i
/1\s*AEY\s*(=|equals)\s*(€|EUR)/i
/guaranteed\s+(redemption|convertib|exchange)/i
/redeemable\s+(for|in)\s+euro/i
/(holds|reserves of)\s+[\d.,]+\s*(million|billion|bn|m)\b/i
/legal\s+tender/i            # allowed only in negated/explanatory FAQ lines with allow comment
/licensed|regulated\s+by|authori[sz]ed\s+by/i
/recogni[sz]ed\s+(central\s+bank|by\s+the)/i
/in\s+circulation/i          # allowed only when negated, with allow comment
/revolutionis|unlock(ing)?\s+limitless|redefin(e|ing)\s+finance|to\s+the\s+moon|web3/i
```

Add a unit test proving the linter catches each pattern and respects allow comments.

### 2.4 Copy rules

- Prefer phrasing such as "The Bank intends to…", "is proposed to…", "has not yet been established", "will be published when…".
- Never invent policy targets, inflation targets, policy rates, issuance ceilings, monetary aggregates, exchange rates or supply figures.
- Where a policy is undecided, explain the **process** by which it will be decided (consultation, publication, adoption, review). Do not describe the outcome.
- Fiat does not need euro backing. Credibility comes from issuance rules, governance, transparency and an honest statement of current status. The copy should explain this calmly.

---

## 3. PHASE 0: DISCOVERY & AUDIT

### 3.1 Repository audit

First apply §0.0: confirm or create `aletheia-rba/`, then run everything below **from inside `aletheia-rba/`**. Also list the parent directory (read-only) to note any existing assets or sibling projects worth reusing; never modify them. Record the output summary (not raw dumps) in `docs/DISCOVERY.md`:

```bash
ls -la ..                     # parent dir, read-only context
cd aletheia-rba
git status && git log --oneline -n 20
ls -la && cat package.json
cat svelte.config.* vite.config.* tsconfig.json 2>/dev/null
ls -R src static 2>/dev/null | head -200
npx sv --version 2>/dev/null; npm ls svelte @sveltejs/kit vite typescript 2>/dev/null
find . -name "*.svg" -o -name "*.png" -o -name "*.webp" -o -name "*.avif" -o -name "*.woff2" | grep -v node_modules
ls .github/workflows vercel.json netlify.toml wrangler.toml Dockerfile 2>/dev/null
```

Determine and record:

- Whether this is a greenfield or an existing project, and the installed versions of Svelte, Kit, Vite and TS.
- Package manager (from the lockfile). **Use the existing one.** If none exists, use `pnpm`.
- Existing deployment target and adapter.
- Existing styling approach (vanilla CSS, Tailwind, etc.). Keep it unless an ADR justifies a change.
- Existing Manrope implementation, emblem, logo and banknote assets.

### 3.2 Reference site study

Fetch the three reference URLs. For each, record in `DISCOVERY.md`:

- Accessibility: reachable / unreachable (with error). **If unreachable, write that. Do not describe its contents from assumption.**
- Typography: weights used, tracking, case conventions, heading scale.
- Palette in practice: which colours dominate which surfaces.
- Navigation pattern, header behaviour on scroll, footer structure.
- Motion vocabulary: what animates, durations, easing character.
- Image treatment: photography vs illustration, overlays, cropping.
- Spacing rhythm and grid.
- Verbatim factual statements about AEY, StableChain, the Reserve Bank, governance and status, each with its URL. These become the **only** factual source material besides this brief.

### 3.3 Asset inventory & provenance

Create `docs/ASSETS.md` with one row per asset:

| Asset | Source URL / repo path | Format | Intrinsic dimensions | Licence / authorisation | Used where |
|---|---|---|---|---|---|

- **Banknotes:** Locate front **and** back artwork for each denomination on the paper-currency page. Download the highest-resolution originals available into `src/lib/assets/banknotes/<denom>-<front|back>.<ext>`. Record intrinsic pixel dimensions; the gallery's aspect ratio is derived from these and never hard-coded or guessed. If a back side does not exist, record it and design the gallery to handle front-only.
- **Emblem / logo:** Use genuine files only. Prefer SVG. If only raster exists, use it at native quality and log in `OPEN_QUESTIONS.md` that a vector master is needed. **Never draw a substitute emblem.**
- **Photography:** None may be used unless properly licensed (e.g. Unsplash/Pexels licence, or owner-supplied). Record the licence. Do not use photographs of identifiable people in suits.

### 3.4 Open questions file

Seed `docs/OPEN_QUESTIONS.md` with at least the following, and answer any you can resolve from sources:

- Hosting / deployment target for `rbaletheia.org`?
- Official contact email/address for the RBA? (None will be invented.)
- Is the fiat direction formally adopted, or still proposed?
- Official status and relationship of StableChain to AEY?
- Are there any real publications, notices or policy documents to launch with?
- Is a vector emblem and banknote master artwork available?
- Contact form: wanted? Which delivery provider?
- Analytics: wanted? (Default: none. If wanted, privacy-respecting and cookieless.)

**Gate 0:** `DISCOVERY.md`, `ASSETS.md` and `OPEN_QUESTIONS.md` committed. Post a phase report summarising findings and any blocking unknowns. Proceed with honest defaults for non-blocking unknowns.

---

## 4. PHASE 1: FOUNDATION & TOOLING

### 4.1 Stack (defaults; existing project choices take precedence unless an ADR says otherwise)

| Concern | Choice | Notes |
|---|---|---|
| Framework | SvelteKit 2.x, **Svelte 5 with runes** (`$state`, `$derived`, `$props`, `$effect`, snippets) | No legacy `export let`, `$:` or `createEventDispatcher` in new code |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` | |
| Build | Vite (bundled with Kit) | |
| Adapter | `@sveltejs/adapter-static` if every route prerenders (expected). Otherwise the adapter matching the hosting target (ADR required) | |
| Styling | Vanilla CSS: global tokens in `src/lib/styles/`, component styles scoped in `.svelte` | No Tailwind unless already present. No CSS-in-JS |
| Fonts | `@fontsource-variable/manrope`, self-hosted woff2, subset Latin + Latin-ext | Self-hosting avoids a Google Fonts CSP/privacy dependency |
| Images | `@sveltejs/enhanced-img` (AVIF/WebP, responsive `srcset`, intrinsic dims) | |
| Content | Typed TS modules + Markdown via `mdsvex` for long-form pages and publications, all validated by **Zod** at build time | |
| Motion | CSS transitions/animations, `svelte/transition`, `svelte/motion`, View Transitions API via `onNavigate` | Add an animation library only with an ADR showing a capability CSS cannot provide |
| Lint/format | ESLint (flat config, `eslint-plugin-svelte`, `typescript-eslint`), Prettier + `prettier-plugin-svelte` | |
| Type check | `svelte-check --fail-on-warnings` | |
| Unit tests | Vitest | |
| E2E / a11y / visual | Playwright + `@axe-core/playwright` | |
| Perf | Lighthouse CI (`@lhci/cli`) | |
| Link check | `linkinator` (or equivalent) against the built site | |

### 4.2 Scripts (`package.json`)

```jsonc
{
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
  "lint": "eslint . && prettier --check .",
  "format": "prettier --write .",
  "test:unit": "vitest run",
  "test:e2e": "playwright test",
  "lint:claims": "tsx scripts/claims-lint.ts",
  "lint:links": "linkinator ./build --recurse --silent",
  "lhci": "lhci autorun",
  "verify": "pnpm check && pnpm lint && pnpm lint:claims && pnpm test:unit && pnpm build && pnpm lint:links && pnpm test:e2e"
}
```

### 4.3 Directory structure

Everything below lives inside the project root folder `aletheia-rba/`:

```
aletheia-rba/
package.json  pnpm-lock.yaml  svelte.config.js  vite.config.ts  tsconfig.json
playwright.config.ts  vitest.config.ts  eslint.config.js  .prettierrc  lighthouserc.cjs
.gitignore  .env.example  README.md
static/                     # favicon, robots fallback, og images, fonts if not bundled
src/
  app.html                  # lang="en-GB", theme-color, no-JS class hook
  app.d.ts
  hooks.server.ts           # security headers
  lib/
    assets/
      banknotes/            # original artwork (enhanced-img source)
      brand/                # emblem, logo (genuine only)
      imagery/              # licensed photography
    components/
      layout/               # Masthead, Nav, MobileNav, Footer, Breadcrumbs, SkipLink
      primitives/           # Container, Grid, Stack, Heading, Text, Rule, Link, Button, Icon
      editorial/            # SectionHeader, Eyebrow, PullStatement, Figure, Prose
      institutional/        # StatusBadge, StatusLedger, DisclosureNotice, EmptyState
      currency/             # BanknoteCard, BanknoteGallery, BanknoteDialog, DenominationStrip
      publications/         # PublicationEntry, PublicationFilters, ArticleMeta
      seo/                  # Seo.svelte, JsonLd.svelte
      motion/               # Reveal (action), LineDraw, Guilloche
    content/
      schema.ts             # Zod schemas + inferred types
      status.ts
      site.ts               # name, URL, nav, footer, social, contact (nullable)
      banknotes.ts
      faq.ts
      status-ledger.ts
      publications/*.md     # frontmatter-validated (may be empty at launch)
      news/*.md
      pages/*.md            # long-form copy for about, policy, reserves, etc.
    seo/
      meta.ts               # buildMeta(), canonical()
      jsonld.ts             # typed builders
    styles/
      tokens.css  reset.css  typography.css  layout.css  motion.css  print.css
    actions/
      reveal.ts  inert-outside.ts
    utils/
  routes/
    +layout.svelte  +layout.ts (prerender = true, trailingSlash = 'never')
    +page.svelte                     # /
    about/  monetary-policy/  currency/  banknotes/  issuance/  reserves/
    publications/  publications/[slug]/
    news/  news/[slug]/
    faq/  contact/  privacy/  terms/  accessibility/
    sitemap.xml/+server.ts  robots.txt/+server.ts
    _styleguide/                     # dev-only; excluded from build output and sitemap
    +error.svelte
scripts/
  claims-lint.ts  check-overflow.ts  og-images.ts (optional)
tests/
  e2e/  unit/
docs/
  DISCOVERY.md  ASSETS.md  OPEN_QUESTIONS.md  VERIFICATION.md  CONTENT_GUIDE.md  DEPLOYMENT.md  adr/
.github/workflows/ci.yml
```

### 4.4 CI (`.github/workflows/ci.yml`)

If `aletheia-rba/` sits inside a larger repository, place the workflow at the repository root's `.github/workflows/rba-ci.yml`, with `defaults.run.working-directory: aletheia-rba` and a `paths: ['aletheia-rba/**']` filter. This is the **only** permitted file outside the folder, and you must ask before creating it. If `aletheia-rba/` is its own repository, use `aletheia-rba/.github/workflows/ci.yml`.

On PR and push to `main`: install with a frozen lockfile, then run `check`, `lint`, `lint:claims`, `test:unit`, `build`, `lint:links`, `test:e2e` (Chromium + WebKit, desktop + mobile projects), and `lhci` with assertions (§13). Cache the package store and Playwright browsers. Run `npm audit --audit-level=high` (or the pnpm equivalent) as a non-blocking report step plus a blocking `critical` step.

**Gate 1:** `aletheia-rba/` exists as a self-contained project, nothing was written to the parent directory, and a fresh clone runs `cd aletheia-rba && pnpm install && pnpm verify` green with the skeleton (a placeholder index is acceptable at this phase only).

---

## 5. PHASE 2: DESIGN SYSTEM

### 5.1 Creative direction

**World-class institutional editorial.** Think finely engraved banknotes, European civic architecture, a serious financial newspaper's typographic discipline, and a national identity manual. The site should be recognisably Aletheian and distinctly a central bank.

**Design signatures to develop (bespoke, not stock):**

1. **Guilloché linework.** Procedurally generated SVG rosettes and wave lattices (parametric hypotrochoids / Lissajous curves) in hairline Seal Gold or tonal navy, echoing banknote security printing. Generate them in code (`Guilloche.svelte` with seedable params) so each section can have a unique but related pattern. Animate via `stroke-dashoffset` line-drawing on first reveal only.
2. **Ledger rules.** Hairline horizontal rules and fine column dividers borrowed from ledgers and printed reports. These structure content instead of card boxes.
3. **Folio metadata.** Small-caps-style metadata (section numbers such as `§ 02`, dates, document codes) set in Manrope with tracking, like a printed report.
4. **Parchment and navy as material.** Alternate surfaces deliberately to create rhythm. Parchment for reading and editorial content; navy for institutional and ceremonial moments. Add an optional, very subtle paper grain via an inline SVG `feTurbulence` filter at low opacity, disabled on low-power and reduced-motion settings.
5. **Banknote as hero object.** Real banknote artwork, art-directed with a soft shadow, a slight perspective and a light sheen sweep on reveal. Never floating coins or glowing networks.

**Banned patterns:** SaaS hero followed by a three-card grid, testimonials, glassmorphism, gradient blobs, floating circles, fake terminals and code snippets, crypto imagery, emoji as icons, pill buttons everywhere, gold outlines on everything, rounded cards as the default container, custom cursors, scroll hijacking, and identical layouts across pages.

**Composition rule:** Each page gets **one** signature composition (e.g. the asymmetric hero, the banknote stage, the status ledger, the reserves "what must exist first" sequence). Everything else is quiet, precise typography on a grid.

### 5.2 Colour tokens (`tokens.css`)

```css
:root {
  /* National palette */
  --c-navy: #15294A;        /* Covenant Navy */
  --c-parchment: #F4EEDF;   /* Ledger Parchment */
  --c-gold: #C49A4E;        /* Seal Gold */
  --c-laurel: #2F6B4F;      /* Laurel Green */

  /* Derived (tune in Phase 2; verify contrast) */
  --c-navy-900: #0D1A30;  --c-navy-700: #1E3760;  --c-navy-500: #3A5482;
  --c-parchment-50: #FBF8F1; --c-parchment-200: #E9E1CC; --c-parchment-400: #CFC4A8;
  --c-ink: #131A26;         /* body text on parchment */
  --c-ink-muted: #4A5262;   /* secondary text; must pass 4.5:1 on parchment */
  --c-gold-ink: #8A6A2E;    /* gold usable as TEXT on parchment; verify ≥4.5:1 */

  /* Semantic */
  --surface-page: var(--c-parchment);
  --surface-raised: var(--c-parchment-50);
  --surface-inverse: var(--c-navy);
  --text-primary: var(--c-ink);
  --text-inverse: var(--c-parchment);
  --rule: color-mix(in oklab, var(--c-navy) 18%, transparent);
  --rule-inverse: color-mix(in oklab, var(--c-parchment) 22%, transparent);
  --accent: var(--c-gold);
  --focus-ring: var(--c-gold);
}
```

**Pre-computed contrast (verify with a tool and record in `VERIFICATION.md`):**

| Pair | Approx. ratio | Rule |
|---|---|---|
| Navy on Parchment | ~12.5:1 | ✅ All text |
| Parchment on Navy | ~12.5:1 | ✅ All text |
| Gold on Navy | ~5.6:1 | ✅ Text allowed (small accents, labels) |
| **Gold on Parchment** | **~2.2:1** | ❌ **Never for text or essential UI.** Decorative rules and ornament only. Use `--c-gold-ink` for gold-toned text on parchment |
| Laurel on Parchment | ~5.4:1 | ✅ Text allowed (sparingly) |

Focus rings: a 2px solid ring with a 2px offset. On parchment surfaces the ring must meet 3:1 against adjacent colours (WCAG 2.4.11/1.4.11), so use navy rings on parchment and gold rings on navy, switched via a surface-scoped custom property.

### 5.3 Typography

- **Manrope only** (variable, weights 200–800). No second display face.
- Enable `font-variant-numeric: tabular-nums lining-nums` on all figures, tables, dates and denomination labels.
- Use `text-wrap: balance` on headings and `text-wrap: pretty` on body text.
- Preload the single variable woff2 in `app.html`; `font-display: swap`; define a metric-matched fallback (`size-adjust`, `ascent-override`) to eliminate font-swap CLS.

Fluid scale (refine visually; record final values in the styleguide):

```css
--fs-display: clamp(2.75rem, 1.6rem + 5.2vw, 6.5rem);   /* homepage hero */
--fs-h1:      clamp(2.25rem, 1.6rem + 3vw, 4.25rem);
--fs-h2:      clamp(1.75rem, 1.35rem + 1.8vw, 2.75rem);
--fs-h3:      clamp(1.3rem, 1.15rem + 0.7vw, 1.7rem);
--fs-lead:    clamp(1.15rem, 1.05rem + 0.45vw, 1.4rem);
--fs-body:    clamp(1rem, 0.97rem + 0.15vw, 1.0625rem);
--fs-meta:    0.8125rem;   /* uppercase, letter-spacing .08em, weight 600 */
--fs-fine:    0.75rem;     /* footnotes, legal */
--lh-tight: 1.04; --lh-heading: 1.15; --lh-body: 1.6;
--measure: 66ch;
```

Display headings use weight 300–400 with slight negative tracking (`-0.02em` to `-0.035em`) for an elegant editorial feel. Headings over large type sizes get deliberate manual line breaks via `<br class="bp-md">` utilities so they never orphan awkwardly on mobile.

### 5.4 Space, grid and layout

- Spacing scale (rem): `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12`, exposed as `--space-1…--space-11`, with fluid section padding `clamp(4rem, 3rem + 6vw, 10rem)`.
- **12-column grid**, `max-width: 1440px`, fluid gutters `clamp(1rem, 0.5rem + 2vw, 2.5rem)`. Editorial layouts use asymmetric spans (e.g. 5/7, 4/1/7 with an empty column for air).
- Radii: `0` by default, `2px` for small controls. Avoid rounded "cards" as a pattern.
- Breakpoints (container-first where possible, using `@container`): `sm 480`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1600`.

### 5.5 Motion tokens

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-in-out-quint: cubic-bezier(0.83, 0, 0.17, 1);
--ease-ceremonial: cubic-bezier(0.65, 0, 0.35, 1);
--dur-1: 120ms;  /* hover, press */
--dur-2: 240ms;  /* small UI */
--dur-3: 480ms;  /* reveals */
--dur-4: 900ms;  /* headline / masked image reveals */
--dur-5: 1600ms; /* line-draw ornament */
--stagger: 60ms;
```

`@media (prefers-reduced-motion: reduce)` sets all durations to `0.01ms`, disables parallax, line-draw and sheen, and makes reveals instant.

### 5.6 Primitives

Build `Container`, `Grid`, `Stack`, `Heading` (renders the correct `h1`–`h6` independent of visual size via `level` and `size` props), `Text`, `Rule`, `Link` (internal/external awareness; external links get `rel="noopener"` and an accessible "opens in new tab" label when `target=_blank`), `Button` (a real `<button>`; `ButtonLink` for anchors), `Icon` (inline SVG sprite, `aria-hidden` unless labelled), `Eyebrow`, `Figure`.

### 5.7 Styleguide route

`/_styleguide` (dev only; guarded by `import { dev } from '$app/environment'` with a 404 in production, and excluded from prerender and sitemap) renders tokens, the type scale, colour pairs with live contrast ratios, primitives, status badges, empty states and motion samples.

**Gate 2:** Styleguide renders at 375 / 768 / 1280 / 1600 widths with no overflow; axe passes on the styleguide; contrast table verified.

---

## 6. PHASE 3: CONTENT LAYER & CLAIMS GUARD

### 6.1 Schemas (`src/lib/content/schema.ts`, Zod)

```ts
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Status = z.enum(['proposed','adopted','in_implementation','operational','not_established']);

export const Banknote = z.object({
  denomination: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(20), z.literal(100)]),
  code: z.literal('AEY'),
  front: z.object({ src: z.string(), alt: z.string().min(20) }),
  back:  z.object({ src: z.string(), alt: z.string().min(20) }).nullable(),
  dominantColour: z.string().nullable(),          // only if observable in artwork
  designNotes: z.array(z.string()),               // observed design elements only
  securityFeatures: z.array(z.object({
    name: z.string(),
    description: z.string(),
    implementation: z.enum(['concept_only','specified','physically_implemented']),
  })),
  status: Status,                                  // expected: 'proposed'
  issuanceStatus: Status,                          // expected: 'not_established'
  statusAsOf: IsoDate,
});

export const Publication = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  category: z.enum(['monetary-policy-statement','annual-report','currency-notice',
    'statistical-release','institutional-policy','research-paper','consultation']),
  publishedAt: IsoDate,
  updatedAt: IsoDate.optional(),
  summary: z.string().max(320),
  documentUrl: z.string().url().optional(),       // PDF
  documentSizeBytes: z.number().int().positive().optional(),
  hasHtmlVersion: z.boolean(),
  status: z.enum(['draft','published','superseded','withdrawn']),
});

export const NewsArticle = z.object({
  slug: z.string(), title: z.string(), publishedAt: IsoDate, updatedAt: IsoDate.optional(),
  summary: z.string().max(300), category: z.enum(['notice','announcement','statement']),
  ogImage: z.string().optional(), draft: z.boolean().default(false),
});

export const StatusItem = z.object({
  id: z.string(), area: z.string(), capability: z.string(),
  status: Status, statusAsOf: IsoDate, explanation: z.string(),
  link: z.string().optional(),
});

export const Faq = z.object({ id: z.string(), question: z.string(), answerMd: z.string(), relatedLinks: z.array(z.string()).default([]) });

export const Contact = z.object({
  email: z.string().email().nullable(),
  postal: z.string().nullable(),
  enquiryNote: z.string(),
}); // nulls render a designed "official channels being established" state
```

All content loads through `src/lib/content/index.ts`, which parses with Zod at module load. **An invalid entry fails the build.** Drafts (`draft: true` / `status: 'draft'`) are excluded from production builds, listings, the sitemap and feeds.

### 6.2 Launch content policy

- **Publications and news:** Ship with only real items found in Phase 0. Zero is acceptable. The empty state is a designed component that explains what will be published there and how it will be announced.
- **Status ledger seed** (verify each against sources; adjust only with evidence):
  - Aletheian Guilder: proposed currency → `proposed`
  - Fiat monetary framework → `proposed`
  - Banknote designs (1–100 AEY) → `proposed`
  - Banknote issuance and circulation → `not_established`
  - Issuance governance rules → `proposed` / under development
  - Foreign and euro reserves → `not_established`
  - Euro conversion / redemption → `not_established`
  - Correspondent banking relationships → `not_established`
  - Independent audit of issuance → `not_established`
  - StableChain digital infrastructure → per Phase 0 findings
  - Public website → `operational`
- **Unit test:** Assert that reserve, convertibility and issuance items are never `operational` unless an explicit `evidenceUrl` field is present (add that field if needed). This is a guardrail against accidental edits.

### 6.3 Content guide

Write `docs/CONTENT_GUIDE.md` covering how to add a publication, a news notice, change a status item, edit a banknote description or update FAQ entries. Each should be a single-file edit, with example frontmatter and the copy rules from §2.4.

**Gate 3:** The content suite parses; claims-lint passes with tests; content unit tests pass.

---

## 7. PHASE 4: SHELL & GLOBAL COMPONENTS

### 7.1 Masthead & navigation

- Genuine emblem plus the wordmark "Reserve Bank of Aletheia", with a small "Aletheian Guilder · AEY" entry and a "Publications" entry.
- **Primary nav:** About · Monetary Policy · The Guilder (→ Currency, Banknotes, Issuance) · Reserves · Publications · News.
- **Utility:** FAQ · Contact · "State of Aletheia ↗".
- Desktop: a disclosure-pattern submenu (button with `aria-expanded`, not an ARIA `menu` role). It must work with keyboard, `Esc` to close and click-outside.
- Header behaviour: transparent over the navy hero, becoming a solid parchment surface with a hairline rule after scroll. Implement via an IntersectionObserver sentinel, not scroll listeners.
- `aria-current="page"` on the active link. A **skip link** to `#main` is the first focusable element.

### 7.2 Mobile navigation

- Full-height navy sheet with a staged entrance: the sheet clip-path reveal, then links staggered at `--stagger`, then the guilloché ornament drawing in.
- **A11y:** Use a native `<dialog>` with `showModal()` (gives a focus trap, `Esc` handling and inert background), restore focus to the trigger on close, lock body scroll without layout shift (`scrollbar-gutter: stable`), and close on route change (`afterNavigate`).
- Touch targets ≥ 44×44px. The navigation must function fully with JS disabled; provide a `<noscript>`-safe fallback that uses an anchor to the footer nav.

### 7.3 Footer

A navy surface laid out as a structured ledger: institutional nav columns, currency links, publications and policies, legal (Privacy, Terms, Accessibility), and a "State of Aletheia" link. Include a short standing **status statement**, e.g. "The Reserve Bank of Aletheia is a proposed institution. The Aletheian Guilder has not been issued. [Read the current status →]". Contact details appear only if real. Show the copyright line with the current year computed at build.

### 7.4 SEO component

`Seo.svelte` takes `{ title, description, path, ogImage?, type?: 'website'|'article', publishedAt?, modifiedAt?, noindex?, jsonLd?: object[] }` and emits the title, meta description, canonical (`PUBLIC_SITE_URL + path`, no trailing slash), OG/Twitter tags, `robots`, and JSON-LD via `JsonLd.svelte`. Serialise JSON-LD with `<` escaped as `<` to prevent script breakout. Every route must call it; an e2e test asserts unique titles and descriptions across all routes.

### 7.5 Error pages

`+error.svelte` provides a designed 404 (with search-free navigation suggestions and a link home) and a generic 5xx state with no stack traces. Prerendered 404 output: configure `adapter-static`'s `fallback`/`404.html` according to the host.

### 7.6 Breadcrumbs

Breadcrumbs appear on every non-home page. Mark them up as `nav[aria-label="Breadcrumb"] > ol`, with `aria-current="page"` on the last item, and emit matching `BreadcrumbList` JSON-LD.

**Gate 4:** Shell passes keyboard-only walkthrough and axe; mobile nav e2e tests pass (open, focus trap, Esc, route change closes, focus restored).

---

## 8. PHASE 5: ROUTES & PAGE SPECIFICATIONS

All routes are `prerender = true`. Each has a unique title and description, a canonical URL, breadcrumbs (non-home), a signature composition and internal links to related pages.

| Route | Title (refine) | JSON-LD | Signature composition |
|---|---|---|---|
| `/` | Reserve Bank of Aletheia: Monetary Institution of the Aletheian Guilder | `Organization`, `WebSite` | Asymmetric hero with banknote stage and guilloché |
| `/about` | About the Bank · Reserve Bank of Aletheia | `BreadcrumbList` | Founding-principles "articles" set as numbered folios |
| `/monetary-policy` | Monetary Policy Framework · Reserve Bank of Aletheia | `BreadcrumbList` | Policy-development process as a ruled timeline (stages, not dates) |
| `/currency` | The Aletheian Guilder (AEY) · Currency | `BreadcrumbList`, `FAQPage` (subset) | Currency "specimen sheet": name, code, forms, status in a ledger table |
| `/banknotes` | Banknote Designs · Aletheian Guilder | `BreadcrumbList`, `ImageObject`s | Denomination stage + accessible gallery dialog |
| `/issuance` | Issuance Framework · Reserve Bank of Aletheia | `BreadcrumbList` | Issuance lifecycle diagram (authorise → record → publish → audit → withdraw) with per-step status |
| `/reserves` | Foreign Reserves and Exchange Policy · Reserve Bank of Aletheia | `BreadcrumbList` | "Preconditions for convertibility" sequence |
| `/publications` | Publications · Reserve Bank of Aletheia | `BreadcrumbList`, `CollectionPage` | Editorial archive with filters (or a designed empty state) |
| `/publications/[slug]` | {title} · Publications | `Article`/`Report`, `BreadcrumbList` | Accessible HTML report layout + PDF download |
| `/news` | News and Notices · Reserve Bank of Aletheia | `BreadcrumbList` | Dated register layout |
| `/news/[slug]` | {title} · Reserve Bank of Aletheia | `NewsArticle`, `BreadcrumbList` | Long-form article |
| `/faq` | Frequently Asked Questions · Aletheian Guilder | `FAQPage`, `BreadcrumbList` | Grouped `<details>` disclosures |
| `/contact` | Contact · Reserve Bank of Aletheia | `BreadcrumbList` | Real channels only, otherwise a designed pending state |
| `/privacy`, `/terms`, `/accessibility` | {Page} · Reserve Bank of Aletheia | `BreadcrumbList` | Clean legal prose layout |

### 8.1 Homepage `/`

Section rhythm, alternating surfaces (avoid a stack of cards):

1. **Hero (navy).** A 7/5 asymmetric split. Left: eyebrow "Reserve Bank of Aletheia", a display headline with a deliberate break (e.g. *"Stewardship of the Aletheian Guilder."*; refine copy, no hype), a two-sentence mandate summary using "proposed" language, a primary link "The Aletheian Guilder →" and a secondary link "Current status". Right: the **banknote stage**, with the 100 AEY front (or most representative note) at a slight 3D tilt (`perspective` + `rotateX/Y` ≤ 6°), a gentle pointer-follow tilt on fine pointers only (`@media (hover:hover) and (pointer:fine)`), a one-time sheen sweep, and a gold guilloché rosette drawing in behind it. On mobile, recompose: headline first, then the note full-bleed beneath at 0° tilt with no pointer effects.
2. **The Guilder (parchment).** A horizontal denomination strip (1·5·10·20·100) with real artwork thumbnails at true aspect ratio, a scroll-snap row on mobile, a note "Banknote designs. Not yet issued.", and a link to `/banknotes`.
3. **Monetary framework (parchment, ruled).** A pull statement explaining fiat in plain language, plus three ruled columns: *What fiat means* / *What makes it credible* / *What has not yet been decided*.
4. **Status ledger (navy).** A compact table from `status-ledger.ts` with label + icon status and an "as of" date, linking to the full status on `/about#status`.
5. **Publications (parchment).** The latest three real items, or a designed empty state.
6. **Footer.**

### 8.2 `/about`

Purpose; proposed mandate (AEY, monetary policy, issuance, banknotes, statistics, financial-system development, international cooperation); founding principles; **intended** governance structure described as roles, not names; relationship with the Government of Aletheia; intended independence (labelled proposed); and the full status ledger (`#status`). No named officials, appointments or founding dates unless sourced.

### 8.3 `/monetary-policy`

Intended fiat framework; principles of responsible issuance; price stability and purchasing power as **considerations** (no targets); transparency commitments; issuance and the productive economy; and the distinction between **domestic issuance** and **foreign-exchange availability** (a fiat currency can be issued domestically without guaranteeing access to euros). Present the policy-development process as a ruled sequence: research → consultation → adoption → publication → review.

### 8.4 `/currency`

A specimen-sheet table (name, code, forms, denominations, status); the concept and intended role; physical vs digital forms (the StableChain relationship exactly as sourced); issuance principles (link `/issuance`); legal and operational status, with an explicit statement that AEY is proposed and not issued or established as legal tender; an FAQ subset; and links to banknotes and publications.

### 8.5 `/banknotes`

- **Stage:** One featured note with a denomination selector (a `radiogroup`, arrow-key navigable), a front/back toggle (a `button` with `aria-pressed`), and a crossfade or 3D flip (flip disabled under reduced motion).
- **Grid:** All five notes at true aspect ratio (from intrinsic dimensions; `aspect-ratio` set inline; `object-fit: contain`; never stretched).
- **Dialog viewer:** A native `<dialog>` with prev/next (arrow keys), front/back (`F`), zoom (button, wheel with modifier, pinch on touch via pointer events, double-tap), pan when zoomed, `Esc` to close, focus restored, the denomination announced via an `aria-live="polite"` region, swipe gestures on touch, and preloading of adjacent images only.
- **Per-note detail:** Denomination, observed colour, design notes, and security features each tagged `concept_only | specified | physically_implemented`. **Default to `concept_only`** unless a source proves otherwise; the UI labels these "Design concept".
- **Persistent notice:** "These are proposed banknote designs. No Aletheian Guilder banknotes have been issued."
- Artwork via `enhanced-img` with responsive sizes; the original high-resolution file is used only in the zoom view, loaded on demand.

### 8.6 `/issuance`

Cover authorisation, accounting and publication of issued currency, paper vs digital treatment, replacement and withdrawal (when established), audit and reporting principles, and implementation milestones presented as **stages without dates** unless dates are sourced. Every step carries a status. Publish no supply figures. Include a structured "Issuance register" component that renders an honest empty state now ("No currency has been issued. The register will be published here once issuance is authorised.") and accepts typed data later.

### 8.7 `/reserves` (credibility-critical)

- Open with a plain statement: **Aletheia currently holds no euro reserves, and the Reserve Bank holds no foreign reserves.** Use a calm typographic notice, not an alarm banner.
- The intended approach to reserves, FX management and international payments, labelled proposed.
- **"Preconditions for euro convertibility"**: a professional, sequenced explanation of what would need to exist before any guaranteed conversion could be offered, for example a legal basis for the Bank, governance and independence arrangements, acquisition of reserve assets, banking and custody relationships, a published conversion policy and rate regime, independent audit and regular reporting. Each item is `not_established`.
- A **future reporting module**: a typed `ReserveReport` schema (period, asset class, amount, currency, auditor, source document) with a component that renders a designed empty state now and a structured table later, with no redesign required. Add a unit test that the module renders the empty state when the data array is empty.
- Never render a currency figure on this page from anything other than a validated `ReserveReport` with a source document.

### 8.8 `/publications` and `/publications/[slug]`

Category filters (URL search-param driven, so they work without JS via `<form method="get">` and are enhanced with JS), year filter, and client-side text search only when ≥ 10 items. Entries are ruled list rows (date · category · title · summary · format/size), not cards. Detail page: HTML report layout with table of contents, footnotes, a PDF link with size, and a print stylesheet. Empty state as specified.

### 8.9 `/news` and `/news/[slug]`

A dated register with permanent URLs, metadata, OG images and `NewsArticle` JSON-LD. An empty state if none exist. Optionally emit an RSS/Atom feed (`/news.xml`) only when ≥ 1 item exists.

### 8.10 `/faq`

Required questions (answers must match §2): What is the Aletheian Guilder? What does fiat currency mean? Has AEY been issued? Can AEY be exchanged for euros? Does Aletheia have euro reserves? What are the banknote denominations? What is the relationship between AEY and StableChain? What would be required for international acceptance? Use native `<details>/<summary>` with styled markers and deep-link anchors per question. Emit `FAQPage` JSON-LD from the same data, so markup and schema cannot drift.

### 8.11 `/contact`

Render real channels from `site.ts` only. If `email` and `postal` are null, show a designed statement that official enquiry channels are being established and link to the State of Aletheia site. **No form by default.** If a form is later approved, use a SvelteKit form action with Zod validation, a honeypot field, a server-side per-IP rate limit, a time-to-submit check, delivery via a provider configured by `PRIVATE_*` env vars, and an explicit success/failure UI. If the provider is unconfigured, the form must not render (never silently discard). This requires a non-static adapter; ADR required.

### 8.12 Legal pages

- **Privacy:** Accurate to the implementation. If there are no cookies or analytics, say so plainly and list the host's server logs as the only processing.
- **Terms:** Informational website, no financial products or offers, no reliance for financial decisions, intellectual property.
- **Accessibility statement:** WCAG 2.2 AA target, known limitations from QA, a feedback route (only if a real channel exists), and the date of the last review.
- **No claims** of regulatory approval, legal review or certification.

**Gate 5:** All routes render real content; claims-lint passes; link check passes; axe passes on every route.

---

## 9. PHASE 6: MOTION SYSTEM & SIGNATURE EXPERIENCES

### 9.1 Principles

Motion expresses hierarchy and ceremony. It is never a tech demo. All content is **visible and usable without JS and without animation**.

### 9.2 Progressive-enhancement pattern

```html
<!-- app.html -->
<html lang="en-GB" class="no-js">
<script>document.documentElement.classList.replace('no-js','js')</script>
```

```css
/* Only hide-before-reveal when JS is present and motion is allowed */
@media (prefers-reduced-motion: no-preference) {
  .js [data-reveal]:not(.is-revealed) { opacity: 0; transform: translateY(16px); }
}
[data-reveal] { transition: opacity var(--dur-3) var(--ease-out-quart),
                            transform var(--dur-3) var(--ease-out-quart); }
```

The `reveal` Svelte action uses a single shared `IntersectionObserver` (`rootMargin: '0px 0px -10% 0px'`, unobserve after first reveal) and applies staggered `transition-delay` via a `--i` custom property. Add a safety timeout that reveals everything after 2.5s in case the observer never fires.

### 9.3 Choreography inventory

| Element | Technique | Duration | Reduced motion |
|---|---|---|---|
| Headline reveal | Line-masked slide-up (`clip-path: inset()` per line wrapper) | `--dur-4`, stagger 80ms | Instant |
| Guilloché ornament | `stroke-dashoffset` draw using `pathLength="1"` | `--dur-5` | Static, fully drawn |
| Banknote stage | Fade + 8px rise + sheen sweep (`linear-gradient` mask, once) | 900ms + 1200ms | Static |
| Pointer tilt | `transform` via rAF-throttled pointer events, fine pointers only, max 6° | Spring (`svelte/motion` `Spring`) | Disabled |
| Masked image reveal | `clip-path` inset from 100%→0 | `--dur-4` | Instant |
| Parallax (≤ 2 images site-wide) | CSS scroll-driven animations (`animation-timeline: view()`) with `@supports`; no JS fallback | n/a | Disabled |
| Page transitions | View Transitions API via `onNavigate`, crossfade + header persistence (`view-transition-name: masthead`) | 280ms | Disabled |
| Mobile menu | Sheet clip-path + staggered links | 480ms | Instant |
| Hover states | Underline draws left→right; arrow nudges 3px | `--dur-1`/`--dur-2` | Colour change only |

### 9.4 Performance constraints for motion

Animate only `transform`, `opacity`, `clip-path` and `stroke-dashoffset`. No layout-property animation. No continuous infinite loops except the optional ambient sheen, which must pause when off-screen. Use `will-change` only during the animation. No animation may block input or scroll. No scroll hijacking. No custom cursor.

**Gate 6:** Hero, banknote stage, gallery dialog and mobile nav verified on desktop + mobile emulation, with and without `prefers-reduced-motion`, and with JS disabled (content visible, nav reachable).

---

## 10. PHASE 7A: SEO

- **`PUBLIC_SITE_URL`** env var (default `https://rbaletheia.org`) drives canonicals, sitemap and OG URLs.
- **`/sitemap.xml`:** Prerendered `+server.ts` generated from the route manifest plus content slugs, with `lastmod` from content dates. Excludes drafts, `_styleguide` and error pages.
- **`/robots.txt`:** Allow all and reference the sitemap. If `PUBLIC_DEPLOY_ENV !== 'production'`, emit `Disallow: /` and add `<meta name="robots" content="noindex">` site-wide, so previews are never indexed.
- **Headings:** Exactly one `h1` per page with no skipped levels. Assert this in e2e.
- **OG images:** 1200×630, per section, designed as typographic navy/parchment compositions with the emblem. Either static designed files or build-time generation (`satori` + `@resvg/resvg-js` in `scripts/og-images.ts`). Text in OG images is acceptable since they are not page content.
- **Internal linking:** Every page links to ≥ 2 related pages through contextual "Related" sections.
- **JSON-LD rules:**
  - `Organization`: `name`, `url`, `logo` (genuine emblem), `description` that **includes the word "proposed"**, and `parentOrganization` / `sameAs` pointing to State of Aletheia sites only if accurate.
  - **Do not use** `BankOrCreditUnion`, `Financial

> *(Received text ends here. The remainder of the brief is missing.)*
