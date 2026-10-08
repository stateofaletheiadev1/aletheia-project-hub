# ADR-056: Public RPC: one service layer, strict JSON-RPC 2.0, REST, on Axum
Status: Accepted
Date: 2026-10-08
Context: Section 37 specifies REST under `/api/v1` and JSON-RPC 2.0 under `/rpc/v1` over one
service layer on Axum and Hyper, with strict protocol rules, decimal-string amounts, `AL:`
identifiers and rate limits. Axum and Hyper are new dependencies of the node; Section 5.5
asks for an ADR for supply-chain changes. They are not used by consensus, crypto, storage or
execution.
Decision:
  1. `crates/rpc` holds a `Backend` trait (finalized reads, submit, simulate), the service
     layer, the JSON-RPC dispatcher and the REST router. Both adapters call the same service
     methods with the same named parameters, so data, validation and errors match by
     construction; a parity test checks every shared query.
  2. JSON-RPC rules: version `2.0`; ids are strings or integers; named parameters only
     (positional arrays are `-32602`); unknown parameters and members are refused;
     notifications get no response; batches of 1 to 50 within 1 MiB; nesting at most 32; any
     `0x`-prefixed value is `-32602`; protocol errors travel in `data` as `{ code, name,
     detail }`. REST errors are `{ "error": { code, name, message, details } }` with HTTP
     400, 404, 409, 429 or 500.
  3. The node answers reads on its chain thread from finalized data (one `Rpc` request type),
     and submissions go through the same admission path as gossip. Simulation executes the
     transaction as the next block's first, against the tip, without committing.
  4. The server (Axum 0.8, HTTP/1.1) caps bodies at 1 MiB, gives each client IP a budget per
     second (default 50, configurable), and sends no CORS headers. `aletheiad` starts it when
     `[rpc] listen` is configured and stops it before shutting the node down: the server
     holds a handle to the chain thread, and shutdown waits for every handle to go.
Consequences: WebSocket subscriptions, the remaining methods (events, state proofs, validator
set, contract views, registry and bridge), API keys, OpenAPI and OpenRPC documents with their
contract tests, and peer counts in the status follow.
