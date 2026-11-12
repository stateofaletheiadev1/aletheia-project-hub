# ADR-067: Event search by emitter, event type and topic
Status: Accepted
Date: 2026-11-12
Context: Every receipt carries its events (a transfer emits one with topics sender, recipient
and asset; monetary, registry, bridge, APN and contract operations emit their own), but the RPC
served them only inside a receipt fetched by transaction id. The explorer, wallets and
integrators could not ask "which events did this module emit", "every transfer of AEY" or
"everything involving this address" without scanning the chain. The `Events` column family was
reserved in the storage layer and unused.
Decision:
  1. **Index.** Node-local, never hashed into state, in the `Events` column family, written in
     the same batch that finalizes the block: `tag || subject || height u64 BE || index u32 BE ||
     event u16 BE` → empty, with tag `e` (emitter, 20-byte subject), `y` (event type) and `t`
     (each distinct topic, 32-byte subjects). The event itself is read from its receipt, so the
     index adds no second copy of event data.
  2. **Backfill.** On opening a data directory without `event_index_v1` in `Meta`, the node reads
     every stored receipt once and writes the entries; keys are idempotent, so an interrupted
     backfill simply runs again.
  3. **Query.** `getEvents {emitter?, eventType?, topic?, limit 1..100 (25), before?}` and
     `GET /api/v1/events?…`. At least one filter is required; every filter given must match. The
     node walks the most selective index given (topic, then type, then emitter), newest first,
     and checks each event against all the filters. One read examines at most 10,000 index
     entries; `next` (`"height:index:event"`) resumes after the last position examined, so a page
     may hold fewer than `limit` matches while more remain.
Consequences: event search costs one range read plus the receipts it touches. Index size is about
three keys per event plus one per extra topic. Only finalized events are indexed. Tests: filters,
paging, combined filters, REST parity and strict parameters against a scanning reference
(`crates/rpc/tests/rpc.rs`); a running node finds every transfer and answers identically after a
restart that ran the backfill (`crates/node/tests/rpc_http.rs`); the OpenRPC document and the
TypeScript SDK list the method (their contract tests).
