# ADR-048: Native registries and council governance, protocol version 1
Status: Accepted
Date: 2026-10-07
Context: Sections 31-33 and 35 define the identity, residence and land records, issuer and
authority permissions, history retention, the council and the proposal lifecycle with
timelock classes. They leave open the transaction layouts, where issuers are recorded, how a
land authority co-signs, which governance actions exist, and how timelocks count epochs
while epoch transitions are not yet implemented.
Options considered:
  A. Generic "registry write" transactions checked by a permission table.
  B. One transaction type per operation with explicit permission rules, and a closed list
     of governance actions.
Decision: B (crates/core `registry.rs`, crates/execution `registry_model.rs`,
`rules/v1/registry.rs`):
  1. Types 48-53 (identity, credentials), 56-57 (residence), 59-63 (land), 80-82
     (governance: propose, vote, execute).
  2. Issuers (identity, residence) and authorities (land) are registered only by governance
     with scopes (schemas, residence classes, parcel classes). Every operation is permitted
     to exactly one party: the issuer's or authority's controller account, the identity's
     controller, the parcel's controller (an address, or an active identity's controller),
     or, for releasing an encumbrance, also its holder.
  3. A land authority registered with co-signed classes has an Ed25519 co-signing key. It
     signs `H_domain("ALETHEIA/PARCEL-TRANSFER/v1", ace(parcel_id, new_controller, sender,
     nonce))`, so a co-signature authorizes one transfer by one transaction.
  4. History: every residence change appends `(residence_id, seq)` in namespace 34 and every
     land operation `(parcel_id, seq)` in namespace 36; entries are never rewritten and are
     provable with JMT state proofs against a block's state root. Residence expiry is
     computed from the expiry epoch, never stored.
  5. Governance: a council of 1-32 accounts with an M-of-N threshold, set at genesis and
     changed only by a `SetCouncil` proposal. Proposals move VOTING → TIMELOCKED (approved)
     or REJECTED (more rejections than the council minus the threshold), then EXECUTED, or
     EXPIRED when voting or the execution window lapses. The proposal id is
     `H_domain("ALETHEIA/GOV-PROPOSAL/v1", ace(proposer, nonce, action))`.
  6. Actions are closed: register or (de)activate an issuer, set a fee price (at most
     doubling or halving), set AEY capacity (between outstanding supply and the current
     capacity plus the governed maximum), schedule a protocol upgrade, replace the council.
     Timelocks: 1 governance epoch for issuer and fee changes, 4 for capacity, 8 for upgrades
     and council changes. Nothing moves user balances or writes arbitrary state.
  7. Until epoch transitions arrive, a governance epoch is `slot / epoch_slots`, with
     `epoch_slots` set in genesis (default 512, Section 19.4).
Consequences: Adding a registry operation or governance action is a protocol change. The
emergency validator-suspension class waits for the validator registry operations.
Protocol impact: APS-0022 to APS-0026 record the layouts; error codes 14001-14013 are
registered in APS-0038; domain tags `ALETHEIA/PARCEL-TRANSFER/v1` and
`ALETHEIA/GOV-PROPOSAL/v1` are registered (ERRATA E-26).
