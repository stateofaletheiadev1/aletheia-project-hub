# ADR-0003: JSON-RPC as CORS simple requests

Status: Accepted · 2026-11-03

**Context.** `rpc.stateofaletheia.org` adds `Access-Control-Allow-Origin: *` but answers the CORS preflight
(`OPTIONS`) with 405. A browser cannot send `Content-Type: application/json` POSTs; the node does not
inspect the content type.

**Decision.** The client sends JSON-RPC bodies as `text/plain;charset=UTF-8`, which needs no preflight, and
GETs REST without custom headers. No proxy exists in production. In development a Vite proxy at
`/__devnet` reaches a local `aletheiad`, which sends no CORS headers at all.

**Consequences.** If nginx later answers preflights (snippet in the discrepancy register), nothing changes.
