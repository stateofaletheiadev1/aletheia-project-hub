# ADR-068: Provable registry, bridge and contract records; contract discovery; multisig clients
Status: Accepted
Date: 2026-11-12
Context: Phase 12 left "contract views, registry and bridge methods" and multisig client support
open. The registries (identity, credentials, residence, land, governance), the bridge (routes,
outbound messages, escrow) and deployed contracts all live in state with public key functions,
but nothing served them. View routines already run through `simulateTransaction` as unsigned
previews (ADR-064), yet a client had no way to learn which routines a contract has. The protocol
has supported `MultiEd25519` (up to 16 keys, a threshold) since ADR-044, without client tooling.
Decision:
  1. **One provable read for every record.** `getStateProof` takes `record`: `contract`
     (address), `identity`, `credential`, `residence`, `parcel`, `proposal`, `bridgeTransfer`
     (`id`, 64 hex), `bridgeRoute` (`route`), `bridgeEscrow`, besides `account`, `balance` and
     `supply`. Each record takes only its own parameters. Every answer is the canonical record
     with its Merkle proof, verified by the node before serving (ADR-065), so registry and bridge
     reads are verifiable from the first day instead of resting on the operator's word.
  2. **`getContract`** and `GET /api/v1/contracts/{address}`: code hash, deployer, Arno version,
     code size and the callable routines (`entry`, `view`, `constructor`, parameter count,
     whether it returns), read through the same verified state reads and decoded from the stored
     package. Views keep running through the unsigned simulation preview.
  3. **Multisig in the SDK.** `multisigAddress`, `signMultisigShare` (each holder signs the TXSIG
     digest on their own device), `assembleMultisig` (checks the sender is the account of those
     keys and threshold, verifies every share, uses exactly `threshold` in key order) and
     `encodeMultisigPreview`. `verifyRecordProof` checks a proof for a key the caller names.
Consequences: registry and bridge records are returned in canonical ACE; typed decoders follow
in the SDK as the registries open. Tests: a deployed escrow contract's routines and REST parity,
proofs of present and absent contract, registry and bridge records, per-record parameter checks
(`crates/rpc/tests/rpc.rs`); the SDK reproduces, byte for byte, a 2-of-3 multisig transaction the
node builds and validates (`sdk_multisig_vector`), and refuses forged, outside and missing shares.
