# Contrast

Measured ratios for every token pair used for text (WCAG 2.2, relative luminance).
Generated from `scripts/tokens.mjs` with `scripts/color.mjs`; asserted by `tests/unit/contrast.test.ts`.

| Foreground | Background | Use | Ratio | AA (4.5) |
|---|---|---|---|---|
| `ink-900` #141A24 | `parchment-100` #F4EEDF | Body text | 15.08:1 | Pass |
| `ink-700` #38404F | `parchment-100` #F4EEDF | Secondary text, labels | 9.01:1 | Pass |
| `ink-600` #4A5263 | `parchment-100` #F4EEDF | Muted text | 6.77:1 | Pass |
| `ink-500` #636C7C | `parchment-100` #F4EEDF | Margin labels, meta | 4.57:1 | Pass |
| `gold-700` #7F6026 | `parchment-100` #F4EEDF | Gold text on parchment | 5.03:1 | Pass |
| `green-700` #23563E | `parchment-100` #F4EEDF | Operational seal | 7.34:1 | Pass |
| `navy-800` #15294A | `parchment-100` #F4EEDF | Links, emphasis | 12.53:1 | Pass |
| `parchment-50` #FBF8F1 | `navy-950` #0B1628 | Headings on navy | 17.07:1 | Pass |
| `parchment-200` #ECE4D0 | `navy-950` #0B1628 | Text on navy | 14.29:1 | Pass |
| `parchment-300` #E4D9C0 | `navy-950` #0B1628 | Muted text on navy | 12.92:1 | Pass |
| `parchment-400` #CEC3AA | `navy-950` #0B1628 | Labels on navy | 10.36:1 | Pass |
| `gold-300` #E6C183 | `navy-950` #0B1628 | Gold links on navy | 10.62:1 | Pass |
| `gold-400` #D6AD66 | `navy-950` #0B1628 | Section marks, seals on navy | 8.65:1 | Pass |
| `gold-500` #C49A4E | `navy-950` #0B1628 | Seal Gold on navy | 6.97:1 | Pass |
| `green-300` #8EC2A6 | `navy-950` #0B1628 | Operational seal on navy | 8.98:1 | Pass |
| `parchment-300` #E4D9C0 | `navy-900` #0F1F39 | Text on hovered rows | 11.75:1 | Pass |
| `gold-500` #C49A4E | `parchment-100` #F4EEDF | Seal Gold on parchment | 2.25:1 | Fail: used for rules and marks only, never text |

## Deviation from the brief

The brief suggests `--gold-700: #8A6A2F` for gold text on parchment. It measures **4.34:1** on
`parchment-100`, which fails AA for body-size text. The generator sets `gold-700` to `#7F6026`
(5.03:1), which keeps the hue and passes.

## Decorative text

The faint reference patterns inside empty states (`AGV-DOC-····-····`) are `aria-hidden` illustrations
of the record format, not content, and are exempt.
