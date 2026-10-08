import { error } from "@sveltejs/kit";
import { rpc, RpcError } from "$lib/server/rpc";
import { fromNode, inOrder } from "$lib/server/load";
import { txLine } from "$lib/server/lines";
import type { PageServerLoad } from "./$types";

/** Transactions listed on one block page; the block itself may hold more. */
const MAX_LISTED = 200;

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  const id = params.id.trim();
  const isHeight = /^\d+$/.test(id);
  if (!isHeight && !id.startsWith("AL:B")) {
    error(400, { message: "That is not a block", hint: "Blocks are found by height (1200) or by their AL:B… identifier." });
  }
  const [block, status] = await Promise.all([
    fromNode(() => (isHeight ? rpc.blockAt(Number(id)) : rpc.block(id)), "block"),
    fromNode(() => rpc.status(), "chain status"),
  ]);
  const ids = block.transactions.slice(0, MAX_LISTED);
  const [txs, finality] = await Promise.all([
    fromNode(() => inOrder(ids, 6, async (txId) => txLine(await rpc.transaction(txId), block.protocolTimeMs)), "transaction"),
    rpc.finality(block.id).catch((e: unknown) => {
      if (e instanceof RpcError && e.status === 404) return null;
      throw e;
    }),
  ]);
  // The block never changes; only its confirmation count grows, and the page keeps that live.
  setHeaders({ "cache-control": "public, max-age=5" });
  return {
    block,
    txs,
    head: status.finalizedHeight,
    tab: url.searchParams.get("tab") === "transactions" ? "transactions" : "overview",
    finality: finality ? { bytes: finality.proof.length / 2, proof: finality.proof } : null,
  };
};
