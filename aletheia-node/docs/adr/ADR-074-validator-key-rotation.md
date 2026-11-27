# ADR-074: Validator key rotation (protocol version 3)
Status: Accepted
Date: 2026-11-27
Context: Section 34 lists `RotateConsensusKey` ("effective next epoch, new PoP") and
`RotateTransportCert`; Section 19.2 rotates transport keys every 90 days and answers an HSM
compromise with "key rotation via management key". Protocol version 2 (ADR-069) records each
validator's consensus key and certificate hash at registration and offers no way to change
them, and the State's own genesis validator has no registration at all. Version 2's rules are
fixed once its activation is scheduled, so rotation is a new protocol version.

Decision:
  1. **Protocol version 3** is version 2 plus three operations. Version 2's behaviour is reused
     unchanged; what version 3 adds lives in `rules/v3`. The test-only version used by the
     continuity tests moves from 3 to 4.
  2. **`RotateConsensusKey` (type 67)**, from the validator's operator account (the account
     that registered it, as for every operator transaction of ADR-069; Section 19.1's separate
     management key is not modelled yet): the new BLS key and its proof of possession, verified
     on chain. The registration is updated at once. When the validator is in the current set
     (and not leaving in this block), the block closes the epoch and the next set carries the
     new key: epochs are event-driven (ADR-069), so "effective next epoch" is the block right
     after. A key held by another member or registration is refused.
  3. **Council rotation, `RotateValidatorKey` (governance action 18)**, timelock 1 epoch, the
     same effect for any member, including a genesis validator, for which a bond-free
     registration is recorded exactly as `SuspendValidator` does. In an emergency the Council
     suspends first (no timelock) and rotates after.
  4. **`RotateTransportCert` (type 68)** from the operator: the registration's certificate hash
     changes at once and the previous hash stays accepted for 172,800 slots (about a day), so
     the node can be restarted onto the new certificate while its connections keep working.
     Nodes pin both while the grace lasts and refresh their pins whenever a finalized block
     carries a validator transaction or a governance execution.
  5. **No new action before its version.** Types 67-68 are inactive before version 3 like any
     new type, and a `GovPropose` carrying action 18 is refused at admission before version 3,
     so no block of version 2 can contain one: a binary that cannot decode it and this one
     reach the same verdict.
  6. **No downtime for the rotated validator.** A node may hold a next consensus key beside the
     current one (`[next_signer]` socket, or `next_consensus_key_file` on devnet). At every
     epoch the engine signs with whichever key the epoch's set records for this node; safety
     data carries over, so neither key can sign twice for a round. The operator starts the new
     signer, adds it as `next_signer`, restarts the node, then submits the rotation; the switch
     happens by itself at the epoch change, and the old signer is removed afterwards. A new
     transport certificate is prepared the same way (`p2p/next-transport-cert.der` and key, put
     in place on the next start, ADR-071 files kept as backup).

Consequences: an operator can rotate a compromised or ageing key without leaving the set, and
the State can rotate its genesis validator's key by Council vote. Version 3 needs a release and
a `ScheduleUpgrade` like version 2. A validator rotated without a next signer in place follows
as an observer until it is restarted with the new key, exactly as a misconfigured key does
today. Change class 3 (new protocol version). Tests: encodings, the stateless gate for action
18, the rotation rules, and end to end a validator rotating its consensus key and certificate
without stopping the chain.
