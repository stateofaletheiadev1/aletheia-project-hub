import { error } from "@sveltejs/kit";
import { rpc } from "$lib/server/rpc";
import { fromNode } from "$lib/server/load";
import { parsePosition, positionText, recentTransactions } from "$lib/server/recent";
import type { PageServerLoad } from "./$types";

const PAGE = 25;

// Pages come from the node's event index, newest first, however far back the transactions are
// (lib/server/recent.ts). Older pages are addressed by the position of the last transaction
// shown, "?before=<height>:<index>".
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const status = await fromNode(() => rpc.status(), "chain status");
  const head = status.finalizedHeight;
  const param = url.searchParams.get("before");
  const pageParam = url.searchParams.get("p");
  const page = pageParam !== null && /^\d+$/.test(pageParam) && Number(pageParam) > 0 ? Number(pageParam) : 1;
  const before = parsePosition(param);
  if (param !== null && before === null) {
    error(400, { message: "That is not a position in the chain", hint: "Older pages are addressed as ?before=<height>:<index>, e.g. ?before=4165445:0." });
  }
  const found = await fromNode(() => recentTransactions(PAGE, before), "transaction");
  if (param !== null) setHeaders({ "cache-control": "public, max-age=60" });
  return {
    head,
    top: before?.height ?? head,
    page,
    txs: found.lines,
    older: found.next ? positionText(found.next) : null,
    live: param === null,
    reachedGenesis: found.next === null,
  };
};
