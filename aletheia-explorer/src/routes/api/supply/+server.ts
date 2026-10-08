// A small change marker for the treasury page: it re-renders only when supply moved.
import { json } from "@sveltejs/kit";
import { rpc } from "$lib/server/rpc";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const ledgers = await Promise.all([rpc.supply("AEY"), rpc.supply("ALnT")]).catch(() => null);
  if (!ledgers) return json({ fingerprint: "" }, { status: 503 });
  const fingerprint = ledgers.map((l) => `${l.asset}:${l.issuedTotal}:${l.burnedTotal}:${l.circulating}:${l.locked}`).join("|");
  return json({ fingerprint }, { headers: { "cache-control": "no-store" } });
};
