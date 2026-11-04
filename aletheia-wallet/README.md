# Aletheia Wallet — *The Private Ledger*

The official non-custodial wallet for **AletheiaChain**, the public ledger of the Sovereign Covenant
State of Aletheia. Native accounts, AEY and ALnT, transfers priced by the network and tracked to
finality — with every key made, sealed and used in the browser.

SvelteKit 2 · Svelte 5 runes · TypeScript strict · Vite · adapter-vercel · Manrope only.

## Run it

```sh
npm install
npm run dev            # http://127.0.0.1:5180, against Mainnet Beta (read-only; see "Signing")
```

Against a local devnet (sending works there):

```sh
# 1. a real node, from this folder
../aletheia-node/target/debug/aletheiad.exe --config tests/devnet/node.toml
# 2. the wallet, proxied to it (a local node sends no CORS headers)
DEVNET_PROXY=http://127.0.0.1:7791 \
PUBLIC_STABLECHAIN_RPC_URL=http://127.0.0.1:5180/__devnet/rpc/v1 \
PUBLIC_STABLECHAIN_REST_URL=http://127.0.0.1:5180/__devnet/api/v1 \
PUBLIC_STABLECHAIN_CHAIN_ID=7771 PUBLIC_STABLECHAIN_NETWORK=devnet \
PUBLIC_STABLECHAIN_GENESIS_BLOCK=<block 0 id of that devnet> npm run dev
```

## Checks

| Command | What it proves |
|---|---|
| `npm run check` | svelte-check, TypeScript strict, zero warnings |
| `npm run lint` | ESLint (trust boundary, no floats for amounts) + Prettier |
| `npm test` / `npm run test:coverage` | 77 unit tests; ≥ 95 % lines on protocol and custody code |
| `npm run test:integration` | the Rust node accepts, executes and finalizes what this code signs (needs the devnet) |
| `npm run test:e2e` | Chrome: create → certificate → verify → seal → funded → send → finalized → lock → unlock, axe on every screen |
| `npm run build` | production build + bundle budgets + "no wallet crypto on public pages" |
| `npm run contrast` | WCAG 2.2 AA for every colour pair of both themes |

## Signing on Mainnet Beta

Off by default (`PUBLIC_MAINNET_SIGNING`). The wallet derives keys on the node's **provisional** coin
type 7771 and adds a BIP-39 layer the node does not define yet; both need the protocol owner's
confirmation before user funds are signed for on mainnet. Receiving and balances work now.

## Where things are

```text
src/lib/stablechain/   protocol: ACE, identifiers, domain hashing, tx body, client, gate, state machine
src/lib/wallet/        custody: BIP-39, SLIP-0010, keystore, signing — and the worker, the only place secrets live
src/lib/design/        tokens, motion, icons, contour fields, guilloché
src/lib/components/    the component library (gallery at /dev/components in development)
src/routes/            (public) · (auth) · (wallet)
docs/                  design system, motion, content, security, threat model, deployment, ADRs, DDRs
```
