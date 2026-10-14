import { error } from "@sveltejs/kit";
import { rpc, RpcError } from "$lib/server/rpc";
import { fromNode } from "$lib/server/load";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  const id = params.id.trim();
  if (!id.startsWith("alt:T")) {
    error(400, { message: "That is not a transaction", hint: "Transactions are found by their alt:T… identifier." });
  }
  const tx = await fromNode(() => rpc.transaction(id), "transaction");
  const [receipt, block, status] = await Promise.all([
    rpc.receipt(id).catch((e: unknown) => {
      if (e instanceof RpcError && e.status === 404) return null;
      throw e;
    }),
    fromNode(() => rpc.blockAt(tx.block.height), "block"),
    fromNode(() => rpc.status(), "chain status"),
  ]);
  const tab = url.searchParams.get("tab") === "logs" ? "logs" : "overview";
  // The transaction never changes; only its confirmation count grows, and the page keeps that live.
  setHeaders({ "cache-control": "public, max-age=5" });
  return { tx, receipt, timeMs: block.protocolTimeMs, head: status.finalizedHeight, tab };
};
