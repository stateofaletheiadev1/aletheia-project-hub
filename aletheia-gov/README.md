# aletheiagov.org

The website of the founding government of the Sovereign Covenant State of Aletheia: its institutions in
formation, programmes, opportunities and public record. The national website is the separate
`aletheia-web` app (stateofaletheia.org).

Built to `aletheiagov-master-engineering-prompt-v2.md`. Status: [PROGRESS.md](PROGRESS.md).

## Run

```sh
npm install
npm run dev          # http://localhost:3200
npm run build && npm start
```

## Check

```sh
npm run typecheck
npm run lint
npm test
npm run build && npm run check:public-env
npx playwright test                           # e2e, axe, keyboard, security, visual (starts its own server)
# with the production server running (npm start):
node scripts/audit.mjs                        # overflow, h1, console/CSP errors at 4 widths
node scripts/lighthouse.mjs                   # performance budgets (build with APP_ENV=production)
node scripts/screenshots.mjs                  # design review screenshots
```

Playwright scripts accept `CHROMIUM_PATH` to reuse an installed Chromium.

## Regenerate assets

```sh
node scripts/tokens.mjs      # colour scales -> src/styles/tokens.css
node scripts/contours.mjs    # bathymetric contour fields -> public/contours/
npm run images               # download and grade photographs -> public/images/, src/content/credits.json
```

## Where things are

| Path | What |
|---|---|
| `src/app/` | Routes. No business logic, no data access. |
| `src/components/` | `brand/`, `editorial/`, `navigation/`, `motion/`, `records/`, `media/`. |
| `src/content/` | Structural content (institutions, programmes, phases), for human review. |
| `src/server/` | Server-only: the public-record boundary and search. |
| `src/lib/` | Status taxonomy, references, dates, env, site identity. |
| `docs/` | Decisions, design (contrast, photography, review screenshots), content review, database integration. |

## Environment

See `.env.example`. Variables read today: `APP_ENV`, `APP_BASE_URL`, `SECURITY_CONTACT`, `ALETHEIADB_URL`
(reserved; integration pending).
