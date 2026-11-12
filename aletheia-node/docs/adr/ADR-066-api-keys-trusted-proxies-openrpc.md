# ADR-066: API keys, trusted proxies, and the published OpenRPC description
Status: Accepted
Date: 2026-11-12
Context: Section 37 asks for API keys and machine-readable interface documentation. The RPC
server budgeted requests by the TCP peer's address only. Behind a reverse proxy (Mainnet Beta
runs nginx in front of the node) every client arrives from loopback, so all WebSocket messages
and all requests the proxy forwards share one budget; nginx's own per-visitor limit covered
HTTP, nothing covered WebSocket messages per visitor. Integrators (the explorer, exchanges) had
no way to get a larger budget than an anonymous visitor.
Decision:
  1. **Clients.** A request spends the budget of its API key when it presents one
     (`Authorization: Bearer <key>` or `X-Api-Key: <key>`), otherwise of its client IP.
  2. **Trusted proxies.** `[rpc] trusted_proxies = [...]` lists addresses whose
     `X-Forwarded-For` is believed. From one of them, the client IP is the right-most entry that is
     not itself a trusted proxy (what the proxy saw); entries further left are client-supplied and
     ignored. From any other peer the header is ignored. A malformed header leaves the peer's
     address. The WebSocket session keeps the client it was admitted as, so every message from a
     visitor spends that visitor's budget.
  3. **API keys.** Keys are 32 random bytes, written `alk_<64 hex>`, made offline by
     `aletheia-cli api-key new --name <n> [--requests-per-second <r>]`, which prints the key once
     and the `[[rpc.api_keys]]` entry. The node stores only
     `BLAKE3-derive-key("AletheiaChain 2026-11-12 RPC API key v1", key)` with a name and budget;
     configuration refuses a malformed hash, a zero budget, and duplicate names or hashes. A
     presented key is hashed and compared with every configured hash in constant time. An unknown
     key is refused with HTTP 401 `UNKNOWN_API_KEY`, so a mistyped key is noticed instead of
     silently falling back to the public budget. Keys only raise budgets: they grant no method
     an anonymous client lacks. Keys belong to servers; a key placed in a browser page is public.
  4. **OpenRPC.** `crates/rpc/openrpc.json` (OpenRPC 1.2.6) describes every method, its
     parameters, results and error codes, and is served by `rpc.discover` and
     `GET /api/v1/openrpc.json`. Dispatch reads each method's accepted parameter names from one
     table (`service::PARAMS`); a test fails if the document's methods, order, parameters or error
     codes differ from what the service enforces and returns.
Consequences: Mainnet Beta should set `trusted_proxies = ["127.0.0.1"]` when it next takes a
release, so that the node budgets each visitor itself. Tests: limiter unit tests (forwarded
addresses only from a trusted proxy, spoofed left-hand entries ignored, separate budgets, key
budget, unknown key refused); configuration parsing and refusals (`aletheiad`); a key made by the
CLI binary accepted by a running node over HTTP with its own budget, the public budget separate
and a wrong key answered 401 (`apps/aletheia-cli/tests/cli.rs`); the OpenRPC contract test
(`crates/rpc/tests/rpc.rs`).
