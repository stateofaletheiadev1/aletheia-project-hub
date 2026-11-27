# ADR-073: Fetching snapshots from peers
Status: Accepted
Date: 2026-11-27
Context: ADR-072 lets a new node start from a snapshot that verifies against the genesis file
alone, but the snapshot had to be copied to the host by hand. Section 36 reserves the
`SnapshotSync` channel (priority 4, 16 MiB frames, 20 frames and 32 MiB per second per peer)
for exactly this, and an operator joining Mainnet Beta should need nothing but the genesis
file and one peer address.

Decision:
  1. **Four messages on `SnapshotSync`.** `GetSnapshotOffer` (1); `SnapshotOffer` (2): the
     height, manifest and anchor of the newest complete snapshot the node holds, height 0 for
     none; `GetSnapshotPart` (3): height, chunk, offset; `SnapshotPart` (4): the same three, the
     chunk file's length and at most 4 MiB of it, or length 0 when the node does not serve that
     snapshot. Chunks travel in parts because a compressed 16 MiB chunk can reach the frame
     limit. Manifests and anchors are carried as bytes; the transport trusts none of it.
  2. **Serving never holds up consensus.** Offers and parts are read in tasks the sync service
     owns and reaps, at most `SNAPSHOT_READS` (4) at once (`channels.rs`); more are dropped and
     the asker retries. Only complete snapshots (`snapshots/<height>` with manifest and anchor)
     are served, and paths are built from the requested numbers only.
  3. **Fetching, for `[node] restore_snapshot = "peers"` on a new data directory.** The node
     starts its network first, with an empty tip, and asks every peer it hears from for an
     offer. Offers are tried from the highest height down; one is accepted only when it
     verifies against genesis (ADR-072), and a peer whose offer did not verify is not asked
     again. Every peer offering the same manifest is a source. Each chunk is fetched part by
     part from one source and checked against its manifest hash when complete; a source that
     times out (30 s per part), disconnects, sends parts that do not add up or a bad chunk is
     dropped and the next one fetches the chunk. If every source fails (a snapshot pruned
     during the download, say), the node asks for offers again; chunks already checked stay on
     disk, so a restart resumes too. With no offer in 10 minutes it stops with a clear message
     and systemd starts it again. The download is assembled in `<data_dir>/snapshot-download`,
     restored exactly as ADR-072 (every check runs again), removed, and the same network is
     handed to block sync.

Consequences: a joining operator needs only `restore_snapshot = "peers"` and the State's
validator as a peer. Releases before this one score the new messages as malformed, so a node
fetching snapshots should be pointed at peers on this release; the State's validator gets it
with the same deployment. Change class 1 (node behaviour and P2P messages on a reserved channel;
no consensus rule change). Tests: message round trips and the 4 MiB part bound (`p2p`); parts
served and reassembled across three parts, nothing served for an incomplete or unknown
snapshot (`snapshots.rs`); end to end over TLS, a new node given only "peers" refuses a peer's
forged offer that is higher than the real one, fetches the real snapshot, follows the chain to
the same hashes and removes its download (`crates/node/tests/validator_epochs.rs`).
