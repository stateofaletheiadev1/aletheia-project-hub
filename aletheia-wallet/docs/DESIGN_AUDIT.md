# Design audit (Phase 0)

**Operations (`aletheia-ops`).** Tokens in `src/design/tokens.css`: Night Ink `#0B1628` (masthead,
theme-color), Covenant Navy `#15294A` (authority, strong rules), parchment `#FBF8F1`/`#F4EEDF`/`#E4D9C0`,
seal gold `#C49A4E` with `#7F6026` for gold text, laurel `#23563E`, amber `#7A4D00`, brick `#9A2E21`. Radii
2/4/6 px; durations 120–240 ms on `cubic-bezier(0.22, 1, 0.36, 1)`; overline type 11 px/700/0.1em. Contour
fields: three 1600×1000 SVGs (25–37 KB), single-colour strokes ~0.8 px with heavier index lines, light and
ink variants, laid under content at low opacity. The arms: a 720×886 PNG, used small beside wordmarks and
large on ceremonial pages, never redrawn.

**Explorer.** Royal-blue dashboard (ADR-060), Manrope plus a monospace for hashes, identifiers grouped and
middle-truncated, lighter fractions in amounts, a guilloché seal on block pages, gold star for finality.

**What the wallet takes.** The palette values, the arms, Manrope, the eyebrow, the hairline-and-rule
grammar and the contour language — with its own generated terrain. **What it leaves.** The explorer's
blue tiles and monospace: identifiers here are Manrope with tabular numerals and slashed zero.
