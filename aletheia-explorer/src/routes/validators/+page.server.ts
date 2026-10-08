import { rpc } from "$lib/server/rpc";
import { fromNode } from "$lib/server/load";
import { follower } from "$lib/server/follower";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ setHeaders }) => {
  const set = await fromNode(() => rpc.validators(), "validator set");
  // Blocks proposed by each validator among the blocks the explorer holds.
  const snapshot = follower.snapshot();
  const blocks = snapshot.kind === "snapshot" ? snapshot.blocks : [];
  const proposed: Record<number, number> = {};
  for (const block of blocks) proposed[block.proposer] = (proposed[block.proposer] ?? 0) + 1;
  setHeaders({ "cache-control": "public, max-age=1, stale-while-revalidate=5" });
  return { set, proposed, window: blocks.length };
};
