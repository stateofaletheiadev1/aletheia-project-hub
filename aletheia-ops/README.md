# Aletheia Government Operations

The private workbench behind the public record at [aletheiagov.org](https://www.aletheiagov.org).
Authorised officials draft, review, approve and version official records, and publish them to
the public record under explicit authority. Production address (not yet live):
`https://ops.aletheiagov.org`.

Specification: [`aletheia-ops-master-prompt.md`](aletheia-ops-master-prompt.md).
Status and history: [`docs/IMPLEMENTATION_LOG.md`](docs/IMPLEMENTATION_LOG.md).

## State

| Part | State |
|---|---|
| Discovery | Done: [`docs/discovery/`](docs/discovery/FINDINGS.md) |
| Design system, frame, archetypes | Built; reviewed at 375, 768, 1280 and 1600 px ([`docs/design/REVIEW.md`](docs/design/REVIEW.md)) |
| Workflow engine, policy, two-person rule | Built as pure code, unit-tested; not yet connected to storage |
| AletheiaDB atomic commit and append-only collections | Built and deployed (AletheiaDB 0.2.0) |
| Sign-in, invitations, MFA, sessions, officials and access, audit register | Built and tested end to end against a local AletheiaDB |
| Registers, composer, review, publication | Not built |

Not deployed yet, and not connected to the live database. Local development:

```sh
npm run db:local              # terminal 1: local AletheiaDB on 127.0.0.1:7791
npm run db:bootstrap:local    # once: schema, keys and .env.local
npm run admin:bootstrap -- "Ada Founder <ada@example.org>" "Ben Founder <ben@example.org>"
npm run dev                   # terminal 2
```

## Architecture

A modular monolith (ADR 0001). Dependencies point inwards:

```
src/app          routes and server actions (thin)
src/components   ui/ (owned components), patterns/ (register, folio, briefing…), frame/
src/domain       vocabulary, registers, institutions        — pure
src/policy       roles, permissions, two-person rule         — pure
src/workflow     versioned definitions and the engine        — pure
src/lib          time, diff, env, small helpers
tests/unit       Vitest; tests/fixtures holds specimen content for /design only
```

ESLint enforces the boundaries: `domain`, `policy` and `workflow` import nothing from React,
Next.js or the outer layers; routes and components never import adapters.

Decisions: [`docs/decisions/`](docs/decisions). Glossary: [`docs/GLOSSARY.md`](docs/GLOSSARY.md).
Permissions: [`docs/security/PERMISSION_MATRIX.md`](docs/security/PERMISSION_MATRIX.md).

## Working on it

Node 22 or later.

```sh
npm install
npm run dev          # http://localhost:3300; /design shows every component (not in production)
npm test             # unit tests
npm run typecheck
npm run lint
npm run build
npm run tokens       # after editing src/design/tokens.ts
npm run docs         # after changing the glossary, roles or workflow definitions
npm run screenshots  # captures docs/design/screenshots/ from a running server
```

Configuration: copy `.env.example` to `.env.local`. No variable is needed to run the design
reference locally.

## Conventions

British English. Manrope is the only typeface. Colours, sizes and spacing come only from
`src/design/tokens.ts`; a test refuses arbitrary Tailwind values. Status is never conveyed by
colour alone. Buttons say what they do. See the brief, Part IV.
