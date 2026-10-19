# Verification log

Only checks that were actually run are recorded here, with their results.

## Phase 1: foundation (2026-10-19)

`pnpm verify` exit 0 on Windows 11, Node 24.11.1, pnpm 11.1.3: svelte-check 0 errors / 0 warnings; ESLint and Prettier clean; Vitest 23/23; build; claims-lint clean (4 source files, 2 built pages); linkinator 8 links OK; Playwright 4/4 (Chromium and WebKit, desktop and mobile) with axe WCAG 2.2 AA, no violations. `pnpm audit`: 1 low, no high or critical.

## Phase 2: design system (2026-10-19)

### Contrast (WCAG 2.x formula; `tests/unit/contrast.test.ts` reads `tokens.css`)

| Pair                            | Ratio   | Rule                               |
| ------------------------------- | ------- | ---------------------------------- |
| Ink on parchment                | 15.08:1 | All text                           |
| Navy on parchment               | 12.53:1 | All text; focus rings on parchment |
| Ink-muted on parchment          | 6.78:1  | Secondary text                     |
| Gold-ink `#7E6029` on parchment | 5.05:1  | Gold-toned text                    |
| Laurel on parchment             | 5.44:1  | Text, sparingly                    |
| Parchment on navy               | 12.53:1 | All text                           |
| Parchment-400 on navy           | 8.37:1  | Muted text on navy                 |
| Gold on navy                    | 5.58:1  | Labels; focus rings on navy        |
| Gold on parchment               | 2.25:1  | Ornament only, never text          |

**Deviation from the brief:** its `--c-gold-ink: #8A6A2E` measured **4.34:1** on parchment, below the 4.5:1 the brief requires. It was darkened to `#7E6029` (5.05:1).

### Styleguide (`pnpm test:styleguide`, dev server)

12/12 passed on Chromium and WebKit: no horizontal overflow at 375, 768, 1280 and 1600 px; axe WCAG 2.2 AA no violations (with reduced motion); every listed text pair passes. Axe first flagged the gold-on-parchment sample, which had been rendered as "Aa" text; it is now shown as a rule.

Screenshots at 1280 and 375 px were reviewed by eye.

### Known limits

- The styleguide route's JS chunk is still emitted in production builds; the route itself returns 404 and is never prerendered or linked.
