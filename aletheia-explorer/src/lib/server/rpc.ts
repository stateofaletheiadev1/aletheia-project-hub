// The node's REST interface (Section 37.1, /api/v1). The Explorer reads finalized data only
// and never submits anything. ALETHEIA_RPC points at a full node, never at a validator.

import { env } from "$env/dynamic/private";
import type {
  AccountView,
  Balance,
  BlockSummary,
  NetworkStatus,
  ReceiptView,
  Supply,
  TransactionView,
} from "$lib/types";

const TIMEOUT_MS = 4_000;

export class RpcError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function base(): string {
  return (env.ALETHEIA_RPC ?? "http://127.0.0.1:7781").replace(/\/+$/, "");
}

async function get<T>(path: string): Promise<T> {
  // A rate-limited answer is retried after a short pause, not reported as an outage.
  for (let attempt = 0; ; attempt++) {
    try {
      return await once<T>(path);
    } catch (error) {
      if (!(error instanceof RpcError) || error.status !== 429 || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
}

async function once<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base()}/api/v1${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new RpcError(503, `the node is unreachable (${(error as Error).message})`);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Errors arrive as { error: { message, details: { detail } } }.
    const error = (body as { error?: { message?: string; details?: { detail?: string } } } | null)?.error;
    const message = error?.details?.detail ?? error?.message ?? response.statusText;
    throw new RpcError(response.status, message);
  }
  return body as T;
}

const segment = encodeURIComponent;

export const rpc = {
  status: () => get<NetworkStatus>("/network/status"),
  blockAt: (height: number) => get<BlockSummary>(`/blocks/height/${height}`),
  block: (id: string) => get<BlockSummary>(`/blocks/${segment(id)}`),
  finality: (id: string) => get<{ block: string; height: number; proof: string }>(`/blocks/${segment(id)}/finality`),
  transaction: (id: string) => get<TransactionView>(`/transactions/${segment(id)}`),
  receipt: (id: string) => get<ReceiptView>(`/receipts/${segment(id)}`),
  account: (address: string) => get<AccountView>(`/accounts/${segment(address)}`),
  balances: (address: string) => get<Balance[]>(`/accounts/${segment(address)}/balances`),
  supply: (asset: string) => get<Supply>(`/monetary/${segment(asset)}/supply`),
};
