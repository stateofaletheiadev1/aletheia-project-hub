# Aletheia Explorer

The public explorer of Aletheia StableChain, the ledger of the Sovereign Covenant State of
Aletheia. Design and data path: ADR-060 in `../aletheia-node/docs/adr/`.

## Run it

```sh
# 1. A devnet node with funded development accounts and its RPC on 127.0.0.1:7781
cd ../aletheia-node
cargo run -p aletheiad --features devnet-producer -- --config configs/devnet-explorer.toml

# 2. Optional: live traffic between the published development accounts (devnet only)
cargo run -p devnet-traffic -- run http://127.0.0.1:7781 700

# 3. The Explorer on http://localhost:5173
cd ../aletheia-explorer
npm ci --ignore-scripts
npm run dev
```

`ALETHEIA_RPC` points the Explorer at another full node (default `http://127.0.0.1:7781`).
`npm run build && npm start` serves the production build with `adapter-node`.

## Pages

- `/` dashboard: figures, live blocks and live transactions.
- `/blocks`, `/blocks/<height or AL:B…>`: block register and block detail (Overview,
  Transactions).
- `/transactions`, `/tx/<AL:T…>`: transaction register and detail (Overview, Logs).
- `/address/<AL:…>`: balances and recent activity.
- `/search?q=…`: heights, `AL:T` / `AL:B` / `AL:` identifiers.

## Checks

`npm run check`: Svelte and TypeScript (strict), WCAG AA contrast of every colour pair in
`src/app.css`, and the library tests (identifiers against the node's published vectors,
amounts, search).

## Layout

- `src/app.css`: the only colour, type, spacing and motion source.
- `src/lib/server/`: the node's REST client, the live follower, page loading.
- `src/lib/components/`: header, footer, arms, flags, tiles, rows, tables, pager.
- `static/brand/`: the national arms, prepared for the blue background.
