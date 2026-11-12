import { error } from "@sveltejs/kit";
import { TEXT_LEN } from "$lib/encoding/identifiers";
import { rpc } from "$lib/server/rpc";
import { fromNode } from "$lib/server/load";
import { follower } from "$lib/server/follower";
import { txLine } from "$lib/server/lines";
import type { TxLine } from "$lib/types";
import type { PageServerLoad } from "./$types";

const PAGE = 25;

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  const address = params.address.trim();
  if (!address.startsWith("alt:") || address.length !== TEXT_LEN.address) {
    error(400, { message: "That is not an address", hint: "Addresses are alt: followed by 40 hex digits, for example alt:01080F161D242B323940474e555C636A71787f86." });
  }
  const before = url.searchParams.get("before") ?? undefined;
  const [account, balances] = await Promise.all([
    fromNode(() => rpc.account(address), "account"),
    fromNode(() => rpc.balances(address), "account"),
  ]);
  setHeaders({ "cache-control": "public, max-age=1, stale-while-revalidate=5" });
  // The node's account index (ADR-064) holds every finalized transaction of the address. A node
  // without it is answered from what this explorer has seen in the latest blocks, and says so.
  try {
    const page = await rpc.accountHistory(address, PAGE, before);
    const times = new Map<number, number>();
    for (const height of new Set(page.transactions.map((t) => t.block.height))) {
      times.set(height, (await rpc.blockAt(height)).protocolTimeMs);
    }
    const history: TxLine[] = page.transactions.map((t) => txLine(t, times.get(t.block.height) ?? 0));
    return { account, balances, history, next: page.next, complete: true, paged: before !== undefined };
  } catch {
    const snapshot = follower.snapshot();
    const recent = snapshot.kind === "snapshot" ? snapshot.txs.filter((t) => t.sender === address || t.recipient === address) : [];
    return { account, balances, history: recent, next: null, complete: false, paged: false };
  }
};
