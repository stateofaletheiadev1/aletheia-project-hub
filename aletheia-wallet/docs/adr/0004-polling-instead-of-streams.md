# ADR-0004: Polling instead of WebSocket; activity without an index

Status: Fallback only since node ADR-064 (WebSocket `/ws/v1`, `getAccountHistory`); applies to nodes without them

**Context.** No WebSocket, event stream, account history or OpenRPC endpoint exists. `getTransaction`
returns only finalized transactions.

**Decision.** Network status is polled every second (paused while the tab is hidden) and drives the seal's
heartbeat; heights that stop advancing for 6 s turn it amber. Submitted transfers are tracked by polling
`getTransaction` with backoff (0.6 s → 4 s) until found, or declared expired only after the finalized slot
passes the transfer's expiry and a last lookup misses. Activity is what this wallet submits plus transfers
found by scanning only the blocks in which a balance changed (at most ~10 minutes back), paced under
10 requests a second; the full history is linked on the Explorer.

**Consequences.** One idle wallet costs about 1.4 requests a second, well under nginx's 20 r/s per IP.
