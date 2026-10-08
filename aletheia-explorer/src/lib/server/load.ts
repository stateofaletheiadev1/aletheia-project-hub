// Turns node answers into page data: a missing object becomes a 404 page, an unreachable
// node a 503 page, so every page fails with a sentence instead of a stack trace.

import { error } from "@sveltejs/kit";
import { RpcError } from "./rpc";

export async function fromNode<T>(work: () => Promise<T>, what: string): Promise<T> {
  try {
    return await work();
  } catch (failure) {
    if (failure instanceof RpcError) {
      if (failure.status === 404) error(404, { message: `No ${what} found`, hint: failure.message });
      if (failure.status === 400) error(400, { message: `That is not a valid ${what}`, hint: failure.message });
      error(503, { message: "The node is not answering", hint: failure.message });
    }
    throw failure;
  }
}

/** Runs `work` over `items` with at most `width` requests in flight; keeps the order. */
export async function inOrder<T, R>(items: readonly T[], width: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await work(items[index] as T);
      }
    }),
  );
  return out;
}
