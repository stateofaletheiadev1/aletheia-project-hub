import { error } from "@sveltejs/kit";
import { TEXT_LEN } from "$lib/encoding/identifiers";
import { rpc } from "$lib/server/rpc";
import { fromNode } from "$lib/server/load";
import { follower } from "$lib/server/follower";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const address = params.address.trim();
  if (!address.startsWith("alt:") || address.length !== TEXT_LEN.address) {
    error(400, { message: "That is not an address", hint: "Addresses are alt: followed by 40 hex digits, for example alt:01080F161D242B323940474e555C636A71787f86." });
  }
  const [account, balances] = await Promise.all([
    fromNode(() => rpc.account(address), "account"),
    fromNode(() => rpc.balances(address), "account"),
  ]);
  // Without a transaction index, activity is what this explorer has seen go by recently.
  const snapshot = follower.snapshot();
  const recent = snapshot.kind === "snapshot" ? snapshot.txs.filter((t) => t.sender === address || t.recipient === address) : [];
  setHeaders({ "cache-control": "public, max-age=1, stale-while-revalidate=5" });
  return { account, balances, recent };
};
