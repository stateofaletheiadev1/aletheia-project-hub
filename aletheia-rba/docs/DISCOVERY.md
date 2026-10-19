# Phase 0 Discovery: Reserve Bank of Aletheia website

Date: 2026-10-19. Author: Claude Code (implementing engineer), for Emeka Iwuagwu.

This report records what was found, not what is assumed. Where something could not be observed, it says so.

## 1. Repository audit

| Item | Finding |
|---|---|
| Project folder | `aletheia-rba/` did **not** exist. Greenfield. Created in this phase with `docs/` only; the SvelteKit scaffold is Phase 1. |
| Parent directory | `aletheia-project-hub`, an existing Git monorepo on `main` (clean at start; HEAD `59f7b33`). Per brief §0.0.4, commits go into this repository, scoped to `aletheia-rba/`. Remotes: `origin` pushes to GitHub (`stateofaletheiadev1/aletheia-project-hub`) and GitLab (`emeka.iwuagwu/aletheia-project-hub`). |
| Sibling projects (read-only) | `aletheia-web` (stateofaletheia.org; Next.js 16, Tailwind, npm), `aletheia-gov` (aletheiagov.org; Next.js 16.4, npm, `vercel.json`), `aletheia-ops` (Next.js 16.4, npm), `aletheia-explorer` (SvelteKit 2.70.3, Svelte 5.57.2, Vite 7.3.7, TypeScript 5.9.3, npm, `adapter-node`, `@fontsource-variable/manrope` 5.3.0), `aletheia-node` (StableChain, Rust), `aletheia-db` (Rust), `currency-proto` (banknote artwork). |
| Installed tools | Node v24.11.1, npm, pnpm 11.1.3, Python 3.14. No ImageMagick. |
| Package manager | No lockfile exists in `aletheia-rba/`, so per brief §3.1 the default is **pnpm**. Note: every sibling uses npm. See OPEN_QUESTIONS Q11. |
| Styling in siblings | aletheia-web: Tailwind with the same national palette as the brief (navy `#15294A`, parchment `#F4EEDF`, gold `#C49A4E`, laurel `#2F6B4F`, gold-ink `#A87D34`). aletheia-explorer: vanilla CSS. The brief mandates vanilla CSS; nothing to inherit or override. |
| Manrope | Used across all sibling sites. The explorer self-hosts `@fontsource-variable/manrope` 5.3.0, the same approach the brief specifies. |
| Deployment of siblings | Vercel via the Vercel CLI (`vercel deploy --prod --yes` in the site folder); a git push alone does not deploy. Hosting for `rbaletheia.org` is not decided (OPEN_QUESTIONS Q1). |
| CI in parent repo | `.gitlab-ci.yml` at the root (GitLab CI). There is no `.github/workflows/`. See OPEN_QUESTIONS Q12. |
| Host disk | C: is 93% full (17 GB free of 236 GB). The `node_modules` footprint should be kept modest; pnpm's content-addressed store helps. |

## 2. Reference site study

Method: each URL was fetched with a text-extraction fetcher, which returns page text and link structure but **not** rendered CSS, motion or images. Visual observations (typography, palette, motion) therefore come from the **source code of the same sites**, which lives in this monorepo (`aletheia-web` serves stateofaletheia.org, `aletheia-gov` serves aletheiagov.org). Motion, scroll behaviour and image treatment were **not observed in a browser** during this phase.

### 2.1 https://www.stateofaletheia.org (primary)

- **Reachable:** yes (2026-10-19).
- **Navigation:** utility bar (skip link, site name and motto, ⌘K search, "Public Ledger Audit" → /transparency, language selector, "Officer Portal"); a "network pulse" banner (slot time, statutory parity, protocol version, "Live Proofs"); a main header with the coat of arms, wordmark and eight items (Aletheia, Government, Citizenship, E-Residency, Immigration, Development, Economy, Security), then "Sign In" and an "Apply" button.
- **Footer:** three link columns ("Government & Law", "Civic & Economy", "Territory & Security"), an arms-and-flags block, a motto line, a legal row (Privacy, Terms of Use, Accessibility, FAQ, Contact), five official languages, and "© 2026 The Sovereign Covenant State of Aletheia. All rights reserved."
- **Typography and palette (from source, `aletheia-web/app/globals.css`, `tailwind.config.ts`):** Manrope only ("Manrope is the sovereign typeface of Aletheia — enforce at every level"). House rules in the stylesheet header: "solid colour, honest borders, one typeface (Manrope), no glow, no glass for decoration, no moving gradients. Gold is an accent drawn from the flag, used as a line or a fill, never as a haze." Navy heroes over parchment canvas; uppercase tracked eyebrows (`tracking-[0.2em]`, 11px, bold).
- **Verbatim statements (homepage):**
  - "Statutory Parity: 1 AEY = 1.00 EUR"
  - "AEY is pegged 1:1 with EUR. Cryptographic balance sheet proofs published every epoch."
  - "The AEY is redeemable and mathematically guarded by twelve supply invariants."
  - "The node halts rather than print unbacked currency."
  - "Byzantine-fault-tolerant ledger with 500 ms slots, AEY reserve backing invariants,"
  - "Aletheia never presents future aspiration as established physical fact."
  - "Aletheia is a maritime republic in its founding phase."
  - Footer: "A sovereign, European-oriented maritime republic founded upon immutable records, provable reserves, and the rule of covenant law."

### 2.2 https://www.stateofaletheia.org/aey/paper-currency (banknotes)

- **Reachable:** yes. Source: `aletheia-web/app/[lang]/aey/paper-currency/page.tsx`.
- **Verbatim statements:**
  - Status badge: "Planned"
  - "The Aletheian Guilder in paper: five engraved denominations that sit alongside digital AEY on the StableChain as legal tender in the Republic, and can be exchanged for EUR, GBP or USD abroad."
  - "Series 2025 A — planned issue." / "Issued at Novalis"
  - "These designs are approved for the first AEY banknote series under the Currency & Digital Settlement Act 2026."
  - "Once issued by the Aletheian Reserve Bank, the notes are legal tender alongside digital AEY"; "issue dates will be announced in the Official Gazette."
  - "Statutory Parity: 1 AEY = 1.00 EUR"; "Notes and StableChain AEY convert 1:1 at par."
  - "Every AEY, engraved or on the Aletheia StableChain, is backed by the same audited reserve."
  - "Every note is issued by the Aletheian Reserve Bank, the central bank of the Sovereign Covenant State, and bears “100% Reserve Backed — StableChain Invariants I1–I12”, binding the design to the supply ledger."
  - Design descriptions per note (portrait, colourway, motifs) in the `BANKNOTES` array, e.g. 100 AEY: "St. Brendan of Clonfert", "Deep Forest & Burnished Gold".
  - Security features described: latent images, microprint and guilloche, dual serial numbering. None is stated to be physically implemented.

### 2.3 https://www.aletheiagov.org (secondary)

- **Reachable:** yes. Source: `aletheia-gov/src/content/institutions.ts`.
- **Navigation:** Government, Institutions, Programmes, Opportunities, Documents, Record (a disclosure listing Decisions, Dispatches, Public Finance, Appointments, Directory, Events), then Search, Sign in, Register interest. Body sections are numbered "§ 01 … § 06", the folio device the brief asks for. Four-column footer (The Government, The Record, Take Part, This Website).
- **Typography (source):** Manrope plus IBM Plex Mono; easing tokens `--ease-tide: cubic-bezier(0.22, 1, 0.36, 1)` and `--ease-standard`.
- **Verbatim statements:**
  - "The Government of Aletheia is a founding government-in-formation."
  - "Aletheia does not currently hold recognized territory or international recognition."
  - "Institutions described here are proposed or in formation unless marked Operational."
  - Aletheia Monetary Authority (status **proposed**): "Issues the Aletheian Guilder (AEY) under published reserve rules, overseen by a Monetary Board."; "It is deliberately separate from the Treasury: the body that issues money does not spend it."; "No reserves, pegs, payment rails or banking relationships are operational. Any that become operational will be published here with evidence."
  - Aletheia StableChain (status **in development**): "The settlement ledger for the Aletheian Guilder and the public record."; "No milestones published yet."

### 2.4 Other primary sources in this repository

- `aletheia-node/docs/spec/MASTER.md` (StableChain specification): AEY is "the Aletheian Guilder, the national currency of the Sovereign Covenant State of Aletheia"; code `AEY`, 18 decimals; reference currency **EUR** with an "indicative EUR-denominated" reserve composition and redemption rules in its Section 18. This is a design specification, not evidence that any reserve exists.

## 3. Conflicts with the brief (blocking)

The brief's §2.2 truth model and the reference material disagree. The brief governs what this site says. These conflicts still need decisions from the State, because they affect the institution's name and whether the banknote artwork can be shown.

1. **The institution's name.** Three names are in use: "Reserve Bank of Aletheia" (this brief, domain `rbaletheia.org`), "Aletheian Reserve Bank" (stateofaletheia.org and the banknote artwork) and "Aletheia Monetary Authority" (aletheiagov.org). OPEN_QUESTIONS Q2.
2. **Monetary model.** The brief says the preferred direction is fiat, with no euro backing. stateofaletheia.org states a statutory 1:1 EUR parity, 100% reserve backing and redeemability. The StableChain spec designs AEY around a EUR reference and reserves. aletheiagov.org says AEY is issued "under published reserve rules" and that no reserves or pegs are operational. No document adopting either model was found. Status therefore stays `proposed`, as the brief's default. OPEN_QUESTIONS Q3.
3. **Banknote artwork carries forbidden claims.** Observed directly in the image files:
   - **100 AEY back** (both the original and the revised artwork sets) and **1 AEY back** (revised set; the original set not checked): "100% RESERVE BACKED · STABLECHAIN INVARIANTS I1–I12". The 1 AEY back also reads "SERIES 2025 A".
   - Every observed note names the issuer as "Aletheian Reserve Bank — Central Bank of the Sovereign Covenant State of Aletheia".
   - **100 AEY front:** "ISSUED AT NOVALIS – NORTH SEA CROWN TERRITORY · MMXXV ANNO COVENANTI II" and a signature "M. E. Valerius, Covenant Secretary".
   - **5 AEY back** reads "500 ms FINALITY", and the **10 AEY back** carries a StableChain ledger motif. The **20 AEY back** shows an eagle seal and an eye-in-triangle emblem.
   - Not yet inspected: the 5, 10 and 20 fronts, and the 1 front, at full resolution.
   Showing these images unmodified would put "100% reserve backed" on a site whose first rule is that Aletheia holds no reserves. The text is inside the image, so the claims linter cannot catch it. OPEN_QUESTIONS Q4.
4. **stateofaletheia.org itself** makes claims that the brief's linter forbids ("1 AEY = 1.00 EUR", "100% Reserve Backed", "legal tender", "redeemable"). Out of scope to change here, but this site will link to it, and readers will compare the two. OPEN_QUESTIONS Q5.
5. **"Republic".** stateofaletheia.org calls Aletheia "a maritime republic". The State's name is the Sovereign Covenant State of Aletheia. This site will use the full name and avoid "republic".

## 4. Truth model as encoded for launch (unless decisions above change it)

| Subject | Status | Basis |
|---|---|---|
| AEY (Aletheian Guilder) | `proposed` | Brief §2.2; aletheiagov.org |
| Fiat monetary framework | `proposed` | Brief §2.2; no adoption document found |
| Banknote designs 1, 5, 10, 20, 100 AEY | `proposed` | Artwork exists in `currency-proto/` |
| Banknote issuance | `not_established` | Brief §2.2; aletheiagov.org "No reserves, pegs, payment rails or banking relationships are operational" |
| StableChain | `in_implementation` | aletheiagov.org "In development"; node software under construction in `aletheia-node/`. Its role for AEY: "the settlement ledger for the Aletheian Guilder" (aletheiagov.org), stated as intended. |
| Euro and foreign reserves | `not_established` | Brief §2.2; aletheiagov.org |
| Euro convertibility / redemption | `not_established` | Brief §2.2 |
| Correspondent banking, licences, audits | `not_established` | Brief §2.2; aletheiagov.org |
| Governance, leadership, founding date | not populated | No sourced appointments to the bank |

## 5. Gaps in the brief itself

The brief was received truncated at 50,000 characters, partway through §10 ("Do not use `BankOrCreditUnion`, `Financial…"). §10 onwards (the rest of the JSON-LD rules, security headers, performance budgets and Lighthouse assertions in §13, the test matrix in §15, and delivery) did not arrive. `docs/ENGINEERING_BRIEF.md` holds the text as received. OPEN_QUESTIONS Q13.
