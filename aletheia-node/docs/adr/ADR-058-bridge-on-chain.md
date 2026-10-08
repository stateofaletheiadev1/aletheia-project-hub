# ADR-058: Bridge, on-chain part (Tier B)
Status: Accepted
Date: 2026-10-08
Context: Section 40A defines the bridge: routes and guardian sets under governance, bridge
messages with a strict per-route sequence, three verification tiers, exact decimal
conversion, limits, the large-transfer delay, flags, pauses and the invariants I10-I12.
Section 40A.7 leaves the inbound execution interface to be written from the normative text
(Appendix R.16). The light-client tier needs one verifier per remote chain, which does not
exist yet.
Decision:
  1. Types 112-117 are active: `BridgeOut`, `BridgeIn`, `SettleDelayed`, `FlagMessage`,
     `PauseRoute`, `ResumeRoute`. 118 `RegisterGuardianSet` is a governance action (with
     `UpsertBridgeRoute` and `SetBridgeRoutePaused`), not a transaction type, so it goes
     through the council and its timelock like every other governed change (E-33).
     119 `UpdateLightClient` is not active.
  2. Only Tier B (guardian quorum) is accepted for a route. A route declaring light-client
     or guardians-and-issuer verification is refused at proposal until those verifiers exist.
  3. An attestation is a signer bitmap and one BLS aggregate signature. Inbound messages are
     attested over `H_domain("ALETHEIA/BRIDGE-ATTEST/v1", message_id ‖ route_id)`; flag, pause
     and resume over `H_domain("ALETHEIA/BRIDGE-CONTROL/v1", action ‖ route_id ‖ subject ‖
     counter)`, where the counter is the route's pause count, so an old resume cannot be
     replayed after the next pause. Every signing guardian's proof of possession is re-proven
     at use, as consensus does for validators.
  4. Guardian sets need a threshold of at least two thirds of their members; production
     networks need at least 7 members, devnet and regtest at least 1.
  5. Outbound AEY moves into one bridge escrow account as available balance; the ledger moves
     it from `circulating` to `bridge_escrow`. Returning AEY is released from it. A bridged
     asset is created by governance with the remote token's decimals, minted against verified
     remote locks and burned on the way out. Only AEY and bridged assets cross a route.
  6. Conversion is exact: an amount with no exact remote equivalent is refused. The bridge
     fee is `amount × fee_bps / 10 000` rounded down, paid to the fee pool, bounded by
     `max_fee`.
  7. Limits per route: per transaction, per governance epoch (both directions together) and
     exposure (AEY escrowed plus bridged assets minted). A governance change may not set a
     limit below what the route already carries.
  8. At or above the large-transfer threshold an inbound message is consumed (its sequence is
     used) but waits `large_transfer_delay_epochs`; anyone may then settle it unless a guardian
     quorum flagged it. Flagged messages stay held; their resolution by governance is a
     follow-up.
  9. A new route starts paused by the council. A council pause lasts until the council
     resumes; a guardian pause expires after `pause_expiry_epochs` or when a quorum resumes it.
     Pauses stop new messages only; waiting messages still settle.
  10. A validly attested message for a sequence already consumed under another id is
      equivocation: the transaction succeeds, moves nothing, records an event and pauses
      the route.
  11. After every block: I10 (the escrow account, the ledger's `bridge_escrow`, the running
      total and the sum of the routes agree), I11 (a bridged asset's outstanding supply is at
      most verified locks minus releases) and I12 (every route within its limits). A violation
      makes the block invalid.
Consequences: Relayer, guardian daemon, remote endpoints, RPC methods, light clients,
issuer co-signatures and the governance path for flagged messages follow.
