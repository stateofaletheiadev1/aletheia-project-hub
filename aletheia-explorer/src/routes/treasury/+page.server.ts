import { rpc } from "$lib/server/rpc";
import { fromNode } from "$lib/server/load";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ setHeaders }) => {
  const [aey, alnt] = await Promise.all([
    fromNode(() => rpc.supply("AEY"), "supply ledger"),
    fromNode(() => rpc.supply("ALnT"), "supply ledger"),
  ]);
  setHeaders({ "cache-control": "public, max-age=1, stale-while-revalidate=5" });
  return { ledgers: [aey, alnt] };
};
