# 0002: Claims lint on built pages

Date: 2026-10-19. Status: accepted.

## Context

The brief (§2.3) requires `scripts/claims-lint.ts` to scan both the source and the built HTML, and to allow a match only on a line with `claims-lint-allow: <reason>`. Comments do not survive the build, so an allowed source line (for example the negated FAQ answer "AEY is not legal tender") would fail in `build/`. The brief's `verify` script also ran the linter before the build, so the built pages were never scanned.

## Decision

- **Source** (`src/**/*.{svelte,ts,md}`): the whole file is scanned, so a phrase split across lines is still caught. A match is allowed when its first or last line carries `claims-lint-allow:` followed by a reason, in any comment style.
- **Built HTML** (`build/**/*.html`): only visible text is scanned. Script, style, template and comment content is removed, tags become spaces and common entities are decoded. Text inside an element with a non-empty `data-claims-allow="<reason>"` attribute is exempt. Components that render allowed text (such as a negated FAQ answer) set this attribute from the content entry.
- `verify` runs `lint:claims` **after** `build`.
- Rules live in `scripts/claims-rules.ts` (pure, unit-tested); `scripts/claims-lint.ts` is the CLI.

## Alternatives

- Scanning the raw HTML including scripts: JSON-LD would repeat allowed FAQ answers and fail with no way to mark them. Source scanning already covers every authored string.
- Matching allowed source lines against the output by text: brittle once markup splits a sentence.

## Consequences

Text inside images (the banknote artwork) cannot be linted. That is handled by the specimen overprint decided in `OPEN_QUESTIONS.md` (Q4).
