# ADR 0001: Stack and structure

- Status: Accepted
- Date: 2026-10-09

## Context

The brief (§8.1) asks for Next.js App Router, strict TypeScript, Tailwind over generated tokens, and the
repository's existing package manager. The sibling `aletheia-web` uses npm and Next 16.

## Decision

- Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
- npm, matching the repository.
- Tailwind CSS 4. Colour scales are generated in OKLCH by `scripts/tokens.mjs` into `src/styles/tokens.css` and exposed to Tailwind with `@theme inline`; the default palette is removed so only house colours exist.
- Manrope and IBM Plex Mono through `next/font/google`, self-hosted at build time (Latin and Latin Extended for Manrope).
- `output: "standalone"` for a long-lived Node server (brief §8.6).
- No animation library. Motion is CSS; one client island (`MotionController`) drives reveals and parallax.
- Structure follows brief §23, creating only folders that hold code today.

## Consequences

- First-load JavaScript is dominated by the Next/React runtime (≈165 KB gzipped). The brief's 130 KB budget cannot be met on this stack; see PROGRESS.md.
- TypeScript 7 is available but not used until Next supports it.
