# AletheiaDB integration

## State on 9 October 2026

**Not integrated.** The AletheiaDB source was expected at `aletheia-project-hub/aletheia-db/` and was not
present on the build machine. Phases 0 and 1 of AletheiaDB (types, config) exist in a separate local
repository; there is no HTTP API or SDK to integrate against yet. The owner is writing the AletheiaDB brief
separately.

Brief §1.8 forbids inventing database capabilities, so no adapter code, no contract tests and no write
paths were written.

## What the site does instead

All public record access goes through one server-only module, `src/server/records/public-records.ts`:

```ts
listPublished(kind, { limit }) -> { kind, source: "aletheiadb" | "unavailable", items }
lastPublishedAt() -> string | null
```

Today it returns `source: "unavailable"` with no items. Every register page renders a designed empty state
and says that the public record database is not yet connected. Nothing is faked, cached as fake data, or
held in memory as a stand-in.

`/api/health/ready` reports `recordStore: "not_configured"` and overall status `degraded`.

## When AletheiaDB has an API

1. Read the real API: endpoints, auth, query language, error shapes, consistency, concurrency, indexes, transactions.
2. Add `src/server/aletheiadb/client.ts` (the only module that speaks to the engine) and `src/server/repositories/*`.
   ESLint already forbids `app/` and `components/` from importing either.
3. Write `tests/contract/aletheiadb.spec.ts` against a disposable database.
4. Replace the body of `listPublished` with a call to a `publicRepository` that hard-codes `published` + `public`.
5. Switch registers to tag-based revalidation (`revalidateTag(tag, "max")` in Next 16) on publish and withdraw.

The Git-backed design rules in brief §8.4 (application-layer encryption, crypto-shredding, no per-request
writes) apply from the first write path.
