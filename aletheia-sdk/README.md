# @aletheia/aletheiachain

The TypeScript client for AletheiaChain. Each module is ported from the node (`aletheia-node`)
and tested against its vectors; the same code runs in Aletheia Wallet.

- **Identifiers**: `alt:` addresses, `alt:T` transaction ids, `alt:B` block ids, with the
  network-folded EIP-55 checksum (ADR-062).
- **Encoding**: ACE (canonical binary) and domain-separated BLAKE3 hashing.
- **Keys**: BIP-39 recovery phrases, SLIP-0010 Ed25519 on `m/44'/7771'/account'/0'/index'`,
  transaction signing.
- **Transactions**: transfer bodies, unsigned previews, signing, submission and tracking to
  finality.
- **RPC**: a typed client for JSON-RPC 2.0 and REST, every response checked at runtime, and the
  WebSocket stream (`finalizedBlocks`, `transactionStatus`, `account`).
- **State proofs**: `verifyStateProof` checks a `getStateProof` answer (ADR-065) against a state
  root you trust, deriving the state key itself, so a balance or supply figure does not depend
  on trusting the RPC operator.

```ts
import { ChainClient, verifyStateProof } from "@aletheia/aletheiachain";

const chain = new ChainClient({
  rpcUrl: "https://rpc.stateofaletheia.org/rpc/v1",
  restUrl: "https://rpc.stateofaletheia.org/api/v1",
});
const answer = await chain.stateProof({ address: "alt:…", asset: "AEY" });
// trustedRoot: the stateRoot of a block header you have checked yourself;
// addressBytes: the 20 address bytes; AEY is asset id 1.
const value = verifyStateProof({ chainId: 7770, kind: "mainnet" }, trustedRoot,
  { kind: "balance", address: addressBytes, assetId: 1 }, answer);
```

`npm test` runs the suite; `tests/fixtures/state-proofs.json` is regenerated from the node with
`ALETHEIA_SDK_VECTORS=<path> cargo test -p aletheia-rpc --test rpc sdk_state_proof_vectors`.
