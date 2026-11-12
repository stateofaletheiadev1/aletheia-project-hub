# Motion

Tokens: `--dur-instant` 90 · `--dur-quick` 160 · `--dur-base` 220 · `--dur-considered` 360 ·
`--dur-ceremony` 1100 ms; `--ease-ink` (settle), `--ease-paper` (page turn), `--ease-seal` (press).
Only transform, opacity, clip-path and stroke-dashoffset animate.

| ID   | Where            | What it tells you                                                             |
| ---- | ---------------- | ----------------------------------------------------------------------------- |
| M-01 | `ContourField`   | atmosphere: 64 s drift, ≤ 12 px parallax; off when reduced                    |
| M-02 | `.settle`        | hierarchy: eyebrow → title → data → actions                                   |
| M-03 | `ActivityLedger` | a new row: the rule draws, then ink; FLIP for the rest                        |
| M-04 | `Denomination`   | a balance changed: digits roll per place; final value announced               |
| M-05 | `:focus-visible` | focus: a gold hairline drawn in                                               |
| M-06 | `Identifier`     | copied: gold underline, icon becomes a check, "Copied" for 2 s                |
| M-07 | View Transitions | page turn; rail and seal persist as shared elements                           |
| M-08 | `.unfold`        | the review sheet opens from its top                                           |
| M-09 | `ThemeToggle`    | theme: circular reveal from the toggle                                        |
| M-10 | `NetworkSeal`    | one band segment per finalized block observed; amber and stopped when stalled |
| M-11 | `RuledSkeleton`  | loading: real rules, one slow ink wash                                        |
| M-12 | `TextField`      | invalid input: one 2 px shake, oxblood rule                                   |

## Signature moments

- **S-1 Entrance** — survey lines draw (1.2 s), arms rise, eyebrow tightens 0.4 → 0.14 em, seal pulses with
  the live height, actions last (1.8 s). Once per session; any key or click skips.
- **S-2 Certificate** — masked words, vellum lifts word by word (40 ms), hold 1.2 s to confirm; four
  random places verified, each pressing into its cell.
- **S-3 Seal** — the ring traces while Argon2id runs (honest: "intentionally slow"); the seal presses on
  success; on unlock it breaks into halves (≤ 700 ms) before the ledger opens.
- **S-4 Instruction to Transfer** — guilloché header, fields decoded from the bytes, hold 1 s to sign, then
  the stamp "Signed locally · digest …".
- **S-5 Finality** — Signed → Submitted → Accepted → Finalized, moved only by real answers; amber note
  when slow; oxblood at the failing station; laurel seal on finality.

Reduced motion (system or setting): movement becomes ≤ 150 ms opacity; drift, roll, ceremonies and shakes
are off; every state still has words. The E2E suite runs with full motion; axe waits for motion to settle.
