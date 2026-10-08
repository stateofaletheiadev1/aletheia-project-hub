# ADR-055: Finalized Event Stream core and the reference PayNet
Status: Accepted
Date: 2026-10-08
Context: Section 40D makes the Finalized Event Stream (APS-0058) the only way off-chain
systems learn what happened on chain, sets PayNet's settlement submission rules, adds
reconciliation R4-R7, and requires a test-only reference PayNet in this repository so the
chain cannot break PayNet's contract without a failing build. Transport (gRPC, WebSocket)
belongs with the RPC layer (Phase 12).
Decision:
  1. `crates/event-stream`: finalized blocks become envelopes in cursor order
     `(height, tx_index, event_index)`. Each names the previous envelope's cursor for gap
     detection and carries the event, its transaction, block hash, protocol time and
     version, a kind code and, on request, an inclusion proof against the block's
     `event_root`. Kind codes come from a fixed table of event schemas; codes are never
     reused, and unknown schemas are kind 0.
  2. Back-pressure: a subscriber's buffer is bounded. When it is full the subscriber still
     receives what is queued and then `STREAM_CONSUMER_TOO_SLOW`, and resumes from its
     cursor. (An earlier draft dropped the queued messages on overflow, so a small buffer
     never made progress; the convergence test found it.)
  3. The consumer drops anything at or before its committed cursor, stops on a gap, and
     records and skips unknown kinds and newer schemas.
  4. `tests/paynet-reference` (test-only): one submitter per settlement account with nonces
     in its own store, reconciled with the chain on start; an HSM policy per key (allowed
     types, per-transaction and per-hour limits, second approval above a threshold); every
     payment simulated (the harness's `simulate`) before it is signed. A payment is
     SETTLED only when the stream delivers its `aletheia.apn.payment.settled.v1` event and
     the inclusion proof verifies against the finalized header's `event_root`. The cursor is
     committed with the effects, so restarts have exactly-once effects.
  5. R4 (ledger balance against chain balance less holds), R5 (each SETTLED payment has
     exactly one settlement on chain and each on-chain payment from the account one ledger
     entry), R6 (anchored roots recompute from stored messages), R7 (no locked escrow without
     a live case or outbox item).
Consequences: the stream's network endpoints, PayNet's own deployment, and an end-to-end run
that joins the reference PayNet's ledger with the gateway and rail simulator escrow path are
still to come; the escrow path itself is covered by the rail simulator chaos runs.
