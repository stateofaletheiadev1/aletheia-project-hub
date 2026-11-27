# ADR-076: Block sync after a consensus stall
Status: Accepted
Date: 2026-11-27
Context: Under consensus a node block-syncs only when a peer is more than `SYNC_LAG_BLOCKS` (8)
ahead; closer than that, consensus is expected to deliver the blocks. The rotation and evidence
tests (ADR-074, ADR-075), run together under load, found a case where it cannot: a validator
that missed the last vote of an epoch's closing block stays one block short of it, in the old
epoch, and ignores every message of the new one; the new epoch needs its vote, so the other
validator stops too, and neither ever announces a new block. Both waited forever. On Mainnet
Beta the same would happen when a licensed operator's validator is admitted at a bad moment.
A block request that was never answered also stopped block sync for good.

Decision:
  1. A node that has finalized nothing for `STALLED_AFTER` (3 s) syncs from a peer that is
     ahead by any amount. The closing block of an epoch always carries a stored finality proof
     (ADR-069), so the stuck node applies it as proven blocks and its engine moves to the new
     epoch.
  2. The sync service checks every `CATCH_UP_EVERY` (1 s), not only when a peer announces a
     block: in a stall nobody announces one.
  3. A block request unanswered for `REQUEST_TIMEOUT` (10 s) is given up and sent again.

Consequences: a validator that falls one block behind at an epoch change catches up within a
few seconds instead of halting the chain. Nothing changes while consensus is progressing.
Change class 1 (node behaviour; no consensus rule change). Tests: the rotation and evidence end
to end tests, run together, which stalled before this change and pass repeatedly after it
(`crates/node/tests/validator_rotation.rs`).
