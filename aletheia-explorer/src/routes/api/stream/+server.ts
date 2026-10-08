// The live stream: a snapshot on connect, then one message per finalized block. Server-sent
// events over the page's own origin, so the CSP allows nothing beyond 'self'.

import { follower } from "$lib/server/follower";
import type { StreamMessage } from "$lib/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: StreamMessage) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      send(follower.snapshot());
      const unsubscribe = follower.subscribe(send);
      // A comment line keeps proxies from closing a quiet connection.
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          stop();
        }
      }, 15_000);
      stop = () => {
        unsubscribe();
        clearInterval(keepalive);
      };
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
};
