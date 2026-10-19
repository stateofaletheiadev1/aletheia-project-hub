# 0001: Toolchain versions

Date: 2026-10-19. Status: accepted.

## Context

The brief asks for SvelteKit 2.x with Svelte 5 runes, `@sveltejs/enhanced-img`, pnpm and vanilla CSS. On this date SvelteKit 3.1.0 is the latest release, and `@sveltejs/enhanced-img` 1.0.0 requires Vite ≥ 8.0.12 and `@sveltejs/vite-plugin-svelte` 7.

## Decision

- SvelteKit **2.70.3** (latest 2.x, the version aletheia-explorer runs), Svelte 5.57.2, with Vite 8 and `vite-plugin-svelte` 7. Kit 2.70.3 supports both as peers.
- TypeScript 5.9.3, as in the sibling projects.
- ESLint 10 (ESLint 9 is deprecated; every plugin used supports 10).
- pnpm 11 (the brief's default when no lockfile exists). The esbuild install script is allowed in `pnpm-workspace.yaml`; it is needed by `tsx`.
- `@playwright/test` is pinned exactly, because the CI image tag must match it.
- `adapter-static` with `fallback: '404.html'` and strict prerendering.

## Alternatives

- SvelteKit 3: newer, but outside the brief's "2.x" and not yet used anywhere in the monorepo.
- npm, to match the siblings: rejected in favour of the brief's explicit default.

## Consequences

Moving to SvelteKit 3 later is a separate, deliberate upgrade. The CI image must be bumped together with `@playwright/test`.
