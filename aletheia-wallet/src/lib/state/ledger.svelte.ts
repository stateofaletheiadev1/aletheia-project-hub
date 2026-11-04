// Balances and activity for the active account (wallet prompt 8.1, 12.5).
//
// With a current node (ADR-064 there) activity is read from `getAccountHistory`, newest first and
// paged, and kept live by the `account` WebSocket subscription; finality of submitted transfers
// arrives through `transactionStatus`. Against a node without those (Mainnet Beta before its
// upgrade) the wallet falls back to what it did before: transfers it submitted, tracked by
// polling, plus transfers found by scanning the blocks in which a balance changed (ADR-0004).

import { config } from "$lib/config";
import { ASSETS, type AssetCode } from "$lib/stablechain/assets/assets";
import { ChainError, describeChainError } from "$lib/stablechain/rpc/errors";
import type { FinalizedTransaction } from "$lib/stablechain/rpc/types";
import { trackTransaction } from "$lib/stablechain/transactions/track";
import { db, type ActivityRecord } from "$lib/storage/db";
import { log } from "$lib/security/redact";
import { chain } from "./chain";
import { stream, streamStatus } from "./stream.svelte";

export interface Holding {
  readonly available: bigint;
  readonly locked: bigint;
}

export interface Snapshot {
  readonly address: string;
  readonly height: number;
  readonly at: number;
  readonly AEY: Holding;
  readonly ALnT: Holding;
}

const POLL_MS = 2_500;
/** With live account events, balances are re-read on events and only rarely otherwise. */
const POLL_STREAMING_MS = 15_000;
const HISTORY_PAGE = 25;
/** About ten minutes of 500 ms blocks, for the fallback scan. */
const SCAN_LIMIT = 1_200;
const SCAN_PAUSE_MS = 110;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function same(a: Snapshot, b: Snapshot): boolean {
  return (
    a.AEY.available === b.AEY.available &&
    a.AEY.locked === b.AEY.locked &&
    a.ALnT.available === b.ALnT.available &&
    a.ALnT.locked === b.ALnT.locked
  );
}

/** The chain's clock: protocol time of a slot, from block 0 and the finalized head. */
export interface ChainClock {
  readonly genesisMs: number;
  readonly slotMs: number;
}

export function slotTime(clock: ChainClock | null, slot: number): number | null {
  return clock ? clock.genesisMs + slot * clock.slotMs : null;
}

export function recordFromTransaction(
  tx: FinalizedTransaction,
  me: string,
  at: number | null = null,
): ActivityRecord | null {
  if (!tx.transfer) return null;
  const outgoing = tx.sender === me;
  const incoming = tx.transfer.recipient === me;
  if (!outgoing && !incoming) return null;
  const failed = tx.receipt && tx.receipt.status !== "SUCCESS";
  const when = at ?? Date.now();
  return {
    txId: tx.txId,
    network: config.network,
    direction: outgoing && incoming ? "self" : outgoing ? "out" : "in",
    sender: tx.sender,
    recipient: tx.transfer.recipient,
    asset: tx.transfer.asset,
    amount: tx.transfer.amount,
    fee: tx.receipt?.feeCharged ?? null,
    feeAsset: tx.fee.asset,
    memo: null,
    status: failed ? "failed-on-chain" : "finalized",
    errorName: failed ? (tx.receipt?.errorName ?? null) : null,
    height: tx.block.height,
    expirySlot: tx.expirySlot,
    seenAt: when,
    finalizedAt: when,
  };
}

function methodMissing(error: unknown): boolean {
  return error instanceof ChainError && error.info.kind === "NodeError" && error.info.code === -32601;
}

class Ledger {
  snapshot = $state.raw<Snapshot | null>(null);
  loading = $state(true);
  problem = $state<ReturnType<typeof describeChainError> | null>(null);
  activity = $state.raw<ActivityRecord[]>([]);
  scanning = $state(false);
  /** Whether the node serves account history; null until asked. */
  historySupported = $state<boolean | null>(null);
  /** Cursor for the next history page, or null at the end. */
  historyNext = $state<string | null>(null);
  loadingMore = $state(false);
  /** Oldest height the fallback scan looked at in this session. */
  scannedFrom = $state<number | null>(null);

  #address: string | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #tracking = new Set<string>();
  #generation = 0;
  #clock: ChainClock | null = null;
  #unsubscribe: (() => void) | null = null;

  holding(asset: AssetCode): Holding | null {
    return this.snapshot ? this.snapshot[asset] : null;
  }

  async start(address: string): Promise<void> {
    if (this.#address === address) return;
    this.stop();
    const generation = ++this.#generation;
    this.#address = address;
    this.snapshot = null;
    this.loading = true;
    this.problem = null;
    this.scannedFrom = null;
    this.historyNext = null;
    await this.#loadActivity(address);
    if (generation !== this.#generation) return;
    for (const record of this.activity) if (record.status === "submitted") this.#resume(record);
    this.#unsubscribe =
      stream?.subscribe({ topic: "account", address }, (result) => void this.#onAccountEvent(address, result)) ?? null;
    void this.#loadHistory(address, generation);
    await this.#poll(generation, true);
  }

  stop(): void {
    this.#generation++;
    this.#address = null;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** Re-read balances now (after a transfer finalizes). */
  refresh(): void {
    if (!this.#address) return;
    if (this.#timer) clearTimeout(this.#timer);
    void this.#poll(this.#generation, false);
  }

  async #clockFor(): Promise<ChainClock | null> {
    if (this.#clock) return this.#clock;
    try {
      const [genesis, head] = await Promise.all([chain.blockByHeight(0), chain.finalizedHead()]);
      if (head.slot > 0) {
        this.#clock = {
          genesisMs: genesis.protocolTimeMs,
          slotMs: Math.round((head.protocolTimeMs - genesis.protocolTimeMs) / head.slot),
        };
      }
    } catch {
      this.#clock = null;
    }
    return this.#clock;
  }

  async #loadActivity(address: string): Promise<void> {
    try {
      const rows = await db.all("activity");
      this.activity = rows
        .filter((r) => r.network === config.network && (r.sender === address || r.recipient === address))
        .sort((a, b) => b.seenAt - a.seenAt);
    } catch {
      this.activity = [];
    }
  }

  async #loadHistory(address: string, generation: number, before: string | null = null): Promise<void> {
    try {
      const page = await chain.accountHistory(address, { limit: HISTORY_PAGE, before });
      if (generation !== this.#generation) return;
      this.historySupported = true;
      const clock = await this.#clockFor();
      for (const tx of page.transactions) {
        const record = recordFromTransaction(tx, address, slotTime(clock, tx.block.slot));
        if (record) await this.upsert(record);
      }
      this.historyNext = page.next;
    } catch (error) {
      if (methodMissing(error)) this.historySupported = false;
      else if (!(error instanceof ChainError)) log.warn("history read stopped", error);
    }
  }

  /** The next page of history (Activity's "Show more"). */
  async loadMore(): Promise<void> {
    if (!this.#address || !this.historyNext || this.loadingMore) return;
    this.loadingMore = true;
    try {
      await this.#loadHistory(this.#address, this.#generation, this.historyNext);
    } finally {
      this.loadingMore = false;
    }
  }

  async #onAccountEvent(address: string, result: unknown): Promise<void> {
    const tx = (result as { transaction?: FinalizedTransaction } | null)?.transaction;
    if (!tx || address !== this.#address) return;
    const record = recordFromTransaction(tx, address, slotTime(await this.#clockFor(), tx.block.slot));
    if (record) {
      const existing = this.activity.find((r) => r.txId === record.txId);
      await this.upsert({ ...record, memo: existing?.memo ?? null });
    }
    this.refresh();
  }

  async #read(address: string): Promise<Snapshot> {
    const balances = await chain.balances(address);
    const pick = (code: AssetCode): Holding => {
      const row = balances.find((b) => b.asset === code);
      return row ? { available: BigInt(row.available), locked: BigInt(row.locked) } : { available: 0n, locked: 0n };
    };
    const height = Math.max(...balances.map((b) => b.height));
    return { address, height, at: Date.now(), AEY: pick("AEY"), ALnT: pick("ALnT") };
  }

  async #poll(generation: number, first: boolean): Promise<void> {
    const address = this.#address;
    if (!address || generation !== this.#generation) return;
    try {
      const next = await this.#read(address);
      if (generation !== this.#generation) return;
      const previous = first ? await this.#stored(address) : this.snapshot;
      this.snapshot = next;
      this.loading = false;
      this.problem = null;
      void db
        .put("meta", { ...next, AEY: { ...next.AEY }, ALnT: { ...next.ALnT } }, `balances:${address}`)
        .catch(() => undefined);
      // Only a node without account history needs the block scan.
      if (this.historySupported === false && previous && !same(previous, next) && next.height > previous.height) {
        void this.#scan(address, Math.max(previous.height + 1, next.height - SCAN_LIMIT + 1), next.height, generation);
      }
    } catch (error) {
      this.loading = false;
      this.problem = describeChainError(error);
    }
    const wait = streamStatus.state === "open" && this.historySupported ? POLL_STREAMING_MS : POLL_MS;
    if (generation === this.#generation) this.#timer = setTimeout(() => void this.#poll(generation, false), wait);
  }

  async #stored(address: string): Promise<Snapshot | null> {
    try {
      return ((await db.get("meta", `balances:${address}`)) as Snapshot | undefined) ?? null;
    } catch {
      return null;
    }
  }

  /** Fallback: looks at blocks [from, to] for transfers to or from `address`, newest first. */
  async #scan(address: string, from: number, to: number, generation: number): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    try {
      for (let height = to; height >= from; height--) {
        if (generation !== this.#generation) return;
        const block = await chain.blockByHeight(height);
        for (const txId of block.transactions) {
          if (this.activity.some((r) => r.txId === txId && r.status !== "submitted")) continue;
          const tx = await chain.transaction(txId);
          const record = recordFromTransaction(tx, address, block.protocolTimeMs);
          if (record) await this.upsert(record);
        }
        this.scannedFrom = this.scannedFrom === null ? height : Math.min(this.scannedFrom, height);
        await pause(SCAN_PAUSE_MS);
      }
    } catch (error) {
      if (!(error instanceof ChainError)) log.warn("activity scan stopped", error);
    } finally {
      this.scanning = false;
    }
  }

  async upsert(record: ActivityRecord): Promise<void> {
    const existing = this.activity.find((r) => r.txId === record.txId);
    const merged: ActivityRecord = existing
      ? { ...existing, ...record, memo: record.memo ?? existing.memo, seenAt: Math.min(existing.seenAt, record.seenAt) }
      : record;
    this.activity = [merged, ...this.activity.filter((r) => r.txId !== record.txId)].sort(
      (a, b) => b.seenAt - a.seenAt,
    );
    try {
      await db.put("activity", merged);
    } catch {
      // Activity then lasts for this visit.
    }
  }

  /** Records a transfer this wallet just submitted and follows it to finality. */
  async submitted(record: ActivityRecord): Promise<void> {
    await this.upsert(record);
    this.#resume(record);
  }

  async #finalized(record: ActivityRecord, tx: FinalizedTransaction): Promise<void> {
    const found = recordFromTransaction(tx, record.sender, Date.now());
    await this.upsert({
      ...record,
      ...(found ?? {}),
      seenAt: record.seenAt,
      memo: record.memo,
      finalizedAt: Date.now(),
    });
    this.refresh();
  }

  #resume(record: ActivityRecord): void {
    if (this.#tracking.has(record.txId) || record.expirySlot === null) return;
    this.#tracking.add(record.txId);
    // Pushed finality when the node offers it; the polling tracker below is the fallback.
    let stop: (() => void) | undefined;
    stop = stream?.subscribe({ topic: "transactionStatus", txId: record.txId }, (result) => {
      if (result && typeof result === "object" && "block" in result)
        void this.#finalized(record, result as FinalizedTransaction);
      stop?.();
      stop = undefined;
    });
    void trackTransaction(chain, record.txId, { expirySlot: record.expirySlot, submittedAt: record.seenAt })
      .then(async (outcome) => {
        if (outcome.kind === "finalized") await this.#finalized(record, outcome.tx);
        else if (outcome.kind === "expired") await this.upsert({ ...record, status: "expired" });
      })
      .catch((error: unknown) => log.warn("tracking stopped", error))
      .finally(() => {
        stop?.();
        this.#tracking.delete(record.txId);
      });
  }
}

export const ledger = new Ledger();

export function assetDecimals(code: string): number {
  return code === "AEY" || code === "ALnT" ? ASSETS[code].decimals : 0;
}
