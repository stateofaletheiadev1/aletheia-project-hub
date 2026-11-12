# ADR-065: State proofs over the RPC, real peer and sync status
Status: Accepted
Date: 2026-11-12
Context: Section 37 lists state proofs among the public reads, and the explorer, wallets and
any light client need to check a balance or supply figure without trusting the RPC operator.
The state tree has produced and verified inclusion and non-inclusion proofs since Phase 3
(`JellyfishMerkleTree::prove`, `StateProof::verify`), but no interface served them. The status
endpoint reported `peers: null` and `syncing: false` whatever the node's real situation.
Decision:
  1. **`getStateProof`** (JSON-RPC) and `GET /api/v1/accounts/{address}/proof[?asset=]`,
     `GET /api/v1/monetary/{asset}/supply/proof` (REST). Parameters select one record: `address`
     (account), `address` + `asset` (balance) or `asset` (monetary supply ledger); anything else is
     refused. The answer is `{record, height, block, stateRoot, key, value, proof}`: the finalized
     tip's height, block id and state root, the 32-byte state key, the record in canonical ACE
     (or `null` when absent), and the `StateProof` in ACE, all base16. An absent key carries a
     non-inclusion proof.
  2. **The node verifies before it serves.** The service checks every proof against the root it
     is about to return; a proof that does not verify is an internal error, never an answer. A
     client still verifies for itself against a header it trusts (the `stateRoot` of the block
     `block` names, or one certified by a finality proof).
  3. **Peers and syncing.** The sync task publishes a `PeerView` (connected peers, highest
     reported peer tip) through a watch channel each time a peer connects, disconnects or reports
     a tip. `getNetworkStatus` reports `peers` from it and `syncing` as "a peer is more than
     `SYNC_LAG_BLOCKS` (8) ahead", the same threshold at which block sync starts.
Consequences: proofs are of the finalized tip only; proofs at an older height need versioned
proof reads and are not offered. Each proof is one tree walk on the chain thread, bounded by the
64-nibble key, under the same per-IP budget as every other read. Tests: proof decode and
verification against the devnet head, forged values and absence refused by the same proof,
REST/JSON-RPC parity, strict parameters (`crates/rpc/tests/rpc.rs`); a balance proof over HTTP
from a running node checked against the separately read block (`node/tests/rpc_http.rs`); peer
count and syncing on two connected nodes (`node/tests/network_sync.rs`).
