// The one WebSocket the app keeps to the node, when one is configured (node ADR-064). Its state
// is reactive so the network seal and banner can say whether updates are pushed or polled.

import { config } from "$lib/config";
import { ChainStream, type StreamState } from "$lib/stablechain/ws/stream";

class StreamStatus {
  state = $state<StreamState>("idle");
}

export const streamStatus = new StreamStatus();

export const stream: ChainStream | null =
  typeof window !== "undefined" && config.wsUrl
    ? new ChainStream(config.wsUrl, { onState: (state) => (streamStatus.state = state) })
    : null;
