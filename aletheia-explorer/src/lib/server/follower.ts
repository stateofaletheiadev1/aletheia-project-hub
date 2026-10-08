// Follows the node's finalized head and keeps what the live pages need in memory: the latest
// blocks, the latest transactions and the network figures. There is no database: on start
// the follower loads recent blocks for the streams, then counts transactions back to genesis
// in the background. One follower per server process, shared by every connected browser.

import { rpc } from "./rpc";
import { txLine as line } from "./lines";
import type { BlockSummary, Stats, StreamMessage, TxLine } from "$lib/types";

const KEEP_BLOCKS = 150;
const KEEP_TXS = 60;
/** Transactions per block read for the stream; the block page lists all of them. */
const TXS_PER_BLOCK = 12;
const POLL_MS = 400;
const SUPPLY_EVERY_MS = 5_000;
const BACKFILL_CONCURRENCY = 4;

type Listener = (message: StreamMessage) => void;

async function pool<T>(items: readonly T[], width: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await work(item);
    }
  });
  await Promise.all(lanes);
}

class Follower {
  private blocks: BlockSummary[] = [];
  private txs: TxLine[] = [];
  private listeners = new Set<Listener>();
  private online = false;
  private network = "devnet";
  private chainId = 0;
  private protocolVersion = 1;
  private head = -1;
  /** Transactions in heights [countedFrom, head]. */
  private counted = 0;
  private countedFrom = 0;
  private aey: string | null = null;
  private alnt: string | null = null;
  private supplyAt = 0;
  private started = false;
  private lastError = "";

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.loop();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): StreamMessage {
    return { kind: "snapshot", stats: this.stats(), blocks: this.blocks, txs: this.txs };
  }

  stats(): Stats {
    const latest = this.blocks[0];
    const oldest = this.blocks[Math.min(this.blocks.length, 20) - 1];
    const span = latest && oldest && latest !== oldest ? latest.protocolTimeMs - oldest.protocolTimeMs : 0;
    const steps = latest && oldest ? latest.height - oldest.height : 0;
    return {
      online: this.online,
      network: this.network,
      chainId: this.chainId,
      protocolVersion: this.protocolVersion,
      height: Math.max(this.head, 0),
      epoch: latest?.epoch ?? 0,
      totalTxs: this.counted,
      countedFromGenesis: this.countedFrom === 0,
      avgBlockMs: steps > 0 ? Math.round(span / steps) : null,
      latestTimeMs: latest?.protocolTimeMs ?? null,
      txsLastMinute: latest
        ? this.blocks.filter((b) => latest.protocolTimeMs - b.protocolTimeMs < 60_000).reduce((sum, b) => sum + b.txCount, 0)
        : 0,
      proposers: new Set(this.blocks.map((b) => b.proposer)).size,
      aeyOutstanding: this.aey,
      alntOutstanding: this.alnt,
    };
  }

  private emit(message: StreamMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch {
        this.listeners.delete(listener);
      }
    }
  }

  private async loop(): Promise<void> {
    for (;;) {
      try {
        await this.tick();
        if (!this.online) {
          this.online = true;
          this.emit({ kind: "stats", stats: this.stats() });
        }
      } catch (error) {
        const message = (error as Error).message;
        if (message !== this.lastError) {
          this.lastError = message;
          console.error(`explorer follower: ${message}`);
        }
        if (this.online) {
          this.online = false;
          this.emit({ kind: "stats", stats: this.stats() });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }

  private async tick(): Promise<void> {
    const status = await rpc.status();
    this.network = status.network;
    this.chainId = status.chainId;
    this.protocolVersion = status.protocolVersion;
    if (Date.now() - this.supplyAt > SUPPLY_EVERY_MS) {
      this.supplyAt = Date.now();
      const [aey, alnt] = await Promise.all([rpc.supply("AEY").catch(() => null), rpc.supply("ALnT").catch(() => null)]);
      if (aey) this.aey = (BigInt(aey.issuedTotal) - BigInt(aey.burnedTotal)).toString();
      if (alnt) this.alnt = (BigInt(alnt.issuedTotal) - BigInt(alnt.burnedTotal)).toString();
    }
    const target = status.finalizedHeight;
    if (this.head < 0) {
      await this.prime(target);
      return;
    }
    // At most a few blocks per tick, so a long outage catches up without a burst.
    const until = Math.min(target, this.head + 20);
    for (let height = this.head + 1; height <= until; height++) {
      const block = await rpc.blockAt(height);
      const txs = await this.lines(block);
      this.head = height;
      this.counted += block.txCount;
      this.blocks = [block, ...this.blocks].slice(0, KEEP_BLOCKS);
      this.txs = [...txs, ...this.txs].slice(0, KEEP_TXS);
      this.emit({ kind: "block", stats: this.stats(), block, txs });
    }
  }

  /** First contact: the latest blocks for the streams, then the count back to genesis. */
  private async prime(target: number): Promise<void> {
    const heights = Array.from({ length: Math.min(KEEP_BLOCKS, target + 1) }, (_, i) => target - i);
    const loaded = new Map<number, BlockSummary>();
    await pool(heights, BACKFILL_CONCURRENCY, async (height) => {
      loaded.set(height, await rpc.blockAt(height));
    });
    const blocks = heights.map((h) => loaded.get(h)).filter((b): b is BlockSummary => b !== undefined);
    const txs: TxLine[] = [];
    for (const block of blocks) {
      if (txs.length >= KEEP_TXS) break;
      txs.push(...(await this.lines(block)));
    }
    this.blocks = blocks;
    this.txs = txs.slice(0, KEEP_TXS);
    this.head = target;
    this.counted = blocks.reduce((sum, b) => sum + b.txCount, 0);
    this.countedFrom = blocks.at(-1)?.height ?? target;
    this.emit(this.snapshot());
    void this.countBack();
  }

  /** Walks the older heights down to genesis, adding their transaction counts. */
  private async countBack(): Promise<void> {
    const chunk = 64;
    while (this.countedFrom > 0) {
      const top = this.countedFrom - 1;
      const heights = Array.from({ length: Math.min(chunk, top + 1) }, (_, i) => top - i);
      let sum = 0;
      try {
        await pool(heights, BACKFILL_CONCURRENCY, async (height) => {
          // Await first, then add: `sum += await …` reads `sum` before the await and loses
          // the additions of the other lanes.
          const block = await rpc.blockAt(height);
          sum += block.txCount;
        });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        continue;
      }
      this.counted += sum;
      this.countedFrom = heights.at(-1) ?? 0;
      this.emit({ kind: "stats", stats: this.stats() });
    }
  }

  private async lines(block: BlockSummary): Promise<TxLine[]> {
    const ids = block.transactions.slice(0, TXS_PER_BLOCK);
    const out: (TxLine | null)[] = new Array(ids.length).fill(null);
    await pool(
      ids.map((id, i) => [id, i] as const),
      4,
      async ([id, i]) => {
        out[i] = line(await rpc.transaction(id), block.protocolTimeMs);
      },
    );
    return out.filter((t): t is TxLine => t !== null);
  }
}

// One follower per process, kept across dev-server module reloads.
const shared = globalThis as typeof globalThis & { __aletheiaFollower?: Follower };
export const follower: Follower = (shared.__aletheiaFollower ??= new Follower());
