# ADR-053: Gateway core: audit ledger, exactly-once handling and the pipeline
Status: Accepted
Date: 2026-10-08
Context: Section 40 defines the gateway pipeline and a hash-chained audit table in
PostgreSQL; Section 40C.7 joins external rails to the chain through escrow; Section 40C.8
requires exactly-once handling in both directions. The node workspace has no database, and
the gateway's transport and signer are separate concerns.
Options considered:
  A. Build the gateway around a PostgreSQL client now.
  B. Build the logic against traits (audit store, chain view, screener) with in-memory stores,
     and add the PostgreSQL store, transport and signer around it.
Decision: B (`crates/gateway`):
  1. Audit ledger: one append-only record per `(counterparty, msg_id, stage)`;
     `record_hash = SHA-256(prev_hash ‖ length-prefixed row fields)`, including the payload
     digest and the profile hash. `verify` recomputes the chain and detects any edit,
     removal or reordering.
  2. Inbox keyed by `(rail, sender, msg_id)` before processing: a redelivery returns the
     original outcome and produces nothing new. Outbox keyed by `outbox_id` (the UETR): a
     message is queued once and resent until acknowledged.
  3. Inbound: layer 1 (an unreadable message is recorded under its SHA-256), inbox, layers
     2-3, layer 4 (EUR only until FX quotes exist; creditor resolved to an APN account;
     participant active), screening (a hit or an outage holds: fail closed), R2 headroom of
     the standing authorization (too little holds), then `ExternalInboundCredit` operations.
     A message's payments are taken together.
  4. Outbound: layers 2-3, the AEY amount must equal the message amount in whole euro cents,
     layer 4 (participant and gateway active), then an `ExternalLegLock` (leg id derived from
     the UETR) and the rendered `pacs.008` in the outbox.
  5. Status: `ACSC`/`ACCC` produce `ExternalLegSettle`, `RJCT` produces
     `ExternalLegRelease` with its reason, anything else marks the leg INVESTIGATING and
     produces nothing (I15). Reports for a leg already settled or released change nothing.
  6. The gateway decides and records; it does not sign. Operations go to the gateway
     operator's signer.
Consequences: still to come are the PostgreSQL store, mTLS transport, the HSM signer, the
rail simulator and chaos runs, and R8-R9 reconciliation against statements.
