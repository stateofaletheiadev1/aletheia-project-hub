// Live network state (wallet prompt 12.3, M-10). Finalized blocks are pushed over the node's
// WebSocket when it offers one; the status is still polled — every 5 s while the socket is open,
// every second when it is not (ADR-0004). Each newly finalized height ticks the seal; if heights
// stop advancing the state turns "stalled", which the seal shows in amber with words.

import { expectedNetwork } from "$lib/config";
import { ChainError, describeChainError } from "$lib/stablechain/rpc/errors";
import type { VerifiedNetwork } from "$lib/stablechain/network/gate";
import type { NetworkStatus } from "$lib/stablechain/rpc/types";
import { chain } from "./chain";
import { stream, streamStatus } from "./stream.svelte";

export type Health = "connecting" | "live" | "stalled" | "unreachable" | "wrong-network";

const POLL_MS = 1_000;
const POLL_STREAMING_MS = 5_000;
const STALL_MS = 6_000;

class NetworkState {
  health = $state<Health>("connecting");
  status = $state<NetworkStatus | null>(null);
  verified = $state.raw<VerifiedNetwork | null>(null);
  latencyMs = $state<number | null>(null);
  /** Finalized blocks observed since the page opened; drives the seal's band. */
  ticks = $state(0);
  heightAt = $state<number | null>(null);
  problem = $state<{ title: string; body: string; technical: string } | null>(null);

  #timer: ReturnType<typeof setTimeout> | null = null;
  #users = 0;
  #verifying: Promise<VerifiedNetwork | null> | null = null;
  #unsubscribe: (() => void) | null = null;

  /** Starts polling while at least one component needs it; returns the stop function. */
  use(): () => void {
    this.#users++;
    if (this.#users === 1) {
      void this.#poll();
      this.#unsubscribe = stream?.subscribe({ topic: "finalizedBlocks" }, (block) => this.#pushed(block)) ?? null;
    }
    return () => {
      this.#users--;
      if (this.#users === 0) {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = null;
        this.#unsubscribe?.();
        this.#unsubscribe = null;
      }
    };
  }

  /** Verifies now (on start, on reconnect, before approval). */
  verify(): Promise<VerifiedNetwork | null> {
    // Loaded on first use, so public pages paint without the checksum code.
    this.#verifying ??= import("$lib/stablechain/network/gate")
      .then(({ verifyNetwork }) => verifyNetwork(chain, expectedNetwork))
      .then((network) => {
        this.verified = network;
        if (this.health === "wrong-network" || this.health === "connecting") this.health = "live";
        this.problem = null;
        return network;
      })
      .catch((error: unknown) => {
        this.verified = null;
        if (
          error instanceof ChainError &&
          (error.info.kind === "WrongNetwork" || error.info.kind === "InvalidResponse")
        )
          this.health = "wrong-network";
        else this.health = "unreachable";
        this.problem = describeChainError(error);
        return null;
      })
      .finally(() => {
        this.#verifying = null;
      });
    return this.#verifying;
  }

  /** A finalized block pushed over the socket. */
  #pushed(result: unknown): void {
    const block = result as { height?: unknown; id?: unknown } | null;
    if (!block || typeof block.height !== "number" || typeof block.id !== "string" || !this.status) return;
    const previous = this.status.finalizedHeight;
    if (block.height <= previous) return;
    this.ticks += Math.min(8, block.height - previous);
    this.status = { ...this.status, finalizedHeight: block.height, finalizedBlock: block.id };
    this.heightAt = Date.now();
    if (this.verified && this.health === "stalled") this.health = "live";
  }

  async #poll(): Promise<void> {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.#schedule(POLL_MS * 3);
      return;
    }
    const started = performance.now();
    try {
      const status = await chain.networkStatus();
      this.latencyMs = Math.round(performance.now() - started);
      const previous = this.status?.finalizedHeight ?? null;
      this.status = status;
      if (previous !== null && status.finalizedHeight > previous)
        this.ticks += Math.min(8, status.finalizedHeight - previous);
      if (previous === null || status.finalizedHeight !== previous) this.heightAt = Date.now();
      const recovering = this.health !== "live" && this.health !== "stalled";
      if (!this.verified || recovering) await this.verify();
      if (this.verified)
        this.health = this.heightAt !== null && Date.now() - this.heightAt > STALL_MS ? "stalled" : "live";
    } catch (error) {
      this.latencyMs = null;
      this.health = "unreachable";
      this.verified = null;
      this.problem = describeChainError(error);
    }
    this.#schedule(
      this.health === "unreachable" ? POLL_MS * 4 : streamStatus.state === "open" ? POLL_STREAMING_MS : POLL_MS,
    );
  }

  #schedule(ms: number) {
    if (this.#users === 0) return;
    this.#timer = setTimeout(() => void this.#poll(), ms);
  }
}

export const network = new NetworkState();
