# ADR-001: Technology Stack, Repository Architecture & Design System Foundation

## Status
**Accepted & Implemented (Phase 0)**

## Context
Aletheia requires a sovereign-grade digital state platform (`stateofaletheia.org`) that is:
1. Visually arresting ("Drop-dead gorgeous", human-designed, editorial, architectural, institutional, zero AI/generic SaaS cliches).
2. Built on Manrope typography, exact extracted colors from the coat of arms and flags, and disciplined geometric cues.
3. Structurally sound with strict separation between public informational pages, interactive citizen/e-resident portals, and high-density, secure government administrative environments (such as Immigration Officer Case Management).
4. Truthful to the status taxonomy (`Operational`, `Under Development`, `Planned`, `Proposed`, `Vision`).

## Decisions

### 1. Web Framework: Next.js (App Router) + React 19 + TypeScript (Strict Mode)
- **Rationale:** Next.js App Router provides Server-Side Rendering (SSR) and Static Site Generation (SSG) for fast, SEO-rich public constitutional documents and laws, combined with interactive client components for portal workflows, case management, and data visualization.
- **Strict TypeScript:** Required across all schemas, statuses, RBAC policies, and service models.

### 2. Styling: Vanilla CSS Variables + Tailwind Token Mapping
- **Constraint:** Zero raw hex values or arbitrary colors in layout code.
- **Implementation:** Design tokens defined centrally as CSS custom properties (`--color-navy`, `--color-parchment`, `--color-gold`, etc.) mapped into Tailwind config.
- **Anti-template directive:** No default rounded cards, no purple/blue gradients, no generic shadcn look. Architectural layouts, sharp/micro radii (`2px - 4px`), crisp borders, and generous whitespace.

### 3. Typography: Manrope
- Self-hosted via `@fontsource/manrope` or Google Fonts variable loader.
- Strict typographic scale: Display, Page Title, Section Heading, Subtitle, Body, Label, Monospace/Tabular.

### 4. Motion: Framer Motion
- Central motion tokens (`duration`, `easeOutExpo`, `stagger`).
- Strict adherence to `prefers-reduced-motion`.

### 5. Application Boundary Structure
```
aletheia-web/
├── app/
│   ├── layout.tsx             # Root layout with Manrope, design tokens, meta
│   ├── page.tsx               # Flagship Home page
│   ├── aletheia/              # Discover Aletheia
│   ├── constitution/          # Constitutional portal with search & article tree
│   ├── government/            # Executive, Legislature, Judiciary, 9 Ministries
│   ├── adss/                  # ADSS Directorates & Mandatory Cybersecurity Dept
│   │   ├── cybersecurity/     # Sovereign Cyber Defence & Threat Ops
│   │   ├── immigration/       # Immigration Directorate
│   │   └── ...
│   ├── citizenship/           # Rights, naturalisation, Covenant Oath
│   ├── e-residency/           # Digital state access, business registration
│   ├── immigration/           # Public immigration service & application
│   ├── economy/               # Treasury, Central Bank, AEY, AletheiaChain
│   ├── development/           # Architectural zones, map, infrastructure
│   ├── portal/                # Citizen, E-Resident & Applicant Dashboards
│   ├── admin/                 # High-density secure government administration
│   │   └── immigration/       # Immigration Officer Case Management
│   └── design-system/         # Internal Phase 0/1 review artifact
├── components/
│   ├── brand/                 # Logo, CoatOfArms, Flag, StarOfTruth components
│   ├── ui/                    # Token-styled primitives (Button, Badge, Card, Table)
│   ├── layout/                # Navbar, MegaMenu, Footer, Breadcrumbs
│   ├── constitution/          # ArticleViewer, Search, CrossReference
│   ├── admin/                 # Officer workbench, case list, document inspector
│   └── motion/                # Motion wrappers honoring reduced-motion
├── lib/
│   ├── tokens.ts              # Canonical design tokens
│   ├── status.ts              # Status taxonomy enum & helper types
│   ├── constitution-data.ts   # Structured constitutional articles
│   ├── institutions-data.ts   # Institutional directory registry
│   └── immigration-data.ts    # Case management data model
└── docs/                      # Brand, decisions, and governance logs
```

## Consequences
- Fast initial load time and crisp rendering.
- Codebase can be built modularly in strict accordance with the Master Prompt phases.
