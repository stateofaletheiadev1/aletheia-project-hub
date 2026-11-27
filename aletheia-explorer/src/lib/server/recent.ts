// Recent transactions from the node's event index (node ADR-067), newest first, at any distance
// from the tip. Walking blocks backwards finds nothing on a quiet chain: Mainnet Beta goes days
// between transactions, so an explorer restart showed an empty list although every transaction
// was on the chain (2026-11-27).
//
// Every successful transaction emits an event from one of the protocol's module accounts:
// transfers (2), monetary operations (3), contracts (4), registries and governance (5), payments
// (6), the bridge (8) and the validator registry (10). Their newest events are merged here.
// A failed transaction emits nothing and is found by its id or in its block.

import { RpcError, rpc } from "./rpc";
import { txLine } from "./lines";
import type { TxLine } from "$lib/types";

const MODULES = [2, 3, 4, 5, 6, 8, 10] as const;

/** A position in the chain: transaction `index` of block `height`. */
export type Position = { height: number; index: number };

/** "4165445:0", the cursor older pages are addressed by. */
export function positionText(p: Position): string {
  return `${p.height}:${p.index}`;
}

export function parsePosition(text: string | null): Position | null {
  const match = text === null ? null : /^(\d+):(\d+)$/.exec(text);
  return match ? { height: Number(match[1]), index: Number(match[2]) } : null;
}

// A module address is 19 zero bytes and the module id, written with its checksum casing. Ids
// with a hexadecimal letter (10 is "0a") have a casing that depends on the network, so both are
// tried once and the one the node accepts is kept.
const accepted = new Map<number, string>();

function candidates(id: number): string[] {
  const hex = id.toString(16).padStart(40, "0");
  const lower = `alt:${hex}`;
  const upper = `alt:${hex.toUpperCase()}`;
  return lower === upper ? [lower] : [lower, upper];
}

async function moduleEvents(id: number, limit: number, before: Position | null) {
  const known = accepted.get(id);
  for (const emitter of known ? [known] : candidates(id)) {
    try {
      const page = await rpc.events(emitter, limit, before ? `${before.height}:${before.index}:0` : undefined);
      accepted.set(id, emitter);
      return page.events;
    } catch (error) {
      // Wrong checksum casing: try the other one. Anything else is a real failure.
      if (!(error instanceof RpcError) || error.status !== 400 || known) throw error;
    }
  }
  return [];
}

/**
 * Up to `limit` transactions strictly older than `before` (newest first), and the cursor of the
 * next page when there may be more.
 */
export async function recentTransactions(limit: number, before: Position | null): Promise<{ lines: TxLine[]; next: Position | null }> {
  const pages = await Promise.all(MODULES.map((id) => moduleEvents(id, limit, before)));
  const byTx = new Map<string, Position>();
  let full = false;
  for (const events of pages) {
    if (events.length >= limit) full = true;
    for (const e of events) {
      if (!byTx.has(e.txId)) byTx.set(e.txId, { height: e.height, index: e.index });
    }
  }
  const ordered = [...byTx.entries()]
    .sort(([, a], [, b]) => b.height - a.height || b.index - a.index)
    .slice(0, limit);
  const times = new Map<number, number>();
  const lines: TxLine[] = [];
  for (const [txId, at] of ordered) {
    if (!times.has(at.height)) times.set(at.height, (await rpc.blockAt(at.height)).protocolTimeMs);
    lines.push(txLine(await rpc.transaction(txId), times.get(at.height) ?? 0));
  }
  const last = ordered.at(-1)?.[1] ?? null;
  const more = full || byTx.size > ordered.length;
  return { lines, next: more && last ? last : null };
}
