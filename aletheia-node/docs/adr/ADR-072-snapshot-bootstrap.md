# ADR-072: Snapshot bootstrap, proven from genesis
Status: Accepted
Date: 2026-11-27
Context: Section 42.4 calls for snapshots "every epoch boundary (configurable)" that are "never
trusted without proof", and the snapshot format (manifest, chunks, an opaque finality proof)
existed, but nothing wrote them on a running node, nothing tied one to the chain, and a new
node could only re-execute every block since genesis. On Mainnet Beta that is hours on a 4 vCPU
host, and it grows every day. A licensed operator joining should be current in minutes, without
trusting the State's server, the download, or anyone else.

Decision:
  1. **What binds a snapshot to the chain.** Beside `manifest.ace` and its chunks, a snapshot
     directory holds `anchor.ace`: the finalized block at the snapshot height and the chain of
     validator epoch changes since genesis, each one the closing block's header, its finality
     proof, and the records of the set that followed (`crates/node/src/bootstrap.rs`). The
     manifest's `finality_proof` is the anchor block's own proof.
  2. **Verification trusts only the genesis file.** Start from the genesis set; for each epoch
     change, the closing block must be in that epoch under that set, actually close it, and be
     final under it, and the next set's records must hash to the `next_validator_set_hash` it
     committed. The anchor block must then be in the resulting epoch under its set, final
     under it, carry the transactions its header commits to, and have the manifest's height and
     state root. The restore rebuilds the tree from the chunks (each checked against its
     manifest hash, keys strictly ascending) and must reach that root. Every check runs before
     the data directory is touched, except the chunk rebuild, which runs inside the commit.
  3. **One atomic start.** `Ledger::init_from_snapshot` writes a `RESTORING` marker, creates
     the data directory, archives the anchor block, and commits the tree, the block index, the
     proof, the tip and a `history_from` marker in one synced batch, then removes the marker. A
     start that finds the marker refuses with an instruction to delete the directory and
     restore again. The account and event indexes are complete from the snapshot height; blocks
     before it are not on this node (`Ledger::history_from`). It is a node option
     (`[node] restore_snapshot`), used only when the data directory is new, so tests and
     production take the same path.
  4. **Running nodes write snapshots.** Every `[snapshots] every_blocks` (default 172,800, about
     a day; 0 turns them off), at the first tip with a stored finality proof, the chain thread
     starts a snapshot and writes it one page (4,096 entries) at a time, only while its request
     queue is empty: consensus and reads always go first. It is written under
     `snapshots/.partial-<height>` and renamed to `snapshots/<height>` once complete; the newest
     `keep` (default 2) stay. A failed snapshot is removed, reported, and retried an interval
     later; a snapshot never stops the node. It relies on the snapshot height's JMT version
     staying readable while it is written: there is no state pruning yet, and pruning, when it
     comes, must keep the version of a snapshot in progress.
  5. **Peers without the history.** A node now answers every `GetBlocks`, with an empty
     `Blocks` when it does not hold those blocks; a node behind it marks that peer and syncs
     from others while it stays connected, instead of waiting for an answer that never comes.

Consequences: an operator copies a snapshot directory from any source, sets
`restore_snapshot`, and starts; a tampered anchor, a forged set, a missing epoch change or a
damaged chunk is refused with `PROOF_INVALID` and nothing is written. Snapshot files are not
secret: they are the public state. Fetching snapshots over P2P (the `SnapshotSync` channel) is
the next step and needs no format change; until then a snapshot travels by any file copy,
which is safe because nothing in it is believed unproven. Storage schema is unchanged: the
`history_from` and `RESTORING` markers are additive and a data directory started from genesis
never has them. Change class 1 (node behaviour and operations; no consensus rule changes).
Tests: page-at-a-time writing equals the one-pass snapshot, an unfinished writer refuses to
finish (`crates/state/tests/snapshot_and_pruning.rs`); end to end over TLS, a snapshot of
epoch 2 carries both epoch changes, a forged set, an anchor without its epoch changes and a
damaged chunk are refused, and a node restored from it follows the chain to the same hashes and
restarts from its own directory (`crates/node/tests/validator_epochs.rs`).
