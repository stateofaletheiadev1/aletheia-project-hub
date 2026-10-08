import { redirect } from "@sveltejs/kit";
import { classify } from "$lib/search/classify";
import { NETWORKS, type NetworkKind } from "$lib/encoding/identifiers";
import { follower } from "$lib/server/follower";
import type { PageServerLoad } from "./$types";

// One search field, decided locally (spec 41A.9): well-formed input goes straight to its
// page; anything else comes back with one sentence saying why.
export const load: PageServerLoad = ({ url }) => {
  const query = (url.searchParams.get("q") ?? "").trim();
  const name = follower.stats().network;
  const network: NetworkKind = (NETWORKS as readonly string[]).includes(name) ? (name as NetworkKind) : "devnet";
  const target = classify(query, network);
  switch (target.kind) {
    case "height":
      redirect(303, `/blocks/${target.height}`);
    case "block":
      redirect(303, `/blocks/${encodeURIComponent(target.canonical)}`);
    case "transaction":
      redirect(303, `/tx/${encodeURIComponent(target.canonical)}`);
    case "address":
      redirect(303, `/address/${encodeURIComponent(target.canonical)}`);
    case "refused":
      return { query, message: target.message };
    case "epoch":
      return { query, message: `Epoch pages are not open yet. Epoch ${target.epoch} is part of the chain; look up one of its blocks by height.` };
    case "hash":
      return { query, message: "Lookup by state root or code hash is not available yet. Search for a block height, a transaction or an address." };
    case "aan":
    case "uetr":
      return { query, message: "Payment lookups (account numbers and UETRs) open with the Payment Network pages." };
  }
};
