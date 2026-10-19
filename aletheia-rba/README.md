# Reserve Bank of Aletheia: rbaletheia.org

The public website of the Reserve Bank of Aletheia, the proposed monetary institution of the Sovereign Covenant State of Aletheia, and of its proposed currency, the Aletheian Guilder (AEY).

It is an informational site. It holds no accounts, takes no payments and collects no personal data. Every statement on it must be true and brief; see `docs/CONTENT_GUIDE.md`.

## Run it

Requires Node 22+ and pnpm (`corepack enable`).

```sh
pnpm install
pnpm exec playwright install chromium webkit   # once, for the e2e tests
pnpm dev                                        # http://localhost:5173
pnpm verify                                     # every gate CI runs
```

## Scripts

| Script             | What it does                                                                     |
| ------------------ | -------------------------------------------------------------------------------- |
| `pnpm check`       | `svelte-check`, failing on warnings                                              |
| `pnpm lint`        | ESLint and Prettier                                                              |
| `pnpm test:unit`   | Vitest                                                                           |
| `pnpm build`       | Prerenders every page into `build/` (`adapter-static`)                           |
| `pnpm lint:claims` | Fails on forbidden monetary claims in `src/` and in `build/` (run after a build) |
| `pnpm lint:links`  | Checks every link in `build/`                                                    |
| `pnpm test:e2e`    | Playwright with axe, Chromium and WebKit, desktop and mobile                     |

CI runs `pnpm verify` as the `rba:verify` job in the monorepo's root `.gitlab-ci.yml`.

## Documents

- `docs/CONTENT_GUIDE.md`: how to edit content.
- `docs/adr/`: technical decisions.

Internal working documents live in `docs/internal/`, which is not committed.
