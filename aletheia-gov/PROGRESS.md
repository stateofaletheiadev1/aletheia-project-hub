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

### Phase 8 groundwork, quality gates
- E2E, accessibility (axe), keyboard, resilience, security and visual-regression suites (`tests/e2e/`).
- Lighthouse budget script; GitLab CI jobs for this app (`.gitlab-ci.yml`: check, e2e, visual, Lighthouse, gitleaks).
- Search rate-limited to 60/min per client ([ADR 0004](docs/decisions/0004-in-memory-rate-limit.md)).
- Fixed: standalone builds served unresized images (sharp's native libraries were not traced).
- [Accessibility review](docs/accessibility-review.md), [performance findings](docs/performance.md).

### Phase 5, public records (pages only)
- All public routes in §9.1 render: government, institutions (+19 detail pages), founding programme, programmes (+8 detail pages), opportunities, appointments, directory, documents, decisions, dispatches, public finance, events, development, build-aletheia, search, contact, privacy, terms, accessibility, image credits, sign-in, 404, error, global error.
- Search over all published content (server-side).
- robots (noindex unless `APP_ENV=production`), sitemap, Open Graph image, `/api/health`, `/api/health/ready`, `/.well-known/security.txt` (only when `SECURITY_CONTACT` is set).

## Verified (commands actually run, 9 October 2026)

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass, 0 warnings |
| `npm test` (Vitest) | 41 tests pass |
| `npm run build` | pass, 54 pages, public pages static, proxy on `/search` only |
| `npm run check:public-env` | pass |
| `npx playwright test` (production build, desktop 1280 + mobile 390) | 145 pass, 4 skipped (desktop-only/mobile-only cases); one visual test timed out once while settling (0 pixels differed), fixed with a longer screenshot timeout and re-run green twice |
| — axe (WCAG 2.2 AA tags), 29 routes × 2 widths | 0 violations of any impact |
| — keyboard, no-JS, reduced motion, security headers, rate limit, XSS echo | pass |
| — visual regression, 27 routes × 2 widths (Windows baselines) | pass, stable on consecutive runs |
| `node scripts/audit.mjs` (26 routes × 4 widths) | no overflow, one h1 per page, no console or CSP errors |
| `node scripts/lighthouse.mjs` (production build) | a11y 100, best practices 100, SEO 100, CLS 0; performance budgets not met ([performance](docs/performance.md)) |
| Standalone image optimiser | AVIF 5–26 KB per width (was serving the 151 KB original at every width before the fix) |

## Open gaps (honest)

- **Performance budgets not met under Lighthouse's simulated mobile profile**: score 0.73–0.96, simulated LCP 1.4–3.6 s, first-load JS ≈156 KB vs 130 KB. Real loads are fast (LCP 342–805 ms). The simulation is dominated by the Next 16 / React 19 runtime, and this machine's measurements are noisy. Details and options: [performance](docs/performance.md). Owner decision needed.
- **CSP uses `'unsafe-inline'` for scripts** on static pages ([ADR 0003](docs/decisions/0003-csp-without-nonces.md)).
- **Rate limiting is in process memory**: correct for one server only ([ADR 0004](docs/decisions/0004-in-memory-rate-limit.md)).
- **No way yet to register interest in proposed institutions**: needs a published address or mail delivery (owner to choose); full applications wait for the applicant portal.
- **Accessibility**: no screen-reader pass by a person yet; 320 px and 400 % zoom not yet checked ([accessibility review](docs/accessibility-review.md)).
- **Visual baselines are Windows-only**; run the manual `gov:visual-baseline` CI job once and commit the Linux set.
- **Photographer names** missing from credits (no Unsplash API key).
- **Content needs human review** before launch ([content-review](docs/content-review.md)).

## Blocked

- **AletheiaDB integration** (phases 1 contract tests, 3, 4, 6, 7): no API or SDK yet ([database-integration](docs/database-integration.md), [ADR 0002](docs/decisions/0002-public-site-before-database.md)). The owner is writing the AletheiaDB brief.
- **Mail, shared rate-limit store, deployment target**: not configured.

## Next

1. Owner: review content and statuses; choose how people register interest; decide on the performance budget ([performance](docs/performance.md)).
2. First CI run on GitLab; generate and commit Linux visual baselines.
3. When AletheiaDB has an API: adapter, contract tests, `publicRepository`, then auth and the applicant portal.
