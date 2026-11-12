// The node's WebSocket subscriptions (`/ws/v1`, node ADR-064; wallet prompt 12.4): JSON-RPC over a
// socket with `subscribe` for finalizedBlocks, transactionStatus and account. Reconnects with
// exponential backoff and jitter, restores every subscription after a reconnect, and treats a
// silent block stream as stalled. Callers keep their polling as the fallback: when the socket is
// down nothing is lost, it is only slower.

export type StreamState = "idle" | "connecting" | "open" | "closed";

export type Topic =
  | { readonly topic: "finalizedBlocks" }
  | { readonly topic: "transactionStatus"; readonly txId: string }
  | { readonly topic: "account"; readonly address: string };

interface Subscription {
  readonly params: Topic;
  readonly onEvent: (result: unknown) => void;
  serverId: string | null;
}

export interface StreamOptions {
  readonly WebSocketImpl?: typeof WebSocket;
  readonly onState?: (state: StreamState) => void;
  /** Silence on a block stream after which the socket is reopened. */
  readonly stallMs?: number;
  readonly random?: () => number;
}

const MAX_BACKOFF_MS = 30_000;

export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
  return Math.round(base / 2 + random() * (base / 2));
}

export class ChainStream {
  readonly #url: string;
  readonly #options: StreamOptions;
  #socket: WebSocket | null = null;
  #subscriptions = new Map<number, Subscription>();
  #pending = new Map<number, number>();
  #nextLocal = 0;
  #nextRequest = 0;
  #attempt = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stall: ReturnType<typeof setTimeout> | null = null;
  #state: StreamState = "idle";
  #stopped = false;

  constructor(url: string, options: StreamOptions = {}) {
    this.#url = url;
    this.#options = options;
  }

  get state(): StreamState {
    return this.#state;
  }

  /** Subscribes; returns the function that ends the subscription. Connects on first use. */
  subscribe(params: Topic, onEvent: (result: unknown) => void): () => void {
    const local = ++this.#nextLocal;
    const subscription: Subscription = { params, onEvent, serverId: null };
    this.#subscriptions.set(local, subscription);
    this.#stopped = false;
    if (!this.#socket) this.#connect();
    else if (this.#state === "open") this.#send(local, subscription);
    return () => {
      const existing = this.#subscriptions.get(local);
      this.#subscriptions.delete(local);
      if (existing?.serverId && this.#state === "open") {
        this.#socket?.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: ++this.#nextRequest,
            method: "unsubscribe",
            params: { subscription: existing.serverId },
          }),
        );
      }
      if (this.#subscriptions.size === 0) this.close();
    };
  }

  close(): void {
    this.#stopped = true;
    if (this.#timer) clearTimeout(this.#timer);
    if (this.#stall) clearTimeout(this.#stall);
    this.#timer = this.#stall = null;
    const socket = this.#socket;
    this.#socket = null;
    socket?.close();
    this.#setState("idle");
  }

  #setState(state: StreamState) {
    if (this.#state === state) return;
    this.#state = state;
    this.#options.onState?.(state);
  }

  #connect() {
    const Impl = this.#options.WebSocketImpl ?? globalThis.WebSocket;
    if (!Impl) {
      this.#setState("closed");
      return;
    }
    this.#setState("connecting");
    let socket: WebSocket;
    try {
      socket = new Impl(this.#url);
    } catch {
      this.#retry();
      return;
    }
    this.#socket = socket;
    socket.onopen = () => {
      this.#attempt = 0;
      this.#setState("open");
      for (const [local, subscription] of this.#subscriptions) {
        subscription.serverId = null;
        this.#send(local, subscription);
      }
      this.#armStall();
    };
    socket.onmessage = (event: MessageEvent) => this.#receive(String(event.data));
    socket.onclose = () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#retry();
    };
    socket.onerror = () => socket.close();
  }

  #retry() {
    if (this.#stopped || this.#subscriptions.size === 0) {
      this.#setState("idle");
      return;
    }
    this.#setState("closed");
    const delay = reconnectDelay(this.#attempt++, this.#options.random);
    this.#timer = setTimeout(() => this.#connect(), delay);
  }

  #send(local: number, subscription: Subscription) {
    const id = ++this.#nextRequest;
    this.#pending.set(id, local);
    this.#socket?.send(JSON.stringify({ jsonrpc: "2.0", id, method: "subscribe", params: subscription.params }));
  }

  #armStall() {
    if (this.#stall) clearTimeout(this.#stall);
    const watchingBlocks = [...this.#subscriptions.values()].some((s) => s.params.topic === "finalizedBlocks");
    if (!watchingBlocks) return;
    this.#stall = setTimeout(() => this.#socket?.close(), this.#options.stallMs ?? 10_000);
  }

  #receive(text: string) {
    let message: {
      id?: unknown;
      result?: unknown;
      error?: unknown;
      method?: unknown;
      params?: { subscription?: unknown; result?: unknown };
    };
    try {
      message = JSON.parse(text) as typeof message;
    } catch {
      return;
    }
    this.#armStall();
    if (typeof message.id === "number" && this.#pending.has(message.id)) {
      const local = this.#pending.get(message.id)!;
      this.#pending.delete(message.id);
      const subscription = this.#subscriptions.get(local);
      const serverId = (message.result as { subscription?: unknown } | undefined)?.subscription;
      if (subscription && typeof serverId === "string") subscription.serverId = serverId;
      return;
    }
    if (message.method !== "subscription" || typeof message.params?.subscription !== "string") return;
    for (const subscription of this.#subscriptions.values()) {
      if (subscription.serverId === message.params.subscription) subscription.onEvent(message.params.result);
    }
  }
}
