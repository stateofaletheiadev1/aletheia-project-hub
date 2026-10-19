# Asset inventory and provenance

Banknote images are published only with a SPECIMEN overprint (decision Q4). `scripts/specimen.ts` builds them from the revised originals into `src/lib/assets/banknotes/aey-<d>-<front|back>.jpg` (1248 × 832, JPEG q90). No un-overprinted copy is placed in the site.

Dimensions were measured from the file headers on 2026-10-19.

## Banknotes

There are three versions of the same series in the monorepo:

| Set                                      | Path                                                                                    | Format | Dimensions     | Notes                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Original                                 | `currency-proto/<d> AEY <Front\|Back>.jpg`                                              | JPEG   | 1168 × 784     | Darker grounds. No issuer line; the 100 AEY back reads "100% RESERVE BACKED". Committed to git.                                              |
| Revised (highest resolution)             | `currency-proto/new curr/<d> AEY <Front\|Back>.jpg`                                     | JPEG   | **1248 × 832** | Lighter grounds; every note names "Aletheian Reserve Bank". Committed to git.                                                                |
| Web copies (live on stateofaletheia.org) | `aletheia-web/public/images/currency/aey-<d>-<front\|back>.webp` (+ `-thumb` 480 × 322) | WebP   | 1168 × 784     | Revised set, scaled, with a 4 px centre crop and a gamma lift on 1-front/back, 100-front/back and 20-back (commit `fc75667`). Not originals. |

All 10 sides (front and back for 1, 5, 10, 20, 100) exist in every set. Aspect ratios differ slightly between sets: 1248 × 832 is exactly 3:2 (1.5), while 1168 × 784 is about 1.490. The gallery will read the ratio from the files it uses, never hard-code it.

The highest-resolution originals are the revised set at 1248 × 832. That is modest for a zoom viewer: at 2× density it fills a 624 px-wide slot. A higher-resolution master is requested (Q6).

| Asset                                | Source                                                                 | Format | Intrinsic       | Licence / authorisation                                                            | Used where                |
| ------------------------------------ | ---------------------------------------------------------------------- | ------ | --------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| 1, 5, 10, 20, 100 AEY front and back | `currency-proto/new curr/` → `src/lib/assets/banknotes/` (overprinted) | JPEG   | 1248 × 832 each | State-owned artwork; use with overprint approved by Emeka Iwuagwu, 2026-10-19 (Q4) | Banknotes, home, currency |

### Text observed inside the artwork (relevant to claims)

| Note side                        | Text that conflicts with the brief                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 back (both sets)             | "100% RESERVE BACKED · STABLECHAIN INVARIANTS I1–I12" (top and bottom borders)                                                                                                   |
| 1 back (revised set)             | "100% RESERVE BACKED — STABLECHAIN INVARIANTS I1–I12 · SERIES 2025 A"                                                                                                            |
| 100 front (revised set)          | "ISSUED AT NOVALIS – NORTH SEA CROWN TERRITORY · MMXXV ANNO COVENANTI II"; signature "M. E. Valerius, Covenant Secretary"                                                        |
| All observed sides (revised set) | "Aletheian Reserve Bank — Central Bank of the Sovereign Covenant State of Aletheia"                                                                                              |
| 5 back (revised set)             | "500 ms FINALITY" (StableChain claim, not a reserve claim)                                                                                                                       |
| 5 front, 20 front (revised set)  | "100% RESERVE BACKED — STABLECHAIN INVARIANTS I1–I12"; the 5 front also "Series 2024 · A1", "Authorized by Sovereign Covenant", "Chancellor's Signature", "Aletheia Mint · 2024" |
| 1 front (revised set)            | "Issued at Novalis – North Sea Crown Territory · MMXXV", "Covenant Secretary" signature, "Series 2025 A"                                                                         |
| 10 front (revised set)           | "Series 2024 · Aletheian Mint", "Issued under the authority of the Sovereign Covenant"; unnamed portrait (Q15)                                                                   |

## Emblem / coat of arms

| Asset               | Source                                                                                     | Format | Intrinsic                  | Licence / authorisation | Used where                                  |
| ------------------- | ------------------------------------------------------------------------------------------ | ------ | -------------------------- | ----------------------- | ------------------------------------------- |
| Coat of arms        | `aletheia-web/public/coat_of_arms_transparent.png` (identical bytes to `coat_of_arms.png`) | PNG    | to be measured when copied | State-owned             | Masthead, footer, OG images, JSON-LD `logo` |
| Coat of arms, sized | `aletheia-explorer/static/brand/arms-{180,360,720}.png`                                    | PNG    | 180 / 360 / 720 px         | State-owned             | Candidate source for favicons               |
| Arms (gov)          | `aletheia-gov/public/brand/arms.png`                                                       | PNG    | to be measured             | State-owned             | Reference                                   |

**No vector (SVG) master of the arms exists in the repository.** The raster will be used at native quality, and a vector master is requested (Q6). No substitute emblem will be drawn.

## Photography

None. No licensed photography was found, and none is needed: the banknotes and procedural guilloché carry the visual identity.

## Fonts

| Asset            | Source                                                                          | Licence                   |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------- |
| Manrope Variable | npm `@fontsource-variable/manrope` (version 5.3.0 is used by aletheia-explorer) | SIL Open Font License 1.1 |
