# ADR 0004: In-memory rate limiting for search

- Status: Accepted (until a shared store exists)
- Date: 2026-10-09

## Context

The brief (§14) sets search at 60 queries per minute per IP, in a shared store. §8.5 allows an
in-memory limiter only on a single long-lived Node process, and requires that to be documented.
No Redis/Valkey or platform KV is available yet, and the deployment is one Node server ([ADR 0001](0001-stack-and-structure.md)).

## Decision

- `src/proxy.ts` limits `GET /search?q=…` to 60 per minute per client, using a fixed-window counter in process memory (`src/server/security/rate-limit.ts`). Over the limit it returns `429` with `Retry-After`.
- Only requests with a query count; the empty search page and its prefetches do not.
- The client is the first address in `X-Forwarded-For`, so **the reverse proxy in front of the app must set that header** and strip any value sent by the client.
- Memory is bounded at 50,000 tracked clients; beyond that, new clients are refused until old windows expire (fail closed).

## Consequences

- Correct for exactly one server process. Counters reset on restart.
- Running two or more instances, or serverless, requires replacing the limiter with a shared store first.
- Covered by `tests/unit/rate-limit.test.ts` and the e2e test "search queries are rate-limited per client".
