// Captures the Developer Docs examples (src/lib/docs/examples.ts) from a running devnet node,
// so they are never edited by hand.
//
//   node scripts/capture-docs-examples.mjs [http://127.0.0.1:7781]
//
// Needs a devnet with finalized transfers (aletheiad --config configs/devnet-explorer.toml and
// devnet-traffic run). The sample transaction is the latest finalized one the node reports.

import { writeFileSync } from "node:fs";

const base = (process.argv[2] ?? "http://127.0.0.1:7781").replace(/\/$/, "");
const rest = `${base}/api/v1`;

async function get(path) {
  const response = await fetch(rest + path);
  return response.json();
}

async function rpc(id, method, params) {
  const response = await fetch(`${base}/rpc/v1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return response.json();
}

/** Keys sorted, two-space indent: the form the docs show. */
function pretty(value) {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort)
      : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
      : v;
  return JSON.stringify(sort(value), null, 2);
}

const head = await get("/chain/head");
let sampleTx = null;
for (let height = head.height; height > 0 && sampleTx === null; height--) {
  const block = await get(`/blocks/height/${height}`);
  sampleTx = block.transactions?.[0] ?? null;
}
if (sampleTx === null) throw new Error("no finalized transaction yet; start devnet-traffic and wait a few blocks");

const tx = await get(`/transactions/${sampleTx}`);
const sampleAddress = tx.sender;
const sampleBlock = tx.block.id;

const examples = {
  status: await get("/network/status"),
  head: await get("/chain/head"),
  params: await get("/chain/params"),
  tx,
  receipt: await get(`/receipts/${sampleTx}`),
  account: await get(`/accounts/${sampleAddress}`),
  balances: await get(`/accounts/${sampleAddress}/balances`),
  assets: await get("/assets"),
  validators: await get("/validators"),
  supply: await get("/monetary/AEY/supply"),
  notfound: await get("/blocks/height/99999999"),
  "rpc-status": await rpc(1, "getNetworkStatus", {}),
  "rpc-0x": await rpc(2, "getAccount", { address: "0x" + "ab".repeat(20) }),
};

const lines = [
  "// Example responses for the Developer Docs, captured from a devnet node (chain 7771) through",
  "// its REST and JSON-RPC interfaces by scripts/capture-docs-examples.mjs. Regenerate, do not edit.",
  "",
  `export const SAMPLE_TX = ${JSON.stringify(sampleTx)};`,
  `export const SAMPLE_ADDRESS = ${JSON.stringify(sampleAddress)};`,
  `export const SAMPLE_BLOCK = ${JSON.stringify(sampleBlock)};`,
  `export const SAMPLE_HEIGHT = ${JSON.stringify(head.height)};`,
  "",
  "export const EXAMPLES: Record<string, string> = {",
  ...Object.entries(examples).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(pretty(value))},`),
  "};",
  "",
];
writeFileSync(new URL("../src/lib/docs/examples.ts", import.meta.url), lines.join("\n"));
console.log(`captured ${Object.keys(examples).length} examples; sample tx ${sampleTx}`);
