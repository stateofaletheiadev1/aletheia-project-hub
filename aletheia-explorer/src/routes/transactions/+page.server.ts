import { error } from "@sveltejs/kit";
import { rpc } from "$lib/server/rpc";
import { fromNode, inOrder } from "$lib/server/load";
import { txLine } from "$lib/server/lines";
import type { TxLine } from "$lib/types";
import type { PageServerLoad } from "./$types";

const PAGE = 25;
/** Blocks read per step, and at most per page: an idle chain cannot make a page expensive. */
const STEP = 20;
const MAX_SCANNED = 600;

// Until the State's own database engine indexes transactions, a page is gathered by walking
// finalized blocks downwards from `before` until it holds PAGE transactions.
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const status = await fromNode(() => rpc.status(), "chain status");
  const head = status.finalizedHeight;
  const param = url.searchParams.get("before");
  const pageParam = url.searchParams.get("p");
  const page = pageParam !== null && /^\d+$/.test(pageParam) && Number(pageParam) > 0 ? Number(pageParam) : 1;
  if (param !== null && !/^\d+$/.test(param)) {
    error(400, { message: "That is not a block height", hint: "Pages are addressed by block height, e.g. ?before=1200." });
  }
  let cursor = param === null ? head : Math.min(Number(param) - 1, head);
  const top = cursor;
  const txs: TxLine[] = [];
  let scanned = 0;
  while (cursor >= 0 && txs.length < PAGE && scanned < MAX_SCANNED) {
    const heights = Array.from({ length: Math.min(STEP, cursor + 1) }, (_, i) => cursor - i);
    const blocks = await fromNode(() => inOrder(heights, 6, (h) => rpc.blockAt(h)), "block");
    let full = false;
    for (const block of blocks) {
      // A block is never split across pages: if it does not fit, it opens the next page.
      if (txs.length > 0 && txs.length + block.transactions.length > PAGE) {
        full = true;
        break;
      }
      const lines = await fromNode(
        () => inOrder(block.transactions.slice(0, 200), 6, async (id) => txLine(await rpc.transaction(id), block.protocolTimeMs)),
        "transaction",
      );
      txs.push(...lines);
      cursor = block.height - 1;
    }
    scanned += heights.length;
    if (full) break;
  }
  if (param !== null) setHeaders({ "cache-control": "public, max-age=60" });
  return { head, top, page, txs, older: cursor >= 0 ? cursor + 1 : null, live: param === null, reachedGenesis: cursor < 0 };
};
