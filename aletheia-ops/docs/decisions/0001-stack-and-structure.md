# ADR 0001: Stack and structure

- Status: Accepted
- Date: 2026-10-15

## Decision

- A separate Next.js application in `aletheia-ops/`, deployed as its own Vercel project to
  `ops.aletheiagov.org`. It shares no runtime with the portal; it reaches the portal only through
  the publication endpoint (ADR 0003).
- The same versions as the portal, so the two apps move together: Next.js 16.4, React 19.3,
  TypeScript 5.9 (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS 4.3, Zod 4.6, Vitest 5,
  Playwright 1.64, ESLint with `eslint-config-next`.
- A modular monolith in the layout of the brief (§37). `domain/`, `workflow/` and `policy/` are
  pure TypeScript with no framework or I/O imports. `services/` orchestrate through `ports/`.
  `adapters/` hold the only code that talks to AletheiaDB or the portal. Lint rules enforce the
  direction: `app/` and `components/` never import `adapters/`; `domain/`, `workflow/` and
  `policy/` import nothing outside themselves and `lib/`.
- No component library for appearance. Interaction uses native elements (`<dialog>`,
  `popover`, `<details>`), as the portal does; a library is added only for behaviour native HTML
  cannot give, and is restyled.
- Icons: Lucide, 1.5 px stroke.
- The AletheiaDB SDK is vendored as a tarball (`vendor/`), because Vercel builds this folder
  alone.
