# Progress: aletheiagov.org

Last updated: 2026-10-09. Phases from brief §25.

## Done

### Phase 1, audit and foundation (partial)
- Next 16.4 / React 19.3 / TypeScript strict / Tailwind 4 / ESLint / Vitest set up ([ADR 0001](docs/decisions/0001-stack-and-structure.md)).
- OKLCH token scales generated from the four core colours (`scripts/tokens.mjs`); every text pair measured and AA-tested ([contrast](docs/design/contrast.md)).
- Environment validation with Zod (`src/lib/config/env.ts`).
- Client-bundle secret check (`npm run check:public-env`).

### Phase 2, public shell and art direction
- Header: transparent over navy mastheads, solid on scroll; Record menu (native popover); mobile drawer (native modal dialog: contained focus, Escape, focus return, scroll lock, staggered links).
- Colophon footer with arms, motto, founding-stage notice, link columns, edition date.
- Homepage chapters § 00 to § 06 per brief §7.
- Signature motifs: section marks, margin column, reference formats, procedural bathymetric contours (`scripts/contours.mjs`), StatusSeal with a distinct glyph per status.
- Motion: hero settle, rising-mask titles, reveal on scroll, curtain image reveals, parallax at most 8 %, view transitions; all off under reduced motion; nothing hidden without JavaScript.
- Photography: 12 Unsplash photos, self-hosted, one consistent grade ([photography](docs/design/photography.md)).
- Screenshot review at 390, 768, 1280 and 1728 px; fixes applied (overflow from an unpositioned sr-only label, Chrome lazy-load blocked by clip-path, figure positioning). Baseline at 1280 and 390 in `docs/design/review/`.

### Phase 5, public records (pages only)
- All public routes in §9.1 render: government, institutions (+19 detail pages), founding programme, programmes (+8 detail pages), opportunities, appointments, directory, documents, decisions, dispatches, public finance, events, development, build-aletheia, search, contact, privacy, terms, accessibility, image credits, sign-in, 404, error, global error.
- Search over all published content (server-side).
- robots (noindex unless `APP_ENV=production`), sitemap, Open Graph image, `/api/health`, `/api/health/ready`, `/.well-known/security.txt` (only when `SECURITY_CONTACT` is set).

## Verified (commands actually run)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npx eslint .` | pass, 0 warnings |
| `npx vitest run` | 37 tests pass |
| `npm run build` | pass, 54 pages, public pages static |
| `npm run check:public-env` | pass |
| `node scripts/audit.mjs` (prod build, 26 routes × 4 widths) | no overflow, one h1 per page, no console or CSP errors, no failed requests |
| Hero image | 21 KB AVIF at 1728 px (budget 220 KB) |

## Open gaps (honest)

- **First-load JS is 184 KB gzipped** on the homepage against a 130 KB budget. Our code is about 12 KB; the rest is the Next 16 / React 19 runtime. Not reachable without leaving Next.
- **CSP uses `'unsafe-inline'` for scripts** on static pages ([ADR 0003](docs/decisions/0003-csp-without-nonces.md)).
- **No axe or Lighthouse run yet**; accessibility is designed to AA but not audited.
- **Search is not rate-limited** (brief: 60/min/IP); needs the shared rate-limit store.
- **Photographer names** missing from credits (no Unsplash API key).
- **Content needs human review** before launch ([content-review](docs/content-review.md)).

## Blocked

- **AletheiaDB integration** (phases 1 contract tests, 3, 4, 6, 7): no API or SDK yet ([database-integration](docs/database-integration.md), [ADR 0002](docs/decisions/0002-public-site-before-database.md)). The owner is writing the AletheiaDB brief.
- **Mail, rate-limit store, deployment target**: not configured.

## Next

1. Owner reviews content and statuses (`docs/content-review.md`).
2. axe checks and Lighthouse CI in the pipeline; CI workflow for this app.
3. When AletheiaDB has an API: adapter, contract tests, `publicRepository`, then auth and the applicant portal.
