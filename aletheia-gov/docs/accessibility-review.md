# Accessibility review

Target: WCAG 2.2 AA (brief §17). Date: 9 October 2026. Build: production, Chromium 153.

## Automated

| Check | Scope | Result |
|---|---|---|
| axe-core 4.13 (`tests/e2e/a11y.spec.ts`), tags wcag2a/aa, 21a/aa, 22aa | 29 routes × 390 px and 1280 px | **0 violations of any impact** |
| Lighthouse accessibility category | 6 key routes, mobile | **100** on every route |
| Text contrast (`tests/unit/contrast.test.ts`) | Every token pair used for text | All ≥ 4.5:1 ([contrast](design/contrast.md)) |

Lighthouse flagged one issue that axe does not cover: the home link's accessible name did not start with
its visible text ("label-content-name-mismatch"). Fixed: the visible words are the name, with ", home"
added for screen readers.

## Keyboard (automated in `tests/e2e/keyboard.spec.ts`)

| Behaviour | Result |
|---|---|
| Skip link is the first Tab stop, becomes visible, moves focus to `#main` | Pass |
| 25 consecutive Tab stops on the homepage all show a visible outline | Pass |
| After navigating, focus moves to the new page's heading | Pass |
| Record menu opens with Enter, closes with Escape | Pass |
| Mobile drawer: focus stays inside, page scroll locked, Escape closes, focus returns to Menu | Pass |
| Search works from the keyboard | Pass |
| Programme rail: previous/next buttons, disabled at the ends | Pass |

## Resilience (`tests/e2e/resilience.spec.ts`)

| Behaviour | Result |
|---|---|
| With JavaScript disabled, no heading, paragraph or list item is hidden | Pass |
| With JavaScript disabled, search works as a plain form | Pass |
| With reduced motion, reveals and parallax apply no transforms | Pass |

## Checked during design review

- Status is never colour alone: each status has its own glyph and a written label.
- One `h1` per page on all 26 routes at four widths (`scripts/audit.mjs`).
- No horizontal scroll at 390, 768, 1280 or 1728 px on any route (`scripts/audit.mjs`).
- Focus outline: 2 px navy on parchment, 2 px Seal Gold on navy, 2 px offset (by design; presence tested above).
- The Menu, Close and rail buttons are 44 px tall (by their CSS). Other targets have not been measured.

## Not yet done

- A screen-reader pass (NVDA and VoiceOver) by a person.
- Layout at 320 px wide and at 400 % zoom: not yet checked.
- Measuring every touch target against the 24 × 24 px minimum.
- A review by a disabled user.

The accessibility statement on `/accessibility` does not claim conformance until these are complete.
