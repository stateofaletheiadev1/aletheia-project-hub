// The browser's view of the live stream. Pages render from server data first, then this
// store takes over and keeps the streams moving without reloading.

import type { BlockSummary, Stats, StreamMessage, TxLine } from "$lib/types";

const KEEP = 60;

export class Live {
  stats = $state<Stats | null>(null);
  blocks = $state<BlockSummary[]>([]);
  txs = $state<TxLine[]>([]);
  /** False only after the live connection dropped; the first paint trusts the server's figures. */
  connected = $state(true);
  /** Heights and transaction ids that arrived live, for the ink-in animation. */
  fresh = $state(new Set<string>());
  /** Protocol time now: the latest block's time plus the wall time since it arrived. */
  now = $state(0);

  private source: EventSource | null = null;
  private arrived = 0;

  seed(message: Extract<StreamMessage, { kind: "snapshot" }>): void {
    this.stats = message.stats;
    this.arrived = Date.now();
    this.now = message.stats.latestTimeMs ?? 0;
    this.blocks = [...message.blocks];
    this.txs = [...message.txs];
  }

  connect(): () => void {
    this.source = new EventSource("/api/stream");
    this.source.onopen = () => (this.connected = true);
    this.source.onerror = () => (this.connected = false);
    this.source.onmessage = (event: MessageEvent<string>) => this.apply(JSON.parse(event.data) as StreamMessage);
    const clock = setInterval(() => {
      const base = this.stats?.latestTimeMs ?? 0;
      this.now = base + Math.min(Date.now() - this.arrived, 60_000);
    }, 1000);
    return () => {
      clearInterval(clock);
      this.source?.close();
      this.source = null;
    };
  }

  private apply(message: StreamMessage): void {
    if (message.stats.latestTimeMs !== this.stats?.latestTimeMs) {
      this.arrived = Date.now();
      this.now = message.stats.latestTimeMs ?? this.now;
    }
    this.stats = message.stats;
    if (message.kind === "snapshot") {
      this.blocks = [...message.blocks];
      this.txs = [...message.txs];
    } else if (message.kind === "block") {
      if (this.blocks[0] && message.block.height <= this.blocks[0].height) return;
      const fresh = new Set([`b${message.block.height}`, ...message.txs.map((t) => t.txId)]);
      this.fresh = fresh;
      this.blocks = [message.block, ...this.blocks].slice(0, KEEP);
      this.txs = [...message.txs, ...this.txs].slice(0, KEEP);
    }
  }
}
