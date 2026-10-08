import { error } from "@sveltejs/kit";
import { rpc } from "$lib/server/rpc";
import { fromNode, inOrder } from "$lib/server/load";
import type { PageServerLoad } from "./$types";

const PAGE = 25;

// Blocks are addressed by height, so pages are exact: page p holds heights
// head − 25(p−1) down to head − 25p + 1.
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const status = await fromNode(() => rpc.status(), "chain status");
  const head = status.finalizedHeight;
  const pages = Math.max(1, Math.ceil((head + 1) / PAGE));
  const param = url.searchParams.get("p") ?? "1";
  if (!/^\d+$/.test(param) || Number(param) < 1) {
    error(400, { message: "That is not a page number", hint: "Pages are numbered from 1, e.g. ?p=2." });
  }
  const page = Math.min(Number(param), pages);
  const top = head - (page - 1) * PAGE;
  const heights = Array.from({ length: Math.max(0, Math.min(PAGE, top + 1)) }, (_, i) => top - i);
  const blocks = await fromNode(() => inOrder(heights, 6, (h) => rpc.blockAt(h)), "block");
  if (page > 1) setHeaders({ "cache-control": "public, max-age=30" });
  return { head, page, pages, blocks, live: page === 1, network: status.network };
};
