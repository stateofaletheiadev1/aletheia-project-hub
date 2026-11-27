// Follows the node's finalized head and keeps what the live pages need in memory: the latest
// blocks, the latest transactions and the network figures. On start the follower loads recent
// blocks for the streams, then reads older blocks in the background: back to its saved count
// (checkpoint.ts) for the transaction total, and back seven days for the per-minute history.
// One follower per server process, shared by every connected browser.

import { rpc } from "./rpc";
import { recentTransactions } from "./recent";
import { loadCheckpoint, saveCheckpoint, type Checkpoint } from "./checkpoint";
import { txLine as line } from "./lines";
import type { BlockSummary, Stats, StreamMessage, TxLine } from "$lib/types";

const KEEP_BLOCKS = 150;
const KEEP_TXS = 60;
/** Transactions per block read for the stream; the block page lists all of them. */
const TXS_PER_BLOCK = 12;
const POLL_MS = 400;
const SUPPLY_EVERY_MS = 5_000;
const BACKFILL_CONCURRENCY = 4;
/** Pause between backfill chunks, so reading old blocks never crowds out the node's other
 * clients (they share its request budget from loopback). */
const BACKFILL_PAUSE_MS = 100;
/** How often the count is saved once it reaches genesis. */
const SAVE_EVERY_MS = 60_000;

type Listener = (message: StreamMessage) => void;

/** One minute of protocol time: what the chain did in it. */
export interface Minute {
  readonly t: number;
  blocks: number;
  txs: number;
  eu: number;
}
/** Minutes of history kept for the analytics (seven days). */
const KEEP_MINUTES = 7 * 24 * 60;

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
  /** Transactions in heights [countedFrom, head], plus the saved count once merged. */
  private counted = 0;
  private countedFrom = 0;
  /** The saved count from genesis, if any; merged once the backfill reaches its height. */
  private checkpoint: Checkpoint | null = null;
  /** `counted` covers every height from genesis to the head. */
  private countComplete = false;
  private savedAt = 0;
  private aey: string | null = null;
  private validatorCount: number | null = null;
  private validatorMode: "validator-set" | "single-producer" | null = null;
  private alnt: string | null = null;
  private supplyAt = 0;
  private started = false;
  private minutes = new Map<number, Minute>();
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

  /** Adds a block to its minute of protocol time. */
  private record(block: BlockSummary): void {
    const t = Math.floor(block.protocolTimeMs / 60_000) * 60_000;
    const minute = this.minutes.get(t) ?? { t, blocks: 0, txs: 0, eu: 0 };
    minute.blocks += 1;
    minute.txs += block.txCount;
    minute.eu += block.euUsed;
    this.minutes.set(t, minute);
    if (this.minutes.size > KEEP_MINUTES) {
      const oldest = Math.min(...this.minutes.keys());
      this.minutes.delete(oldest);
    }
  }

  /** Per-minute history, oldest first, and how far back it is complete. */
  analytics(): { minutes: Minute[]; complete: boolean; latestMs: number | null } {
    const minutes = [...this.minutes.values()].sort((a, b) => a.t - b.t).map((m) => ({ ...m }));
    const oldest = minutes[0]?.t ?? null;
    const latest = this.blocks[0]?.protocolTimeMs ?? null;
    // Complete when the history reaches genesis or spans everything the explorer keeps.
    const spansKept = oldest !== null && latest !== null && latest - oldest >= (KEEP_MINUTES - 1) * 60_000;
    return { minutes, complete: this.countedFrom === 0 || spansKept, latestMs: latest };
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
      countedFromGenesis: this.countComplete,
      avgBlockMs: steps > 0 ? Math.round(span / steps) : null,
      latestTimeMs: latest?.protocolTimeMs ?? null,
      txsLastMinute: latest
        ? this.blocks.filter((b) => latest.protocolTimeMs - b.protocolTimeMs < 60_000).reduce((sum, b) => sum + b.txCount, 0)
        : 0,
      proposers: new Set(this.blocks.map((b) => b.proposer)).size,
      validators: this.validatorCount,
      validatorMode: this.validatorMode,
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
      const set = await rpc.validators().catch(() => null);
      if (set) {
        this.validatorMode = set.mode;
        // A single-producer chain has exactly one block producer and no recorded set.
        this.validatorCount = set.mode === "single-producer" ? 1 : set.validators.length;
      }
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
      this.record(block);
      this.blocks = [block, ...this.blocks].slice(0, KEEP_BLOCKS);
      this.txs = [...txs, ...this.txs].slice(0, KEEP_TXS);
      this.emit({ kind: "block", stats: this.stats(), block, txs });
    }
    if (this.countComplete && Date.now() - this.savedAt > SAVE_EVERY_MS) {
      this.savedAt = Date.now();
      void saveCheckpoint({ chainId: this.chainId, height: this.head, txs: this.counted });
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
    // On a quiet chain the latest blocks hold few transactions or none: fill the stream from the
    // node's event index so a restart never shows an empty list (2026-11-27).
    if (txs.length < KEEP_TXS) {
      const oldest = blocks.at(-1);
      const before = oldest ? { height: oldest.height, index: 0 } : null;
      const older = await recentTransactions(KEEP_TXS - txs.length, before).catch(() => ({ lines: [] as TxLine[], next: null }));
      txs.push(...older.lines);
    }
    this.blocks = blocks;
    this.txs = txs.slice(0, KEEP_TXS);
    this.head = target;
    this.counted = blocks.reduce((sum, b) => sum + b.txCount, 0);
    for (const block of blocks) this.record(block);
    this.countedFrom = blocks.at(-1)?.height ?? target;
    this.checkpoint = await loadCheckpoint(this.chainId);
    this.mergeCheckpoint();
    this.emit(this.snapshot());
    void this.countBack();
  }

  /** Adds the saved count once the backfill has reached the height just above it. */
  private mergeCheckpoint(): void {
    const saved = this.checkpoint;
    if (this.countComplete || !saved || saved.height > this.head) return;
    if (saved.height >= this.countedFrom) {
      // A quick restart: the saved count already covers some of the blocks loaded at start.
      // Count only those above it.
      const above = this.blocks.filter((b) => b.height > saved.height).reduce((sum, b) => sum + b.txCount, 0);
      this.counted = saved.txs + above;
      this.countComplete = true;
    } else if (this.countedFrom === saved.height + 1) {
      this.counted += saved.txs;
      this.countComplete = true;
    }
  }

  /** Whether the per-minute history already spans the seven days the explorer keeps. */
  private historyFull(oldestReadMs: number): boolean {
    const latest = this.blocks[0]?.protocolTimeMs;
    return latest !== undefined && latest - oldestReadMs >= KEEP_MINUTES * 60_000;
  }

  /**
   * Reads older heights downwards: counting their transactions until the saved count (or
   * genesis) is reached, and recording their minutes until seven days of history are kept.
   * Paced, so it never takes the node's request budget from other clients.
   */
  private async countBack(): Promise<void> {
    const chunk = 64;
    while (this.countedFrom > 0) {
      const top = this.countedFrom - 1;
      const heights = Array.from({ length: Math.min(chunk, top + 1) }, (_, i) => top - i);
      const saved = this.checkpoint;
      let sum = 0;
      let oldestMs = Number.POSITIVE_INFINITY;
      try {
        await pool(heights, BACKFILL_CONCURRENCY, async (height) => {
          // Await first, then add: `sum += await …` reads `sum` before the await and loses
          // the additions of the other lanes.
          const block = await rpc.blockAt(height);
          if (!this.countComplete && (!saved || height > saved.height)) sum += block.txCount;
          oldestMs = Math.min(oldestMs, block.protocolTimeMs);
          this.record(block);
        });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        continue;
      }
      if (!this.countComplete) this.counted += sum;
      this.countedFrom = heights.at(-1) ?? 0;
      if (!this.countComplete && saved && this.countedFrom <= saved.height + 1) {
        // The chunk reached the saved height; the heights at or below it were not added.
        this.counted += saved.txs;
        this.countComplete = true;
      }
      if (this.countedFrom === 0 && !this.countComplete) this.countComplete = true;
      this.emit({ kind: "stats", stats: this.stats() });
      if (this.countComplete && this.historyFull(oldestMs)) break;
      await new Promise((resolve) => setTimeout(resolve, BACKFILL_PAUSE_MS));
    }
    if (this.countComplete) {
      this.savedAt = Date.now();
      await saveCheckpoint({ chainId: this.chainId, height: this.head, txs: this.counted });
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
