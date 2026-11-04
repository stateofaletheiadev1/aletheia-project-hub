import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainStream, reconnectDelay, type StreamState } from "$lib/stablechain/ws/stream";
import { decodeBody, encodeBody, encodePreview } from "$lib/stablechain/transactions/body";
import { AceError, AceReader } from "$lib/stablechain/encoding/ace";
import { recordFromTransaction, slotTime } from "$lib/state/ledger.svelte";

class FakeSocket {
  static all: FakeSocket[] = [];
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(text: string) {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  reply(id: number, result: unknown) {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: "2.0", id, result }) });
  }
  push(subscription: string, result: unknown) {
    this.onmessage?.({
      data: JSON.stringify({ jsonrpc: "2.0", method: "subscription", params: { subscription, result } }),
    });
  }
}

afterEach(() => {
  FakeSocket.all = [];
  vi.useRealTimers();
});

describe("chain stream", () => {
  it("subscribes, routes notifications and restores subscriptions after a reconnect", () => {
    vi.useFakeTimers();
    const states: StreamState[] = [];
    const stream = new ChainStream("ws://node/ws/v1", {
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      onState: (s) => states.push(s),
      random: () => 0,
    });
    const blocks: unknown[] = [];
    const accounts: unknown[] = [];
    stream.subscribe({ topic: "finalizedBlocks" }, (b) => blocks.push(b));
    const stopAccount = stream.subscribe({ topic: "account", address: "alt:x" }, (a) => accounts.push(a));
    const first = FakeSocket.all[0]!;
    first.open();
    expect(first.sent.map((m) => (m.params as { topic: string }).topic)).toEqual(["finalizedBlocks", "account"]);
    first.reply(first.sent[0]!.id as number, { subscription: "7" });
    first.reply(first.sent[1]!.id as number, { subscription: "8" });
    first.push("7", { height: 10 });
    first.push("8", { transaction: { txId: "t" } });
    first.push("99", { ignored: true });
    first.onmessage?.({ data: "not json" });
    expect(blocks).toEqual([{ height: 10 }]);
    expect(accounts).toEqual([{ transaction: { txId: "t" } }]);

    // The node goes away: the stream retries with backoff and subscribes again.
    first.close();
    expect(stream.state).toBe("closed");
    vi.advanceTimersByTime(600);
    const second = FakeSocket.all[1]!;
    second.open();
    expect(second.sent).toHaveLength(2);
    second.reply(second.sent[0]!.id as number, { subscription: "1" });
    second.push("1", { height: 11 });
    expect(blocks).toEqual([{ height: 10 }, { height: 11 }]);

    // A silent block stream is treated as stalled and reopened.
    vi.advanceTimersByTime(10_001);
    expect(second.closed).toBe(true);

    stopAccount();
    stream.close();
    expect(states).toContain("open");
    expect(stream.state).toBe("idle");
  });

  it("unsubscribes on the server and closes when the last subscription ends", () => {
    const stream = new ChainStream("ws://node/ws/v1", { WebSocketImpl: FakeSocket as unknown as typeof WebSocket });
    const stop = stream.subscribe({ topic: "transactionStatus", txId: "alt:T1" }, () => undefined);
    const socket = FakeSocket.all[0]!;
    socket.open();
    socket.reply(socket.sent[0]!.id as number, { subscription: "3" });
    stop();
    expect(socket.sent[1]).toMatchObject({ method: "unsubscribe", params: { subscription: "3" } });
    expect(socket.closed).toBe(true);
    // A late subscribe on an open socket is sent at once.
    const again = new ChainStream("ws://node/ws/v1", { WebSocketImpl: FakeSocket as unknown as typeof WebSocket });
    again.subscribe({ topic: "finalizedBlocks" }, () => undefined);
    FakeSocket.all[1]!.open();
    again.subscribe({ topic: "account", address: "alt:y" }, () => undefined);
    expect(FakeSocket.all[1]!.sent).toHaveLength(2);
  });

  it("reports closed when no WebSocket exists and backs off up to 30 s", () => {
    const states: StreamState[] = [];
    const none = new ChainStream("ws://node", {
      WebSocketImpl: undefined as unknown as typeof WebSocket,
      onState: (s) => states.push(s),
    });
    const original = globalThis.WebSocket;
    // @ts-expect-error simulate an environment without WebSocket
    delete globalThis.WebSocket;
    none.subscribe({ topic: "finalizedBlocks" }, () => undefined);
    globalThis.WebSocket = original;
    expect(states).toEqual(["closed"]);
    expect(reconnectDelay(0, () => 0)).toBe(500);
    expect(reconnectDelay(0, () => 1)).toBe(1000);
    expect(reconnectDelay(10, () => 1)).toBe(30_000);
  });
});

describe("unsigned preview", () => {
  it("carries the key and an empty signature list", () => {
    const body = {
      version: 1,
      chainId: 7771,
      networkKind: "devnet" as const,
      sender: new Uint8Array(20).fill(1),
      nonce: 0n,
      feeAsset: 2,
      maxFee: 1n,
      euLimit: 1n,
      validFromSlot: 1n,
      expirySlot: 2n,
      memo: new Uint8Array(),
      recipient: new Uint8Array(20).fill(2),
      asset: 1,
      amount: 1n,
    };
    const bytes = encodeBody(body);
    const preview = encodePreview(bytes, new Uint8Array(32).fill(9));
    expect(decodeBody(preview.slice(0, bytes.length))).toEqual(body);
    const reader = new AceReader(preview.slice(bytes.length));
    expect([reader.u8(), reader.u8(), reader.u32(), reader.u8()]).toEqual([1, 1, 1, 1]);
    expect(reader.bytes(48)).toEqual(new Uint8Array(32).fill(9));
    expect(reader.u32()).toBe(0);
    reader.finish();
    expect(() => encodePreview(bytes, new Uint8Array(31))).toThrow(AceError);
  });
});

describe("activity records", () => {
  it("dates history by the chain's slot clock", () => {
    expect(slotTime({ genesisMs: 1_000, slotMs: 500 }, 4)).toBe(3_000);
    expect(slotTime(null, 4)).toBeNull();
    const tx = {
      txId: "alt:T1",
      status: "FINALIZED" as const,
      block: { height: 9, id: "b", slot: 9, index: 0 },
      sender: "alt:me",
      nonce: 0,
      type: "Transfer",
      txType: 1,
      fee: { asset: "ALnT", maxFee: "1", euLimit: 1 },
      validFromSlot: 1,
      expirySlot: 50,
      transfer: { recipient: "alt:you", asset: "ALnT", amount: "5", display: "0.005" },
      receipt: {
        status: "FAILED_EXECUTION" as const,
        errorCode: 1,
        errorName: "INSUFFICIENT_BALANCE",
        euUsed: 1,
        feeCharged: "1",
        events: 0,
      },
    };
    expect(recordFromTransaction(tx, "alt:me", 3_000)).toMatchObject({
      direction: "out",
      status: "failed-on-chain",
      seenAt: 3_000,
      errorName: "INSUFFICIENT_BALANCE",
    });
    expect(recordFromTransaction(tx, "alt:you")?.direction).toBe("in");
    expect(recordFromTransaction(tx, "alt:other")).toBeNull();
    expect(recordFromTransaction({ ...tx, transfer: undefined }, "alt:me")).toBeNull();
  });
});
