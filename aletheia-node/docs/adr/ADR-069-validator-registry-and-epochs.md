# ADR-069: Validator registry, epoch transitions and rewards (protocol version 2)
Status: Accepted
Date: 2026-11-26
Context: Mainnet Beta (chain 7770) has run since 2026-10-27 on the one genesis validator, in
epoch 0, past height 4,100,000. The spec defines the validator registry (Section 34) and says
set changes take effect at epoch boundaries committed through `next_validator_set_hash`
(Section 19.1), but neither exists: the ledger refuses any block whose
`next_validator_set_hash` differs from its `validator_set_hash`, and the node builds one engine
for epoch 0 and keeps it forever. Licensed operators (fees collected off-chain by the Aletheia
Development Foundation) need a way to join a running chain. Constraints from the founder:
the chain must keep running on one validator until someone joins, and must carry on without a
restart, a re-genesis or a resync when validators join or leave. Continuity (Section 44) adds:
every rule that can change a hash belongs to a protocol version.

The spec's fixed epoch of 512 slots would have put every Mainnet Beta block after slot 512 in
the wrong epoch: blocks already finalized say epoch 0. Epochs are therefore counted by set
changes, not by slots, from the activation of version 2. Governance keeps its own
slot-based epochs (`epoch_slots`, ADR-048); the two are distinct and named apart in code
("validator epoch" here).

Decision:
  1. **Protocol version 2** is version 1 plus the validator registry transactions and epoch
     transitions. It is switched on by the existing `ScheduleUpgrade` governance action at a
     height; blocks below that height replay under version 1 exactly as before. A binary
     supporting version 2 must be installed on every node before the activation height.
  2. **Event-driven epochs.** A validator epoch ends at the block whose execution changes the
     next set (an activation, suspension, reinstatement or exit takes effect). That block, the
     *closing block* `E`, commits `next_validator_set_hash = H(set(e+1), e+1)`, which differs
     from its `validator_set_hash`; this difference is how every node, the engine included,
     recognises it from the header alone. Its post-state holds `ValidatorSets[e+1]`. With no
     change the epoch never ends: the single validator keeps producing in epoch 0 indefinitely.
  3. **Closing an epoch under the 2-chain rule.** `E` is final once a QC exists for a child `C`
     with `C.round = E.round + 1`. `C` is a *suffix block*: it must carry no transactions,
     executes as a no-op (post-state = `E`'s), and is never finalized; a proposal extending a
     suffix block is refused. So `E` is always the last block of its epoch's chain and the last
     block of the finality batch that contains it.
  4. **Starting the next epoch.** When `E` is final every node replaces its engine: validator
     set `ValidatorSets[e+1]`, leader seed `seed(e+1, hash(E))` (the spec's
     `finalized_hash_at(epoch_start − 1)`), finalized tip `E` with round `E.round + 1`. The
     first block of epoch `e+1` has parent `E`, epoch `e+1` and the unsigned root QC for `E` at
     round `E.round + 1`; it executes with the epoch state moved to `e+1`. Safety data carries
     over (rounds are global and only grow), and the start round is the same on every node, so
     the root QC they compare is identical.
  5. **The ledger's header rules under version 2**, against the parent's state:
     `header.epoch == epoch` when the epoch is open; when the parent closed it, either
     `header.epoch == epoch` (a suffix block: empty, no-op) or `header.epoch == epoch + 1` (the
     next epoch). `validator_set_hash` is the set of `header.epoch`; `next_validator_set_hash`
     is that same hash unless this block closes the epoch. Version 1 keeps today's rule.
  6. **Registry state** (namespace 16, keyed by the 32-byte node key): operator address,
     consensus key with proof of possession, node key, transport certificate hash, metadata
     hash (off-chain licence and operations record; never personal data), bond, status
     `REGISTERED | ACTIVE | EXITING | SUSPENDED | REMOVED | REJECTED`, and the epochs it joined
     and left. Namespace 65 parameter 5 holds the epoch state (`epoch`, `closed`,
     `opened_after`) and parameter 6 the validator policy (minimum bond, default 10,000 ALnT;
     maximum set size, default 100).
     Absent records mean epoch 0, open, with the genesis set: every block before activation
     reads exactly as it does today.
  7. **Transactions.**
     `RegisterValidator` (operator): keys, proof of possession, certificate hash, metadata
     hash; locks at least the minimum bond in ALnT in the registry's module account.
     `WithdrawApplication` (operator, while `REGISTERED`): refunds the bond.
     `RequestExit` (operator, while `ACTIVE`): leaves at the end of this block's epoch.
     Governance actions (Council, existing propose/vote/execute): `ActivateValidator`
     (1 governance epoch timelock), `RejectValidator` (refunds), `SuspendValidator`
     (timelock 0, as Section 35 requires for emergency suspension), `ReinstateValidator` (1),
     `SetValidatorPolicy` (1). Genesis validators have no registration; governance can suspend
     and reinstate them by node key all the same.
  8. **Bonds.** Held, never slashed in this version (Section 34: slashing disabled until
     audited). Returned when an application is withdrawn or rejected, and when a validator's
     exit takes effect. A suspended validator keeps its bond.
  9. **No action may empty the set.** Suspension or exit of the last active validator is
     refused. The set never exceeds the policy maximum or `MAX_VALIDATORS`.
 10. **Nodes.** A node with a consensus key whose node key is not (yet) in the set runs as an
     observer and becomes a validator at the first epoch that includes it; one removed from the
     set becomes an observer. Block sync serves batches that end at a closing block, so every
     finality proof is verified against the set of its own epoch.
 11. **Rewards** (founder decisions, 2026-11-26). ALnT's supply is fixed (Section 18.7), so
     rewards move only what exists: every fee in `FEE_POOL` (each fee asset) plus up to
     `pool_payout` ALnT per period from `REWARD_POOL` (module account 11), which the treasury
     funds by ordinary transfers. A period is `period_slots` (default one day of slots) and is
     paid by the first block of the next. Each validator's credit is the blocks it served as a
     member in the period minus the parent-certificate signatures it missed; each source is split
     by credit, floors only, remainders staying put. A validator with a licensed operator pays
     that operator; one without (the genesis validators, the state's own) pays the Council's
     `state_beneficiary`, or leaves its share in the pools while none is set. The work record
     (namespace 65 parameter 8) is written only on a miss, a set change or a payout, so a
     network where everyone signs every block adds nothing to state per block.
     `SetRewardPolicy` (Council, timelock 1) sets the period, the pool payout and the
     beneficiary.

Consequences: operators can join and leave the running chain under Council control; nothing
already finalized changes, and a chain that never activates version 2, or activates it and never
changes its set, behaves exactly as before. With equal weights a set of 2 or 3 tolerates no
offline validator (F = 0); operations guidance is that the state keeps enough of its own
validators to reach the quorum by itself while licensed operators join. Transport certificate
pinning from the registry, submitted equivocation evidence, key rotation and network state sync
follow as separate changes. Tests: engine suffix and closing rules, epoch-state and set
computation, every registry transaction and its refusals, header rules under versions 1 and 2,
reward credit and record encoding, and a node-level run over TLS that upgrades a one-validator
chain from version 1 to 2, admits an operator (both lead blocks), pays it rewards, suspends it
(the founder's validator carries on alone) and restarts in the right epoch
(`crates/node/tests/validator_epochs.rs`).
