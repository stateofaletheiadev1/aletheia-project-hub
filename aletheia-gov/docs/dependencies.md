# Dependencies

Every dependency, with the reason it is here. Versions are pinned in `package.json` and `package-lock.json`.

## Runtime

| Package | Why |
|---|---|
| `next` 16.4.0 | Framework (App Router, static generation, `next/image`, `next/font`, `next/og`). |
| `react`, `react-dom` 19.3.0 | Required by Next. |
| `server-only` | Build-time guard: any module importing it cannot be bundled for the browser. |
| `zod` 4.6.5 | Environment and form validation. |
| `@aletheia/aletheiadb` 0.1.0 | Our own database client (`aletheiadb://`). Vendored as `vendor/aletheia-aletheiadb-0.1.0.tgz`, packed from `../aletheia-db/sdk/typescript`, so the site builds on its own (Vercel). Re-pack after SDK changes. |
| `jose` 6.2.12 | Encrypted session tokens for the officers' workbench (ADR 0005). |
| `@node-rs/argon2` 2.2.2 | Argon2id password hashing (ADR 0005). Native; the Linux build is in the lockfile. |
| `pdfjs-dist` 6.3.289 | Draws CV previews in the workbench (ADR 0006). Loaded only when a preview opens. |
| `sharp` 0.35.5 | Used by `next/image` in production to resize and encode AVIF/WebP, and by `scripts/grade-images.mjs`. Its native libraries are added to the standalone trace in `next.config.ts`. |

No animation library: all motion is CSS plus one small IntersectionObserver island (`MotionController`).

## Development

| Package | Why |
|---|---|
| `typescript` 5.9.3 | Strict typing. TypeScript 7 was available but is not yet supported by Next's type tooling. |
| `tailwindcss`, `@tailwindcss/postcss` 4.3.3 | Utility CSS over the generated tokens in `src/styles/tokens.css`. |
| `eslint` 9, `eslint-config-next` 16.4.0 | Lint, including the Next, React, a11y and TypeScript rules and the import-boundary rule. |
| `vitest` 5.0.3 | Unit tests. |
| `playwright` 1.64.0 | Screenshot review (`scripts/screenshots.mjs`) and release audit (`scripts/audit.mjs`). |
| `@playwright/test` 1.64.0, `@axe-core/playwright` 4.13.0 | E2E, accessibility (axe) and visual regression suites in `tests/e2e/`. |
| `lighthouse` 13.5.0 | Performance budgets (`scripts/lighthouse.mjs`). |
| `@types/*` | Type definitions. |
