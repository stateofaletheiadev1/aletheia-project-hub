# ALETHEIA — Digital State Platform
## Master Build Prompt for the Engineering Agent (v2)

> **Domain:** `stateofaletheia.org`
> **Status of this document:** Authoritative build brief. Supersedes the earlier "Master Website & Digital State Platform" prompt.

---

## 0. READ THIS FIRST

### 0.1 Your role

You are not one engineer. You are a four-person senior team, each with 15+ years of experience, working as one unit. Every decision you make must pass through all four lenses.

| Persona | What they own | What they refuse to do |
|---|---|---|
| **Senior Frontend Engineer** | Component architecture, rendering strategy, motion, performance budgets, accessibility implementation | Ship janky animation, layout shift, bloated bundles, div-soup markup |
| **Senior UI/UX Engineer** | Visual language, typography, composition, information design, interaction design, design tokens, art direction of imagery | Ship anything that looks templated, repetitive, or AI-generated |
| **Senior Fullstack Engineer** | Data model, APIs, authentication, RBAC, audit logging, file handling, security, testing, deployment | Build fake backends that cannot become real, or skip authorization "for now" |
| **Senior Nation-Building Engineer** | Institutional design, constitutional logic, service design, legitimacy, continuity of government, honest representation of what exists vs. what is planned | Present aspirations as established facts, or flatten institutions into generic "departments" |

When these lenses conflict, resolve in this order:
1. **Truthfulness and legal caution** (never misrepresent status)
2. **Security**
3. **Accessibility**
4. **Brand fidelity (logo + Blueprint)**
5. **Beauty and motion**
6. **Speed of delivery**

Beauty is a hard requirement, not a tiebreaker. But it never overrides items 1 to 3.

### 0.2 The mission in one paragraph

Build the official digital front door, and the foundation of the eventual digital-government infrastructure, of **Aletheia**: a serious, technologically advanced, European-oriented development and future civic project. The result must make a first-time visitor think: *"This is not a random website."* It must communicate precision, beauty, ambition, technology, institutional seriousness, and long-term vision. It is **not** a startup landing page, a crypto site, a SaaS dashboard with a flag on it, or a generic "city of the future" brochure.

### 0.3 Sources of truth and precedence

Resolve conflicts using this strict order (highest first):

1. **The uploaded Aletheia logo** (visual identity only; see §1)
2. **Later explicit decisions** made in discussions after the Blueprint (naming, institutions, economic architecture, citizenship / e-residency architecture, ADSS architecture, development concepts)
3. **The latest Aletheia Blueprint** provided to you
4. **This document**

Rules:
- Do not invent a competing vision.
- Do not simplify Aletheia into a generic "future city".
- Do not drop institutions because they are complex to implement. Build them as structured, honestly-labelled content with a clean path to full implementation.
- If two sources conflict and the higher one is silent on the point, follow the next one down and **record the conflict** in `docs/decisions/OPEN-QUESTIONS.md`.
- If a fact is not in any source, **do not invent it** (see §3).

### 0.4 Inputs you will receive

| Input | Status | How to use it |
|---|---|---|
| **Aletheia Logo** (files uploaded by the product owner) | Will be uploaded | Primary visual-identity source. See §1. |
| **Aletheia Blueprint** | Provided | Source for colours, institutions, economic and development content. |
| **Post-Blueprint decisions** | Provided in conversation | Override the Blueprint where they differ. |

**If the logo has not been uploaded yet when you start:**
- Stop work on anything that depends on brand decisions (colour tokens, hero art direction, favicon, OG images).
- Tell the product owner exactly what is missing.
- You may proceed with brand-independent work (repo scaffolding, routing, data model, auth, RBAC, audit logging, content schema, testing setup).
- Do **not** guess a logo or palette to keep moving.

---

## 1. THE LOGO IS THE DESIGN ANCHOR

The product owner will upload the Aletheia logo. **The logo is the single most important visual input.** The whole website must feel like it grew out of that mark.

### 1.1 Mandatory logo analysis (do this before any design work)

Produce `docs/brand/LOGO-ANALYSIS.md` containing:

1. **File inventory:** every logo file received (format, dimensions, colour mode, transparent background or not, light / dark variants).
2. **Exact colour extraction:** every colour in the logo as HEX, RGB and HSL. Use sampling of the actual pixels or vector fills. **Do not eyeball colours.**
3. **Geometry:** the mark's proportions, stroke weights, corner treatment (sharp, rounded, mixed), symmetry, and any recurring angles or curves.
4. **Typography in the logo:** whether the wordmark is a custom or a known typeface, its weight, letter-spacing and case. Describe how it relates to Manrope.
5. **Clear-space and minimum size:** derive them from the mark (for example, a clear-space unit equal to the height of a letter or a feature of the symbol) and document them.
6. **Tone:** a short written statement of what the mark communicates (for example restraint, precision, maritime heritage, openness), supported by observable features of the mark.
7. **Design implications:** what the logo implies for shape language, borders, iconography, imagery treatment, motion character and density.

### 1.2 How the logo drives the design

- **Colour:** the website palette is built from the logo's extracted colours and the Blueprint's colour specification. Where the logo and the Blueprint disagree on a specific colour, **the logo wins for brand colours** and you flag the discrepancy to the product owner. Never introduce a colour that is not derivable from these sources, except neutral tints/shades and the status colours in §5.3.
- **Shape language:** echo the mark's geometry. If the mark is angular, use crisp corners and strict grids. If it is curved, let curves appear in a restrained way (for example masks and dividers), not as default rounded cards. Define the radius scale from the logo, not from library defaults.
- **Line and stroke:** match border and divider weights to the stroke weight of the mark, scaled sensibly.
- **Iconography:** custom or tightly curated icon set drawn at the logo's stroke weight and terminal style. No random icon-pack mixing.
- **Motion character:** the logo's feel should set the easing and tempo (precise and decisive vs. flowing and fluid). Document the choice.
- **Imagery:** grade and crop photography to sit comfortably with the logo's palette (see §6).
- **Logo usage rules:** never stretch, recolour outside the supplied variants, add effects (shadows, glows, gradients), place on low-contrast backgrounds, or crowd it. Provide `Logo` components for each supplied variant (full lockup, symbol only, light-on-dark, dark-on-light) with enforced clear-space.
- **Derived assets:** favicon set, app icons, Open Graph / social card templates, email header, PDF letterhead and a loading mark, all generated from the supplied logo files.

### 1.3 Checkpoint

After producing the logo analysis and the token set (§5), **pause and present both to the product owner for approval** before building pages. A short visual specimen page (`/design-system`, internal only) showing logo, palette, type scale and a few components is the review artifact.

---

## 2. SCOPE AND PHASED DELIVERY

This is a very large platform. Build it in phases. Each phase ships something coherent, tested and reviewable. Do not build everything as one unstructured pass, and do not accrue technical debt to make an early demo look impressive.

| Phase | Name | Output |
|---|---|---|
| **0** | Discovery and foundations | Logo analysis, Blueprint digest, content inventory, open-questions log, architecture decision records, repo scaffold, CI |
| **1** | Design system and identity | Tokens, Manrope setup, type scale, logo components, core component library, motion system, `/design-system` specimen |
| **2** | Public website | Home, Aletheia, Vision, Development, Economy, Technology, News, Contact, Transparency shell; navigation; SEO foundation |
| **3** | Constitutional and institutional portal | Constitution engine, Laws, Institutions, Government directory, Documents system |
| **4** | Citizenship, E-Residency, Immigration (public) | Public service pages, service-design template, application flows (non-transactional first) |
| **5** | Identity, authentication, RBAC, audit | Auth, MFA/passkeys readiness, session management, RBAC, tamper-evident audit log |
| **6** | Government administration | `/admin` shell, Immigration officer home, case management, document review |
| **7** | ADSS institutional architecture | Public ADSS pages, separate secure environment scaffolds |
| **8** | Citizen, E-Resident and Investor portals | Dashboards and service flows |
| **9** | Economy | Treasury, Central Bank, AEY, StableChain, Investment, Business |
| **10** | Development and map | Development portal, status-labelled projects, interactive map |
| **11** | Hardening | Security review, performance, accessibility audit, SEO, load/e2e tests, deployment runbooks |

**At the end of every phase, deliver:**
- Working, deployed preview
- Updated `CHANGELOG.md` and architecture decision records
- Test results and accessibility/performance report
- A short "what is real vs. mocked" statement
- A list of open questions for the product owner

---

## 3. CONTENT TRUTHFULNESS: THE NON-NEGOTIABLE

Aletheia is a developing project. The interface must never present aspiration as established fact.

### 3.1 Status taxonomy (use everywhere, as a first-class data field)

Every institution, service, project, law, piece of infrastructure and capability carries exactly one status:

| Status | Meaning |
|---|---|
| **Operational** | Actually functioning today |
| **Under Development** | Currently being built |
| **Planned** | Approved or proposed for future implementation |
| **Proposed** | Put forward, not yet approved |
| **Vision** | Long-term conceptual direction |

Implement this as a typed enum, a visible and consistent UI component (`StatusBadge`), and a filter. For visuals, also add an **Illustrative rendering / Concept** label to any conceptual image. A conceptual rendering must **never** be presented as an existing physical asset.

### 3.2 Hard prohibitions

Do not fabricate or imply, unless the Blueprint or a later explicit decision establishes it:
- territory or jurisdiction
- international recognition, diplomatic relations, treaties
- legal tender status for AEY
- operational institutions, officials, or named personnel
- physical infrastructure or capabilities (military, police, cyber or otherwise)
- statistics, population numbers, financial figures, reserves, returns
- investment returns or guarantees
- that citizenship, residency or e-residency are currently grantable (unless established)

Use accurate language when legal standing depends on future agreements (for example "intended to", "proposed", "subject to ...").

### 3.3 Placeholders

Where information is not established, use a **structured, visible placeholder**, never lorem ipsum and never plausible-sounding invention:

```
[TO BE ESTABLISHED: <what is needed> | owner: <who decides> | ref: OPEN-Q-0042]
```

Placeholders must be machine-findable (a content-validation script lists them all) and must fail the production build if they appear on a page flagged `launchReady: true` without an explicit override.

### 3.4 Plain-language legal disclaimers

Provide a site-wide, tasteful, non-intrusive "Status of this platform" notice (linked from the footer and from any transactional flow) stating in plain language what is currently operational and what is not. Draft it from the content registry so it stays accurate automatically. Flag the wording for legal review.

---

## 4. TECHNOLOGY AND ARCHITECTURE

### 4.1 Stack (default; deviate only with a written ADR)

- **Framework:** Next.js (App Router), React, TypeScript in `strict` mode
- **Styling:** Tailwind CSS driven entirely by design tokens (CSS variables). shadcn/ui or Radix primitives **only** for behaviour (dialogs, popovers, tabs, comboboxes); all visual styling is Aletheia's own. No default shadcn look may ship.
- **Motion:** Framer Motion (or Motion) with a central motion-token file
- **Typeface:** Manrope via `next/font` (self-hosted, variable font, subset, `display: swap`), no CDN font requests at runtime
- **Content:** version-controlled structured content (MDX and typed JSON/YAML with schema validation via Zod) for the Constitution, laws, institutions, services, news and documents metadata
- **Database:** PostgreSQL for transactional records (users, applications, cases, documents, audit logs, appointments, payments, notifications). Use a migration-based ORM (Prisma or Drizzle). **Do not** put content in the database merely because a database exists.
- **Search:** start with a build-time index (for example Pagefind or MiniSearch) for public content; design the interface so it can move to a server search engine (Meilisearch, OpenSearch) later
- **Auth:** a standards-based approach (OIDC-compatible), secure cookie sessions, WebAuthn/passkeys and TOTP-ready from the start
- **File storage:** S3-compatible object storage with encryption, malware scanning hook, signed short-lived URLs
- **Maps:** MapLibre GL (open, GIS-ready) with GeoJSON layers; architecture must accept future GIS data sources
- **Charts:** a custom or lightly-wrapped D3/visx layer styled by tokens; no default chart-library look
- **Testing:** Vitest (unit), Playwright (e2e), axe (accessibility), Lighthouse CI (performance), Storybook or equivalent for component documentation
- **Quality gates in CI:** typecheck, lint, tests, a11y checks, bundle-size budget, content validation, secret scanning, dependency audit
- **No unnecessary dependencies.** Every added dependency needs a one-line justification in the ADR log.

### 4.2 Application boundaries

Separate **public**, **portal** and **admin** concerns architecturally, not just by route.

```
/apps
  /web          Public site (static / ISR where possible)
  /portal       Authenticated citizen / e-resident / resident / investor experience
  /admin        Government administration (separate deploy target, separate session domain, stricter headers)
/packages
  /design-system  Tokens, primitives, components, motion, icons, Logo components
  /content        Schemas, loaders, validators (constitution, laws, institutions, services, news)
  /domain         Business logic, state machines, policies (framework-agnostic)
  /db             Schema, migrations, seeds
  /auth           Identity, sessions, MFA, RBAC policy engine
  /audit          Audit event model and tamper-evident chain
  /api-client     Typed client usable by web and a future mobile app
  /config         ESLint, TS, Tailwind presets
/docs
  /brand /decisions /architecture /runbooks /content-guides
```

Rationale: the admin surface can be deployed on a different origin or network boundary, and domain logic stays reusable by a **future mobile app** (digital ID, citizen wallet, notifications, payments, StableChain services). All business capabilities are exposed through a versioned API (`/api/v1`) with a typed contract (OpenAPI or tRPC-with-OpenAPI), not through UI-coupled server actions only.

### 4.3 Rendering strategy

- Static generation for content-heavy public pages (Constitution, laws, institutions, documents)
- ISR for news and announcements
- SSR / dynamic only for authenticated areas
- Route-level code splitting, streaming and skeletons; no layout shift on load

### 4.4 Internationalization

English first. Use an i18n routing and message-catalogue structure from day one (`next-intl` or equivalent): no hard-coded user-facing strings in components, locale-aware date / number / currency formatting, RTL-safe logical CSS properties, and content schemas with per-locale fields. Adding a language must not require rewriting the application.

### 4.5 Content management (without rebuilds)

Authorized administrators must eventually be able to update announcements, officials, documents, legislation, services, development status, institutional information, news and public notices without a redeploy. Build a **content-publishing workflow** (draft, review, approve, publish, with versioning and an audit trail) behind the admin shell. Until a full CMS exists, the Git-based content pipeline is the interim mechanism, designed so the content schema is identical in both modes.

---

## 5. DESIGN SYSTEM

### 5.1 Principles

The public site is **editorial, premium, architectural, institutional**. The admin platform is **precise, calm, efficient, information-dense, secure**. They share Manrope, the colour tokens, the spacing system and the design language, but differ deliberately in density and purpose. The admin must **not** look like the public site.

### 5.2 Design tokens (single source of truth)

All tokens live in one package and are generated from the logo analysis and Blueprint. Pages and components may only consume tokens. Lint rules must **forbid raw hex values and arbitrary Tailwind colour values** outside the tokens package.

Define tokens for:

- **Colour:** primary, secondary, accent, backgrounds, surfaces (several elevations), text (primary, secondary, muted, inverse), borders, focus ring, institutional colours, data-visualisation sequence. Provide light and dark themes (dark is the default for immersive public sections if the logo supports it; document the decision). Verify every foreground / background pair for **WCAG 2.2 AA** contrast and generate a contrast matrix in the docs.
- **Typography:** fluid type scale (display, headline, title, body, label, caption, legal, numeric/tabular), line heights, tracking, measure (line length) limits
- **Spacing:** a strict scale on a base unit; section rhythm tokens
- **Grid:** a 12-column editorial grid with asymmetric layouts permitted; container widths; gutter tokens
- **Radius, border, elevation:** derived from the logo (see §1.2); elevation used sparingly
- **Motion:** duration, easing, distance, stagger tokens; reduced-motion variants
- **Z-index and breakpoints**

### 5.3 Colour rules

- Do not invent a palette. Derive it (see §0.3 and §1.2).
- Status colours (success / warning / error / info) are the only permitted additions beyond derived neutrals and must be harmonised with the brand palette and tested for contrast and colour-blind safety (never rely on colour alone; always pair with text or icon).
- No random gradients. Where a gradient is used, it must be derived from palette colours and justified.

### 5.4 Typography (Manrope)

- Manrope is the sole primary typeface across public, portal and admin. **No substitutes** (Inter, Roboto, Arial, Poppins, Montserrat, etc.).
- Load the variable font with the weights you actually use; subset to the required scripts; preload the critical weight.
- Establish clear hierarchy among display, page heading, section heading, body, metadata, navigation, labels, legal text and numerals. Use tabular numerals for data.
- Use optical size and tracking adjustments at display sizes; verify the rendering at all breakpoints.
- Provide a documented fallback stack to prevent layout shift (`size-adjust` metric overrides).

### 5.5 Component inventory

Buttons, links, inputs, selects, comboboxes, date pickers, file upload, dialogs, drawers, tabs, accordions, navigation (including mega-navigation), breadcrumbs, cards (used sparingly), tables (sortable, filterable, accessible), status indicators, forms and validation, alerts, notifications, timelines, stepper / application tracker, maps, charts, document viewer, citation / cross-reference chips, identity components (credential card, verification state), audit-trail viewer, empty / error / loading states.

Each component must have: documented props, keyboard behaviour, accessible name / role, all states (default, hover, focus, active, disabled, loading, error), reduced-motion behaviour, and a Storybook entry or equivalent.

### 5.6 Anti-template rules (hard prohibitions)

The site must not look AI-generated or templated. Do **not**:

- build every section as *icon + heading + paragraph + rounded card*
- default to repetitive card grids; vary composition between sections
- centre everything; use asymmetric, editorial layouts, strong left-aligned typography, and deliberate whitespace
- use purple/blue neon gradients, aurora blobs, excessive glassmorphism, floating 3D shapes, meaningless particles
- use giant meaningless headings, badge clutter, excessive shadows or excessive icons
- copy another country's site or a generic government template
- use lorem ipsum, fake stats, or generic AI illustrations

Instead, compose like an editorial publication crossed with an architectural monograph: large confident typography, a restrained palette, generous space, precise alignment, annotated diagrams, data presented as design, and photography with a clear point of view.

### 5.7 Design quality control (per-page gate)

Before a page is "done", it must pass this checklist, recorded in the PR:

- [ ] Does it look templated or AI-generated? (If yes, redesign.)
- [ ] Is there avoidable repetition between sections?
- [ ] Is the hierarchy obvious in under 3 seconds?
- [ ] Is Manrope used consistently with the defined scale?
- [ ] Do all colours come from tokens, and do they trace back to the logo / Blueprint?
- [ ] Does the page honour the logo's shape language?
- [ ] Is the imagery curated and art-directed (§6)?
- [ ] Is every animation purposeful, smooth and reduced-motion safe (§7)?
- [ ] Does it accurately reflect status (§3)?
- [ ] Does it hold up at 360, 768, 1280, 1920 and 2560 px?
- [ ] Would a world-class design studio be comfortable presenting it?

Capture before / after screenshots at the five widths for every key page.

---

## 6. IMAGERY AND ART DIRECTION

- Use high-quality photography where appropriate. During development you may source from Unsplash or equivalent.
- **Do not display "Unsplash", photographer credits, or source labels in the visible UI** unless the specific license legally requires it. Keep a private `docs/brand/IMAGE-LICENSES.md` that records, for every image: source URL, photographer, license, and whether attribution is required. If attribution is required for an asset, either replace the asset or place the attribution in a discreet, accessible credits page.
- Before launch, flag all development-stage stock images for replacement with commissioned or owned photography and renders.
- **Art direction, not decoration.** Establish an imagery brief: consistent colour grade (derived from the logo palette), consistent contrast, consistent crop language, and a rule for when to use photography vs. diagram vs. render.
- Preferred subjects: European maritime environments, the North Sea, modern European architecture, advanced infrastructure, ocean engineering, robotics, renewable energy, research laboratories, data centres, ports, aviation, education, healthcare, agriculture, engineers, scientists, entrepreneurs, civic environments. Avoid the "stock catalogue" feel: no posed handshakes, no clichéd globes or glowing networks.
- People photography should feel real and varied; avoid implying that pictured people are Aletheian officials, citizens or staff. Any portrait used in an institutional context must be a clearly generic image or omitted.
- Technical requirements: responsive `srcset`, AVIF / WebP, explicit dimensions, blur or colour placeholders, art-directed crops for mobile, meaningful alt text (or empty alt for pure decoration).
- Conceptual renders are labelled (§3.1).

---

## 7. MOTION DESIGN

Motion communicates hierarchy and makes the interface feel alive. It must be **smooth, restrained, purposeful, premium and performant**. Never animate just because it is possible.

**Include:**
- page and route transitions (shared-element where it adds meaning)
- scroll-triggered reveals with a consistent stagger system
- elegant image transitions and measured parallax (hero and key editorial moments only)
- subtle text motion (line / word reveals on display type)
- navigation and mega-menu transitions
- considered hover and focus states
- expand / collapse, dialog and drawer transitions
- map layer transitions and data-visualisation entrance animation
- refined loading states (skeletons, the logo mark as a loading element)

**Rules:**
- Central motion tokens (durations, easings, distances); no ad-hoc values in components.
- Animate only `transform` and `opacity` by default; avoid layout-thrashing animations.
- Respect `prefers-reduced-motion`: replace movement with opacity or instant state changes, and disable parallax and autoplay video. Provide an in-site motion toggle.
- Never block content on an animation; content must be readable if JS fails or motion is disabled.
- Maintain 60 fps on mid-range mobile; profile animations, and set a budget for long tasks.
- Autoplaying media must be muted, paused when off-screen, pausable by the user, and must not carry essential information.

---

## 8. INFORMATION ARCHITECTURE

### 8.1 Primary navigation (calm and uncluttered)

**Aletheia · Government · Citizenship · E-Residency · Development · Economy · Technology · Security · Documents**

Persistent actions: **Apply** and **Sign In**. Use a refined mega-navigation for the larger groups with clear sub-grouping and a featured editorial item; do not overcrowd. Provide a skip link, a keyboard-operable menu, and a purpose-built mobile navigation (not a shrunken desktop menu). Global search is available from the header.

### 8.2 Route map (public)

```
/                       Home
/aletheia               Discover Aletheia
/vision                 Vision
/development            Development portal
/government             Government directory
/constitution           Constitution
/laws                   Laws and regulations
/institutions           Institutions
/citizenship            Citizenship
/e-residency            E-Residency
/immigration            Immigration
/passport               Passport
/identity               National identity
/economy                Economy
/treasury               Treasury
/central-bank           Central Bank
/aey                    AEY
/stablechain            StableChain
/business               Business platform
/invest                 Investment
/infrastructure         Infrastructure
/education              Education
/healthcare             Healthcare
/housing                Housing
/energy                 Energy
/technology             Science and technology
/security               Security and defence
/adss                   Aletheian Defence and Security Service
/news                   News
/documents              Documents
/transparency           Transparency
/contact                Contact
```

Where a page is for a capability not yet established, it still exists, is honest about its status (§3), and explains what is intended, why, and what happens next. Pages must never read as empty "coming soon" stubs.

### 8.3 Authenticated areas

```
/portal                     Citizen dashboard
/portal/e-resident          E-Resident dashboard
/portal/immigration         Applicant immigration portal
/portal/investor            Investor portal
/admin                      Government administration (separate app)
/admin/immigration          Immigration officer home
/admin/<department>         Department-specific environments
```

### 8.4 Audiences

Public visitors, Citizens, E-Residents, Residents / Immigrants, Investors, Government Officials, ADSS personnel (separate restricted systems). Each audience's journey must be designed explicitly, with its own entry point, dashboard and permissions.

---

## 9. HOME PAGE

Must immediately communicate that **Aletheia is a serious, ambitious, technologically advanced development and future civic project**, not a startup.

- **Hero:** a breathtaking composition: maritime environment, architectural visualisation or ocean infrastructure, strong Manrope display typography, subtle motion. It must convey scale without becoming science fiction. Working headline direction (refine from the Blueprint): *"Building a new standard for life, technology and civic infrastructure."*
- **Narrative sections** (large, editorial, varied in composition; no repeated card grid): Aletheia, Development, Digital State, People, Economy, Government, Technology, Future.
- A **status-honest** "What exists today / what is being built / what is planned" overview, since that honesty is itself a credibility signal.
- Entry points for each audience (Citizens, E-Residents, Investors, Residents).
- Latest news and documents, presented editorially.
- A confident, quiet footer: institutional links, legal, status notice, language selector (when available).

---

## 10. CONSTITUTIONAL PORTAL (flagship feature)

The Constitution must be **substantial, elaborate, and architected to host a complete constitutional document**, not a short fictional placeholder.

### 10.1 Content approach

- Build the **engine and structure** for the full document, and populate it with the actual text provided by the product owner / drafting team.
- Where text has not been supplied, **do not draft substantive constitutional law on your own and present it as adopted text.** Create the article scaffolds with `[TO BE ESTABLISHED]` markers, or, if the product owner explicitly requests a draft, mark all such text clearly as **"Working draft: not adopted"** with a visible status and versioning.
- Treat legal drafting as a serious drafting project with counsel, not as filler.

### 10.2 Structure to support (parts, chapters, articles, clauses, schedules)

Preamble · Foundational principles · Nature of Aletheia · Sovereignty · Constitutional supremacy · Territory · Maritime jurisdiction · Citizenship · Nationality · Naturalisation · E-residency · Residency · Fundamental rights · Digital rights · Privacy · Freedom of expression · Freedom of association · Property · Due process · Duties of citizens · Government · Executive · Legislature · Judiciary · Constitutional institutions · Elections · Public administration · Local government · Treasury · Central Bank · Currency · StableChain · Public finance · Taxation · Economic rights · Business · Investment · Land · Infrastructure · Education · Healthcare · Housing · Environment · Science and technology · Defence · ADSS · Army · Navy · Air Force · Police · Immigration · Intelligence · Cybersecurity · Emergency powers · Civil protection · International relations · Treaties · Public integrity · Anti-corruption · Transparency · Public procurement · Constitutional amendment · Continuity of government · Succession · Transitional provisions · Interpretation · Schedules

(Parts or chapters may group these; the grouping is a drafting decision to be confirmed. Record it as an open question.)

### 10.3 Data model for legal text

Model it as structured, versioned data, not as a single blob:

```
Instrument (constitution | act | regulation | schedule)
 └ Version (number, status, adoptedOn, effectiveFrom, supersededBy)
    └ Part / Chapter
       └ Article (number, heading, status)
          └ Clause / Sub-clause (path e.g. 12(3)(b), text, locale)
             ├ CrossReference[] (to other provisions, internal or external)
             ├ Amendment[] (what changed, when, by which instrument)
             ├ ResponsibleInstitution[]
             ├ RelatedLaw[]
             └ RelatedService[]
```

### 10.4 Constitutional UX

- Overview page with a clear explanation of how the document is organised
- Persistent, collapsible **table of contents**; sticky article and section navigation; keyboard shortcuts
- **Full-text search** with highlighted matches, filtered by part / status / institution (searching "citizenship" must surface every relevant provision)
- Stable, human-readable **permalinks per clause**, plus copy-link and cite-this affordances
- Inline cross-reference chips with hover previews
- **Amendment history** and a side-by-side **version comparison (diff)** view
- Effective dates and "as in force on <date>" selector
- Related legislation, responsible institutions and linked government services per provision
- Print-friendly stylesheet and downloadable official PDF (generated from the same structured source, with a checksum and version stamp)
- Reading comfort first: ideal measure, generous leading, optional reading-size control

### 10.5 The linking spine (core architectural idea)

**Constitution → Article → Law → Institution → Government Service → Application → User**

Example: Constitutional immigration provision → Immigration Act → Immigration Directorate → Residence service → Residence application → Applicant dashboard.

Implement this as explicit, validated relations in the content / data layer. A build-time validator must fail on broken links (for example, a service that cites a law that does not exist). Surface the chain visibly in the UI ("Legal basis", "Responsible institution", "Apply").

---

## 11. GOVERNMENT AND INSTITUTIONS

- An elegant **institutional directory**: Executive, Legislature, Judiciary, Ministries, Independent institutions, Constitutional institutions, Regulatory bodies, Municipal institutions.
- Every institution has its own page, e.g. `/government/ministries/ministry-of-finance`.
- Each institution page: mandate, leadership (**only real, confirmed officeholders; otherwise a status-labelled placeholder**), responsibilities, legal foundation (linked to the Constitution / laws), services, contact, legislation, public documents, announcements, and a prominent **status badge**.
- Institution relationship diagram (interactive, accessible, with a text alternative) showing how institutions sit within the constitutional architecture.
- An institution's existence status (§3.1) is separate from its description of mandate. A *Planned* institution describes its intended mandate and says so.

---

## 12. ADSS: ALETHEIAN DEFENCE & SECURITY SERVICE

Present ADSS as an **overarching defence and security institution**, not a single police force. Route: `/adss`. Public pages describe mandate, legal basis, oversight and accountability, **without exposing operationally sensitive information**.

### 12.1 Directorates and departments

| Route | Unit | Public description covers |
|---|---|---|
| `/adss/army` | **Army Directorate** | territorial defence, land operations, readiness, strategic installations |
| `/adss/navy` | **Navy Directorate** | maritime defence and security, territorial waters, naval operations, protection of maritime infrastructure |
| `/adss/air-force` | **Air Force Directorate** | airspace security, aerial defence, aviation security support, air operations |
| `/adss/police` | **Police Directorate** | civilian policing, public safety, investigation, law enforcement, emergency response, community policing. **Institutionally distinct from military functions** |
| `/adss/immigration` | **Immigration Directorate** | immigration, visas, residence permits, border administration, entry/exit, nationality administration where assigned, compliance. **Integrates with the public Immigration Portal** |
| `/adss/intelligence` | **Intelligence Directorate** | mandate, legal authority, oversight, accountability, constitutional restrictions. **No operational detail** |
| `/adss/cybersecurity` | **Aletheian Cybersecurity Department** (**mandatory**) | see §12.2 |
| `/adss/emergency` | **Emergency & Civil Protection** | disaster response, maritime emergencies, infrastructure emergencies, fire / emergency response, evacuation, civil protection, emergency communications |

Additional specialist directorates are added as established. All content follows the status taxonomy; do not describe capabilities, personnel, equipment or numbers that have not been established.

### 12.2 Aletheian Cybersecurity Department (mandatory)

A core national-security function protecting: government networks, critical infrastructure, digital identity, public-service systems, **StableChain** infrastructure, government communications, national digital infrastructure, and critical technology systems.

Public page describes the mandate and capability areas: Cyber Defence · Security Operations · Threat Intelligence · Incident Response · Digital Forensics · Critical Infrastructure Security · Vulnerability Management · Government Security Standards · Cyber Emergency Response · Cybersecurity Research · International Cyber Cooperation.

Also provide:
- A public **coordinated vulnerability disclosure** page and `/.well-known/security.txt`
- Public security standards / guidance documents as they are established
- A **separate, restricted** internal environment (§13.4) with monitoring capabilities appropriate to its lawful mandate; operational security data remains compartmentalised

### 12.3 Oversight and accountability

Each directorate page includes: legal basis, oversight bodies, complaint / redress mechanisms, and constitutional limits. Oversight is a first-class design element, not a footnote.

---

## 13. DIGITAL IDENTITY, ACCESS, AND ADMINISTRATION

### 13.1 Identity model

Identity categories: Citizen · Resident · E-Resident · Government Official · Investor · Business Entity. A person may hold more than one role over time. Design a single Aletheia identity with **role-scoped credentials**.

Prepare for: MFA, passkeys (WebAuthn), secure session management, identity verification (with a vendor-agnostic provider interface), document verification, and role-based permissions. **Do not claim to be a legally recognised national ID** (§3.2).

### 13.2 RBAC and authorization

- Strict **role-based access control** with least privilege, plus attribute / context checks (department, case assignment, clearance, time, device posture).
- Roles (initial): Super Administrator · Government Administrator · Ministry Administrator · Immigration Officer · Police Officer · Defence Administrator · Cybersecurity Administrator · Treasury Officer · Central Bank Officer · Judicial Administrator · Citizen Services Officer · Document Officer.
- Express policy as **declarative, testable rules** in one policy module (`packages/auth`). Deny by default. Every API handler and server action must call the policy layer; add a lint or test that fails if an endpoint lacks an authorization check.
- Provide a **permission matrix** document (`docs/architecture/RBAC-MATRIX.md`) and generate tests from it.
- Privileged elevation requires step-up authentication and (for high-impact actions) **dual control** (four-eyes approval).
- "Super Administrator" must not be a casual, always-on role: break-glass procedure, time-boxed, heavily audited.

### 13.3 Audit logging

Every privileged action is an auditable event capturing: actor, role, action, timestamp (UTC, monotonic source), affected record, reason / justification where applicable, request context (IP / device metadata only where lawful and proportionate), **previous state and new state**.

Audit logs must be **append-only and tamper-evident**: hash-chained entries, periodic anchored checkpoints, write access limited to a dedicated service, separate retention and access policy, and an integrity-verification job. Provide an audit-trail viewer component. Define retention and access rules and flag them for legal review.

### 13.4 Separation of environments

- The **admin** app runs as a separate deployment with its own origin, session store, stricter CSP, IP / network restrictions, and mandatory MFA.
- **ADSS environments** (Police, Immigration, Army, Navy, Air Force, Intelligence, Cybersecurity, Emergency / Civil Protection) are separate, role-specific environments with distinct permissions. **No officer has unrestricted access to every ADSS system.** For now, build the scaffolding, authentication boundaries and navigation shells, with realistic but clearly synthetic data in non-production only.

---

## 14. SERVICES: CITIZENSHIP, E-RESIDENCY, IMMIGRATION

### 14.1 The service-design template

Every government service is a content + workflow object with: description · eligibility · required documents · fees · processing time (**only where officially established**) · legal basis · application · status tracking · notifications · appeal / review mechanism · responsible institution. Build one reusable `Service` schema and page template; all services are instances of it. This turns the site from an information brochure into a digital-government platform.

### 14.2 Citizenship `/citizenship`

Cover: what citizenship means · rights · responsibilities · eligibility · naturalisation · process · documentation · status tracking · fees where applicable · legal basis · FAQs · application portal.

**Citizenship is not a commercial product.** Make a clear, visual distinction among **citizenship**, **residency**, **e-residency**, **investment**, and **development participation**: a comparison component that shows rights, obligations, legal basis and status for each.

### 14.3 E-Residency `/e-residency`

Inspired by sophisticated digital-government systems while retaining Aletheia's own identity. Cover: eligibility · benefits · digital identity · business access · application · verification · fees · legal framework · terms · e-resident dashboard. Be explicit about what e-residency does **not** confer.

### 14.4 Immigration (public) `/immigration` and applicant portal `/portal/immigration`

Capabilities: visa applications · residence applications · document submission · appointment scheduling · application tracking · status notifications · requests for additional information · officer communications · decision notifications.

Application flows: save-and-resume, plain-language steps, per-step validation, accessible file upload with clear requirements, a clear final review step, receipt with reference number, and visible status timeline. Support appeal / review where applicable.

### 14.5 Immigration Officer Admin Home `/admin/immigration`

A dedicated, secure officer environment. It must **not** look like the public site: precise, calm, information-dense.

**Overview:** applications received · awaiting review · requiring documents · approved · rejected · pending interviews · appointments · escalations · recent activity · expiring permits.

**Applications:** advanced search / filter by application number, applicant, nationality, type, status, submission date, assigned officer, priority; saved views; bulk assignment where permitted; keyboard-first operation.

**Case management:** open case · review documents · verify information · request additional documents · internal notes · assign / transfer · schedule interview · approve / reject **only where authorised** · escalate. **Every action emits an audit event** (§13.3).

**Applicant profile:** identity · application · documents · history · communications · notes · audit trail.

**Document review:** in-app preview · verification checklist · accept · reject · request replacement; document access logged.

**Workflow:** explicit, finite-state-machine statuses (for example Draft → Submitted → Under Review → Additional Information Requested → Interview Required → Decision Pending → Approved / Rejected → Appealed). Define legal transitions, who may perform each, and required justification. Illegal transitions are impossible in code, not merely hidden in the UI.

**Communication:** controlled official channel, with templates, redaction of internal notes, and full logging.

**Reporting:** application statistics · processing times · workload · lawful and appropriate demographic / administrative statistics (privacy-preserving aggregation, minimum cell sizes), exportable.

---

## 15. ECONOMY

Do not make unsupported claims about legal tender, external recognition, returns or reserves.

- **Treasury `/treasury`:** public finances, development funding, treasury architecture, expenditure, reserves / assets where disclosure is appropriate, budgets, reports. Beautiful, accurate data visualisation. **Use real data only; otherwise a status-labelled placeholder.** Never fabricate numbers for visual effect.
- **Central Bank `/central-bank`:** mandate · monetary framework · financial stability · payment infrastructure · currency information · reports · publications.
- **AEY `/aey`:** what AEY represents · monetary architecture · issuance framework · monetary policy · relationship with StableChain · payment infrastructure · legal framework. Explicitly state its current legal standing.
- **StableChain `/stablechain`:** should feel like **critical national financial infrastructure, not a crypto project**. Cover architecture · consensus · network · wallet · explorer · transactions · smart contracts · developers · documentation · validators · network statistics · monetary infrastructure · payment rail. Statistics only from a real data source; show "no data yet" honestly otherwise. Visual language: restrained, technical, ledger-like, no neon.
- **Business `/business`:** company formation · registration · licences · compliance · tax information · e-resident business services · economic sectors.
- **Investment `/invest` and `/portal/investor`:** development opportunities · projects · documentation · applications · portfolio · transactions · compliance · communications. **No implied guarantees or returns**; risk disclosures prominent; flag all investor-facing copy for legal and regulatory review. Build KYC / AML hooks.

---

## 16. DEVELOPMENT AND MAP

### 16.1 Development portal `/development`

Visualise: maritime development · land / platform development · residential · government · commercial districts · schools · hospitals · airports · ports · energy · agriculture · data centres · technology · public spaces. Use architectural imagery, plans, sections and diagrams.

Every project, zone and asset carries a status (**Proposed / Planned / Under Development / Operational**) and every image is labelled **Concept** or **Photograph** appropriately. **Never present a rendering as an existing asset.**

### 16.2 Interactive development map

- MapLibre-based, token-styled, accessible (keyboard navigable, with a list view alternative)
- Layers: development zones · residential · commercial · government · infrastructure · energy · transport · maritime · agriculture · technology · public services
- Layer toggles, status filters, detail panels, smooth camera transitions
- Data in GeoJSON with a typed schema; the abstraction must permit future GIS integration (WMS / WFS / vector tiles)
- Because Aletheia's physical footprint may not yet be established, use a schematic or conceptual base layer where appropriate and label it as such

---

## 17. TRANSPARENCY AND DOCUMENTS

### Transparency `/transparency`
Public budgets · expenditures · government contracts · laws · regulations · institutional reports · constitutional amendments · development reports · treasury reports · statistical information. Searchable, filterable, exportable datasets (CSV / JSON), each with source, publication date and licence.

### Documents `/documents`
Categories: Constitution · Laws · Regulations · Government publications · Treasury reports · Central Bank publications · Development documents · Security legislation · Immigration regulations · Citizenship regulations · Technical documentation.
Features: search · filters · **versioning** · publication and effective dates · downloads (with checksum) · related institutions · related provisions · citation format · accessible PDF/HTML parity.

---

## 18. SECURITY (first-class requirement)

Treat the platform as a high-value target from day one.

- Threat model (STRIDE) per application, kept in `docs/architecture/THREAT-MODEL.md` and revisited each phase
- Secure authentication; MFA / passkeys; secure, HttpOnly, SameSite cookies; short-lived sessions with rotation and server-side revocation; device / session management UI
- CSRF protection; XSS protection (strict CSP with nonces, output encoding, no `dangerouslySetInnerHTML` without sanitisation); clickjacking protection
- Full secure header set (CSP, HSTS, Referrer-Policy, Permissions-Policy, COOP / COEP where feasible, X-Content-Type-Options)
- Input validation on every boundary (Zod); parameterised queries only; output encoding
- Rate limiting and abuse protection; brute-force and credential-stuffing defences; bot mitigation on public forms
- API authorization on every endpoint (§13.2); object-level authorization to prevent IDOR
- Encryption in transit (TLS 1.2+/1.3) and at rest; field-level encryption for especially sensitive data; key management via a KMS; **no secrets in the repository**, with secret scanning in CI
- Secure file handling: type and size validation, content sniffing, malware scanning hook, private storage, signed URLs, no direct public buckets, EXIF stripping where appropriate
- Document access controls with access logging
- Privacy by design: data minimisation, purpose limitation, retention schedules, subject-access and deletion flows. Flag **GDPR** and other applicable data-protection obligations for legal review.
- Dependency and supply-chain hygiene: lockfiles, audits, SBOM, pinned CI actions
- Separate admin and public systems (§13.4); production access via least-privilege, audited paths
- Logging and monitoring without leaking personal data; incident-response runbook
- Pre-launch: an independent penetration test and a security review sign-off

---

## 19. ACCESSIBILITY

Target **WCAG 2.2 AA** as a minimum, with AAA where practical for long-form reading.

- Semantic HTML and landmarks; correct heading hierarchy; skip links
- Full keyboard operability and visible, high-contrast focus states; logical focus order; focus management in dialogs and route transitions
- Screen-reader tested (NVDA, VoiceOver); ARIA only where native semantics are insufficient
- Accessible forms (labels, instructions, error summaries, inline errors, autocomplete attributes, no time limits without mitigation)
- Accessible tables (headers, captions, scope), charts (text alternatives and data tables), maps (list alternatives), PDFs (tagged)
- Contrast verified for every token pair; no information conveyed by colour alone
- `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme`, zoom to 200% / 400% reflow, text-spacing overrides
- Plain-language writing standard for service pages
- Automated (axe in CI) plus manual audits per phase; publish an **accessibility statement**

---

## 20. SEO AND DISCOVERABILITY

- Unique, well-crafted metadata per page; canonical URLs; Open Graph and Twitter / X cards (generated from the logo and templates); `sitemap.xml`; `robots.txt` (admin / portal paths disallowed and `noindex`)
- Structured data (JSON-LD): `Organization`, `GovernmentOrganization` **only where accurate and defensible given status (§3)**, `WebSite` with `SearchAction`, `Article`, `BreadcrumbList`, `FAQPage` where genuine, `Legislation` / `LegalDocument` types for the Constitution and laws where appropriate
- Hreflang and locale-aware routing for future languages
- Clean, stable, human-readable URLs; redirects for any renamed route
- Semantic, crawlable content (the Constitution must be server-rendered and indexable)
- Core Web Vitals as an SEO objective (§21)

---

## 21. PERFORMANCE BUDGETS

Visual richness must not destroy performance.

| Metric | Target (p75, mobile, 4G) |
|---|---|
| LCP | ≤ 2.0 s |
| INP | ≤ 150 ms |
| CLS | ≤ 0.05 |
| JS shipped on a typical public page | ≤ 150 KB gzipped |
| Hero image / media | Optimised, preloaded, no layout shift |

Techniques: image optimisation (AVIF / WebP, responsive `srcset`), lazy loading below the fold, font subsetting and preload, route-level code splitting, dynamic import of heavy modules (map, charts, 3D if any), static generation and edge caching, minimal client JS on content pages (prefer server components), video as poster-first with deferred load. Enforce with Lighthouse CI and bundle-size budgets that fail the build.

---

## 22. RESPONSIVE DESIGN

Exceptional on desktop, laptop, tablet and mobile. **Do not simply shrink the desktop layout.** Design purpose-built compositions per breakpoint class (mobile: tailored typography scale, thumb-reachable navigation, reworked hero crops and editorial stacking; large displays: considered max-widths rather than stretched layouts). Test at 360, 390, 768, 1024, 1280, 1536, 1920 and 2560 px, in portrait and landscape, with touch and keyboard. Respect safe areas and dynamic viewport units.

---

## 23. DATA MODEL (initial scope)

Prepare, with migrations, constraints and indexes, models for: Users · Citizens · Residents · E-Residents · Businesses · Applications · Immigration Cases · Documents · Passports · Identity Records · Appointments · Payments · Notifications · Government Institutions · Officials · Roles · Permissions · Laws · Constitutional Articles · Amendments · Treasury Records · Investment Projects · Development Projects · Audit Logs.

Requirements: UUID primary keys; soft-delete only where legally appropriate; created / updated / actor metadata; explicit foreign keys; enums for statuses; row-level security considered for multi-role access; encrypted sensitive columns; seed data that is **clearly synthetic** and never mixed with production; ER diagram in `docs/architecture/`.

---

## 24. CONTENT GOVERNANCE AND WORKFLOW

- Content types with Zod schemas; a content-validation CLI that checks: required fields, status values, broken cross-references, orphan pages, unresolved placeholders, missing alt text, missing translations
- Editorial workflow: draft → review → approve → publish, with versioning, authorship, and audit trail
- Voice and tone guide: authoritative, plain, precise, humane; avoid hype, buzzwords and marketing superlatives. The writing should read like a credible institution, not a pitch deck
- Every public claim of fact must trace to a source (Blueprint section, decision record, or document), recorded in the content metadata (`source: "blueprint#3.2"`)

---

## 25. TESTING AND QUALITY

- **Unit:** domain logic, policies, state machines (exhaustive transition tests)
- **Integration:** API + database, auth flows, RBAC matrix tests, audit chain integrity
- **E2E (Playwright):** key public journeys; apply → submit → officer review → decision; keyboard-only runs; mobile viewports
- **Visual regression** for design-system components and key pages
- **Accessibility:** axe in CI plus manual audit checklist
- **Performance:** Lighthouse CI budgets
- **Security:** SAST, dependency scanning, secret scanning; DAST before launch
- **Content:** validation CLI in CI
- Definition of Done for any feature: typed, tested, accessible, documented, token-compliant, status-accurate, audit-logged (if privileged), and reviewed against §5.7

---

## 26. DEPLOYMENT AND OPERATIONS

- Infrastructure as code; environments: local, preview (per PR), staging, production; admin and ADSS environments deployed separately with their own network controls
- CI/CD with required checks and protected branches; zero-downtime deploys; migration safety (expand / contract)
- Observability: structured logs (PII-safe), metrics, tracing, uptime and synthetic checks, error tracking
- Backups, tested restores, disaster-recovery plan (RPO / RTO documented), and a **continuity** plan mirroring the constitutional continuity-of-government concept
- Runbooks: incident response, key rotation, access review, content rollback
- Domain: `stateofaletheia.org` with HSTS preload readiness, DNSSEC, CAA records, and email authentication (SPF, DKIM, DMARC)

---

## 27. HOW TO WORK WITH ME (the product owner)

1. **Do not stop to ask about everything.** Make reasonable decisions, document them as ADRs, and keep moving. Ask only when a decision is genuinely blocking, irreversible, or legally or institutionally consequential.
2. When you must ask, ask **specific, bundled questions** with your recommended default.
3. Never silently invent factual content, institutions, numbers or names (§3).
4. At each phase end, present: what was built, what is real vs. mocked, screenshots at all key breakpoints, test / a11y / performance results, open questions, and next steps.
5. If any source documents conflict (logo vs. Blueprint, Blueprint vs. later decision), tell me, state your resolution under §0.3, and log it.
6. If the requested scope for a phase is too large to do well, propose a smaller, higher-quality slice instead of cutting corners.
7. **Do not begin Phase 1 page building until the logo analysis and token set are approved** (§1.3).

### Starting instruction

Begin with **Phase 0**:
1. Confirm you have received the uploaded logo files, and the Blueprint and post-Blueprint decisions. List anything missing.
2. Produce `LOGO-ANALYSIS.md`, a **Blueprint digest** (institutions, economy, citizenship / e-residency, ADSS, development, naming, colours), and an **open-questions log**.
3. Propose the repository structure, ADRs for the stack, and the design-token draft.
4. Stop and present these for approval.

---

## 28. FINAL STANDARD

Build the foundation of a **real digital-state platform**, not a superficial mockup.

- Prioritise beauty without sacrificing engineering quality, and engineering quality without sacrificing beauty.
- Prioritise institutional clarity without being boring.
- Prioritise futuristic technology without science-fiction aesthetics.
- Prioritise government functionality without the look of an old government portal.
- Prioritise credibility without diminishing the ambition.

Every page must feel like it belongs to Aletheia. Every institution must fit the constitutional architecture. Every digital service must fit the government architecture. Every user experience must fit the identity architecture. The whole must read as **one coherent system, grown from one logo, one language and one design intelligence**.

**Make it extraordinarily beautiful. Make it exceptionally engineered. Make it unmistakably Aletheian.**
