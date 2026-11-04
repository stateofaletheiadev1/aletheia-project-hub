// The page's handle on the wallet worker. One worker per unlocked session; `terminate` throws it
// away so nothing it held survives a lock (wallet prompt 11.3).

import type { RequestEnvelope, WalletErrorKind, WalletRequest, WalletResponses, WorkerMessage } from "./protocol";

export class WalletWorkerError extends Error {
  override name = "WalletWorkerError";
  constructor(
    readonly kind: WalletErrorKind,
    message: string,
  ) {
    super(message);
  }
}

type Pending = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

export class WalletWorker {
  #worker: Worker | null = null;
  #pending = new Map<number, Pending>();
  #next = 0;

  #ensure(): Worker {
    if (this.#worker) return this.#worker;
    const worker = new Worker(new URL("./wallet.worker.ts", import.meta.url), {
      type: "module",
      name: "aletheia-vault",
    });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new WalletWorkerError(message.error.kind, message.error.message));
    };
    worker.onerror = () => this.#failAll("the wallet worker stopped");
    this.#worker = worker;
    return worker;
  }

  #failAll(message: string) {
    for (const pending of this.#pending.values()) pending.reject(new WalletWorkerError("internal", message));
    this.#pending.clear();
  }

  request<R extends WalletRequest>(request: R): Promise<WalletResponses[R["op"]]> {
    const worker = this.#ensure();
    const id = ++this.#next;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      const envelope: RequestEnvelope = { id, request };
      worker.postMessage(envelope);
    });
  }

  /** Wipes the session inside the worker, then discards the worker itself. */
  async terminate(): Promise<void> {
    const worker = this.#worker;
    if (!worker) return;
    try {
      await Promise.race([this.request({ op: "lock" }), new Promise((resolve) => setTimeout(resolve, 300))]);
    } catch {
      // The worker is discarded either way.
    }
    worker.terminate();
    this.#worker = null;
    this.#failAll("the wallet was locked");
  }
}
