// A balance's state proof and the header it is checked against, for the browser to verify
// itself (ProofCheck.svelte). The header comes from a separate block read; the browser derives
// the state key and recomputes the root, so a wrong value cannot pass as proven.
import { json } from "@sveltejs/kit";
import { RpcError, rpc } from "$lib/server/rpc";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const asset = url.searchParams.get("asset") ?? "";
  if (!["AEY", "ALnT"].includes(asset)) return json({ error: "asset is AEY or ALnT" }, { status: 400 });
  try {
    const [answer, status] = await Promise.all([rpc.balanceProof(params.address, asset), rpc.status()]);
    const header = await rpc.block(answer.block);
    return json(
      {
        answer,
        header: { height: header.height, id: header.id, stateRoot: header.stateRoot },
        network: { chainId: status.chainId, kind: status.network },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof RpcError ? error.status : 502;
    // A node released before ADR-065 has no proof route: 404 for the path.
    return json({ error: status === 404 ? "unsupported" : "unavailable" }, { status: status === 404 ? 501 : 502 });
  }
};
