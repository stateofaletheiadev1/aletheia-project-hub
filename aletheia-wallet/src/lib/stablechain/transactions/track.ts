// Tracking a submitted transfer to finality (wallet prompt 13.1 step 9-10). The node has no
// status stream (ADR-0004) and reports a transaction only once finalized, so the tracker polls
// `getTransaction` with backoff. It reports expiry only when the finalized slot has passed the
// transfer's expiry slot and one more lookup still finds nothing; "delayed" is never failure.

import { ChainError } from "../rpc/errors";
import type { ChainClient } from "../rpc/client";
import type { FinalizedTransaction } from "../rpc/types";

export type TrackUpdate =
  | { readonly kind: "pending"; readonly attempt: number; readonly delayed: boolean }
  | { readonly kind: "finalized"; readonly tx: FinalizedTransaction }
  | { readonly kind: "expired" };

export interface TrackOptions {
  readonly expirySlot: number;
  readonly submittedAt: number;
  readonly onUpdate?: (update: TrackUpdate) => void;
  readonly signal?: AbortSignal;
  /** After this long without finality the transfer is shown as delayed (not lost). */
  readonly delayedAfterMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** 600 ms, growing to 4 s: finality is about one second when the network is healthy. */
export function backoff(attempt: number): number {
  return Math.min(4_000, 600 * 1.4 ** attempt);
}

async function lookup(client: ChainClient, txId: string): Promise<FinalizedTransaction | null> {
  try {
    return await client.transaction(txId);
  } catch (error) {
    if (
      error instanceof ChainError &&
      (error.info.kind === "NotFound" || error.info.kind === "NetworkUnreachable" || error.info.kind === "RateLimited")
    ) {
      return null;
    }
    throw error;
  }
}

export async function trackTransaction(client: ChainClient, txId: string, options: TrackOptions): Promise<TrackUpdate> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const delayedAfterMs = options.delayedAfterMs ?? 12_000;
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    const found = await lookup(client, txId);
    if (found) {
      const update: TrackUpdate = { kind: "finalized", tx: found };
      options.onUpdate?.(update);
      return update;
    }
    let headSlot: number | null = null;
    try {
      headSlot = (await client.finalizedHead()).slot;
    } catch (error) {
      if (!(error instanceof ChainError)) throw error;
    }
    if (headSlot !== null && headSlot > options.expirySlot) {
      // The window closed. One last lookup covers inclusion in the very last slot.
      const last = await lookup(client, txId);
      const update: TrackUpdate = last ? { kind: "finalized", tx: last } : { kind: "expired" };
      options.onUpdate?.(update);
      return update;
    }
    options.onUpdate?.({ kind: "pending", attempt, delayed: now() - options.submittedAt > delayedAfterMs });
    await sleep(backoff(attempt), options.signal);
  }
}
