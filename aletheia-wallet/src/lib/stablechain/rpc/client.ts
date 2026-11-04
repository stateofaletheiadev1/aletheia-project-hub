// Typed JSON-RPC 2.0 and REST client for the node (spec Section 37; `crates/rpc`). Only the
// methods in `METHODS` exist. Bodies are sent as text/plain, a CORS simple request, because the
// public endpoint answers preflights with 405 (ADR-0003). Every result is runtime-checked.

import { SchemaError, parse, type Validator } from "$lib/validation/schema";
import { toHex } from "../encoding/hex";
import { ChainError } from "./errors";
import {
  Account,
  AccountHistory,
  AssetInfo,
  Balance,
  BlockSummary,
  ChainParams,
  FinalizedTransaction,
  NetworkStatus,
  Receipt,
  Simulation,
  Submitted,
  Supply,
  type Method,
} from "./types";
import { array } from "$lib/validation/schema";
import type { AssetCode } from "../assets/assets";

export interface ClientOptions {
  readonly rpcUrl: string;
  readonly restUrl: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

interface RpcErrorBody {
  code?: unknown;
  message?: unknown;
  data?: { code?: unknown; name?: unknown; detail?: unknown };
}

function protocolOf(error: RpcErrorBody) {
  const data = error.data ?? {};
  return {
    code: typeof data.code === "number" ? data.code : typeof error.code === "number" ? error.code : 0,
    name: typeof data.name === "string" ? data.name : "",
    detail: typeof data.detail === "string" ? data.detail : typeof error.message === "string" ? error.message : "",
  };
}

/** JSON-RPC error → taxonomy (`crates/rpc/src/error.rs` codes). */
export function mapRpcError(error: RpcErrorBody): ChainError {
  const protocol = protocolOf(error);
  switch (error.code) {
    case -32001:
      return new ChainError({ kind: "RateLimited" });
    case -32002:
      return new ChainError({ kind: "NotFound", detail: protocol.detail });
    case -32010:
      return new ChainError({ kind: "Rejected", ...protocol });
    default:
      return new ChainError({
        kind: "NodeError",
        ...protocol,
        code: typeof error.code === "number" ? error.code : protocol.code,
      });
  }
}

export class ChainClient {
  readonly #rpcUrl: string;
  readonly #restUrl: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;
  #id = 0;

  constructor(options: ClientOptions) {
    this.#rpcUrl = options.rpcUrl;
    this.#restUrl = options.restUrl.replace(/\/$/, "");
    this.#timeoutMs = options.timeoutMs ?? 12_000;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async #send(url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
    let response: Response;
    try {
      response = await this.#fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.#timeoutMs),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
    } catch (error) {
      const what = error instanceof Error ? `${error.name}: ${error.message}` : "request failed";
      throw new ChainError({ kind: "NetworkUnreachable", detail: `${what} (${new URL(url, "http://local").host})` });
    }
    if (response.status === 429) throw new ChainError({ kind: "RateLimited" });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (response.status >= 500)
        throw new ChainError({ kind: "NetworkUnreachable", detail: `HTTP ${response.status} from the node's proxy` });
      throw new ChainError({ kind: "InvalidResponse", detail: `HTTP ${response.status} without JSON` });
    }
    return { status: response.status, body };
  }

  async call<T>(method: Method, params: Record<string, unknown>, validator: Validator<T>): Promise<T> {
    const id = ++this.#id;
    const { body } = await this.#send(this.#rpcUrl, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    if (typeof body !== "object" || body === null)
      throw new ChainError({ kind: "InvalidResponse", detail: "not a JSON-RPC object" });
    const envelope = body as { id?: unknown; result?: unknown; error?: RpcErrorBody };
    if (envelope.error) throw mapRpcError(envelope.error);
    if (envelope.id !== id)
      throw new ChainError({ kind: "InvalidResponse", detail: "response id does not match the request" });
    return this.#validate(validator, envelope.result);
  }

  async rest<T>(path: string, validator: Validator<T>): Promise<T> {
    const { status, body } = await this.#send(`${this.#restUrl}${path}`, { method: "GET" });
    if (status !== 200) {
      const error =
        (body as { error?: { code?: unknown; name?: unknown; message?: unknown; details?: unknown } }).error ?? {};
      if (status === 404)
        throw new ChainError({
          kind: "NotFound",
          detail: typeof error.message === "string" ? error.message : "not found",
        });
      throw new ChainError({
        kind: "NodeError",
        code: typeof error.code === "number" ? error.code : status,
        name: typeof error.name === "string" ? error.name : "",
        detail: typeof error.message === "string" ? error.message : `HTTP ${status}`,
      });
    }
    return this.#validate(validator, body);
  }

  #validate<T>(validator: Validator<T>, value: unknown): T {
    try {
      return parse(validator, value);
    } catch (error) {
      if (error instanceof SchemaError) throw new ChainError({ kind: "InvalidResponse", detail: error.message });
      throw error;
    }
  }

  networkStatus() {
    return this.call("getNetworkStatus", {}, NetworkStatus);
  }

  chainParams() {
    return this.call("getChainParams", {}, ChainParams);
  }

  finalizedHead() {
    return this.call("getFinalizedHead", {}, BlockSummary);
  }

  blockByHeight(height: number) {
    return this.call("getBlockByHeight", { height }, BlockSummary);
  }

  account(address: string) {
    return this.call("getAccount", { address }, Account);
  }

  balance(address: string, asset: AssetCode) {
    return this.call("getBalance", { address, asset }, Balance);
  }

  /** Both native balances in one request (REST `GET /accounts/{a}/balances`). */
  balances(address: string) {
    return this.rest(`/accounts/${encodeURIComponent(address)}/balances`, array(Balance));
  }

  assets() {
    return this.call("getAssets", {}, array(AssetInfo));
  }

  supply(asset: AssetCode) {
    return this.call("getMonetarySupply", { asset }, Supply);
  }

  /** A page of the account's finalized transactions, newest first (node ADR-064). */
  accountHistory(address: string, options: { limit?: number; before?: string | null } = {}) {
    const params: Record<string, unknown> = { address, limit: options.limit ?? 25 };
    if (options.before) params.before = options.before;
    return this.call("getAccountHistory", params, AccountHistory);
  }

  simulate(signed: Uint8Array) {
    return this.call("simulateTransaction", { tx: toHex(signed) }, Simulation);
  }

  submit(signed: Uint8Array) {
    return this.call("submitTransaction", { tx: toHex(signed) }, Submitted);
  }

  /** Only finalized transactions exist for the node; `NotFound` before. */
  transaction(txId: string) {
    return this.call("getTransaction", { txId }, FinalizedTransaction);
  }

  receipt(txId: string) {
    return this.call("getReceipt", { txId }, Receipt);
  }
}
