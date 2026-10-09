# Dependencies

Every dependency, with the reason it is here. Versions are pinned in `package.json` and `package-lock.json`.

## Runtime

| Package | Why |
|---|---|
| `next` 16.4.0 | Framework (App Router, static generation, `next/image`, `next/font`, `next/og`). |
| `react`, `react-dom` 19.3.0 | Required by Next. |
| `server-only` | Build-time guard: any module importing it cannot be bundled for the browser. |
| `zod` 4.6.5 | Environment validation now; entity schemas when the data layer lands. |
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
