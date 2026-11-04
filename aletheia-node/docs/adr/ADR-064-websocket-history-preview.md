# ADR-064: WebSocket subscriptions, account history, unsigned simulation previews
Status: Accepted
Date: 2026-11-04
Context: Section 37 lists WebSocket subscriptions and account queries as part of the public
interface; Phase 12 left them open. The wallet (aletheia-wallet) had to poll every second, could
not show an account's history, and had to sign a transaction before the node would price it
(`simulateTransaction` ran full stateless validation), so a priced-but-unapproved transfer was a
complete authorization in the RPC operator's hands.
Decision:
  1. **WebSocket at `/ws/v1`** on the RPC server (Axum's `ws`, already enabled). JSON-RPC 2.0
     over the socket: every HTTP method can be called, plus `subscribe` / `unsubscribe` with topics
     `finalizedBlocks`, `transactionStatus {txId}` and `account {address}`. Notifications are
     `{"method":"subscription","params":{"subscription","result"}}`. One follower per server reads
     each newly finalized block once (every 200 ms, at most 64 blocks per tick; a larger jump is a
     `gap` notice) and fans it out over a 256-entry broadcast buffer; a socket that falls behind
     is told `gap` and keeps going. Limits: 1,024 sockets per server, 32 subscriptions per socket,
     64 KiB messages, the per-IP request budget applied to every message, pings every 15 s.
     A `transactionStatus` subscription to a transaction already final is answered at once.
     Everything delivered is finalized.
  2. **Account history.** A node-local index, written in the finalize batch, keyed in the
     `TxIndex` column family as `b'a' || address(20) || height BE || index BE` (33 bytes, apart
     from the 32-byte tx ids by length) → tx id. It covers the sender and every transfer recipient.
     It is not part of state and never hashed. An existing data directory is backfilled once at
     start-up from the transaction index (only blocks that hold transactions are read); a new one is
     complete from genesis. `getAccountHistory {address, limit ≤ 50, before}` and
     `GET /api/v1/accounts/{address}/transactions?limit&before` return transactions newest first, as
     `getTransaction` shows them, with a `"height:index"` cursor. One read scans at most 10,000
     entries of an account.
  3. **Unsigned simulation previews.** `StatelessValidator::validate_preview` runs every check of
     `validate` except the signature count and signature verification; the authorization must
     carry its keys and no signatures. `simulateTransaction` uses it when the authorization has no
     signatures, so execution still binds the key to the sender's account. The mempool and block
     paths call only `validate`, unchanged: a preview can never be admitted (`TX_THRESHOLD_NOT_MET`).
Consequences: No consensus rule, state layout or block format changes; old nodes and new nodes
agree on every block. Behind nginx, `/ws/v1` needs the `Upgrade`/`Connection` headers forwarded
(`deploy/nginx/rpc-websocket.conf`). Account events cover transfers; APN and other payload types
index only their sender until their recipients are named here. Tests:
`crates/execution/tests/stateless_validation.rs` (preview), `crates/rpc/tests/rpc.rs` (history paging
and REST parity against a scanning reference; WebSocket session), and the wallet's integration suite
against a live devnet (preview fee equals signed fee; history; pushed account events and finality).
