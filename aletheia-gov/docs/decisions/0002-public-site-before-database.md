# ADR 0002: Build the public site before the database exists

- Status: Accepted
- Date: 2026-10-09

## Context

AletheiaDB has no API yet, and its source was not available on the build machine. The owner asked for the
public website to be built now and will brief AletheiaDB separately. The brief forbids fake persistence
(§1.6), invented database capabilities (§1.8) and fabricated records (§1.2).

## Decision

1. **Structural content lives in typed modules** (`src/content/*`): the institutional framework, programmes, founding phases and principles, drawn from the National Blueprint and listed for review in `docs/content-review.md`. This is the published framework, not database records, so it carries no `AGV-` references.
2. **Record content goes through one server-only boundary** (`src/server/records/public-records.ts`). Until AletheiaDB is integrated it reports `source: "unavailable"` and no items. Pages render designed empty states that show the reference format and explain what will appear.
3. **No authentication, applicant portal or workbench** is built yet. `/sign-in` says accounts are not open. Building auth without a store for sessions, MFA secrets and audit events would mean either fake persistence or a throwaway store.

## Consequences

- The public site is complete and truthful today, and statically generated.
- Phases 3, 4, 6 and 7 of the brief wait for AletheiaDB. The boundary means pages do not change when it arrives: only `public-records.ts` does.
