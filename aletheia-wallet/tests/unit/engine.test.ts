import { describe, expect, it, vi } from "vitest";
import {
  isTerminal,
  stationOf,
  transition,
  TransitionError,
  type TransferState,
  type TransferEvent,
} from "$lib/stablechain/transactions/machine";
import { buildTransfer, finalTerms, priceFrom, pricingTerms, PricingError } from "$lib/stablechain/transactions/build";
import { backoff, trackTransaction } from "$lib/stablechain/transactions/track";
import { signingBlock, verifyNetwork, type VerifiedNetwork } from "$lib/stablechain/network/gate";
import { ChainClient, mapRpcError } from "$lib/stablechain/rpc/client";
import { ChainError, describeChainError, describeProtocolName } from "$lib/stablechain/rpc/errors";
import { renderBlockId } from "$lib/stablechain/addresses/identifiers";
import { array, literal, nullable, object, optional, parse, SchemaError, string, units } from "$lib/validation/schema";
import { redact } from "$lib/security/redact";
import { delayAfter, loadThrottle, recordFailure, saveThrottle, waitRemaining } from "$lib/security/throttle";
import { identifierParts, middleEllipsis, spokenIdentifier } from "$lib/formatting/identifier";

const reason = { title: "t", body: "b", technical: "x" };

describe("transfer state machine", () => {
  const happy: TransferEvent[] = [
    { type: "simulate" },
    { type: "simulated", at: 1 },
    { type: "approve" },
    { type: "signed", txId: "alt:Tid", digest: "d" },
    { type: "submitted", at: 2 },
    { type: "tracking" },
    { type: "delayed" },
    { type: "tracking" },
    { type: "finalized", height: 9, receipt: "SUCCESS", errorName: "" },
  ];

  it("walks the happy path through every station", () => {
    let state: TransferState = { status: "draft" };
    const stations: number[] = [];
    for (const event of happy) {
      state = transition(state, event);
      stations.push(stationOf(state));
    }
    expect(state).toEqual({ status: "finalized", txId: "alt:Tid", height: 9, receipt: "SUCCESS", errorName: "" });
    expect(stations).toEqual([0, 0, 0, 1, 2, 3, 3, 3, 4]);
    expect(isTerminal(state)).toBe(true);
  });

  it("never treats a delayed transfer as failed", () => {
    let state: TransferState = { status: "confirming", txId: "a", submittedAt: 0, delayed: false };
    state = transition(state, { type: "delayed" });
    expect(state).toMatchObject({ status: "confirming", delayed: true });
    expect(isTerminal(state)).toBe(false);
  });

  it("covers every branch: failures, edits, rejection and expiry", () => {
    expect(transition({ status: "simulating" }, { type: "simulationFailed", reason }).status).toBe("simulationFailed");
    expect(transition({ status: "simulating" }, { type: "edit" }).status).toBe("draft");
    expect(transition({ status: "simulationFailed", reason }, { type: "edit" }).status).toBe("draft");
    expect(transition({ status: "awaitingApproval", simulatedAt: 0 }, { type: "edit" }).status).toBe("draft");
    expect(transition({ status: "awaitingApproval", simulatedAt: 0 }, { type: "simulate" }).status).toBe("simulating");
    expect(transition({ status: "signing" }, { type: "edit" }).status).toBe("draft");
    expect(transition({ status: "signed", txId: "a", digest: "d" }, { type: "rejected", reason }).status).toBe(
      "rejected",
    );
    expect(transition({ status: "submitted", txId: "a", submittedAt: 0 }, { type: "expired" }).status).toBe("expired");
    expect(
      transition(
        { status: "submitted", txId: "a", submittedAt: 0 },
        { type: "finalized", height: 1, receipt: "SUCCESS", errorName: "" },
      ).status,
    ).toBe("finalized");
    expect(
      transition({ status: "confirming", txId: "a", submittedAt: 0, delayed: true }, { type: "expired" }).status,
    ).toBe("expired");
    expect(transition({ status: "signing" }, { type: "failed", reason }).status).toBe("failed");
    expect(stationOf({ status: "expired", txId: "a" })).toBe(2);
    expect(stationOf({ status: "failed", reason })).toBe(1);
  });

  it("refuses events a state does not accept", () => {
    const states: TransferState[] = [
      { status: "draft" },
      { status: "simulating" },
      { status: "simulationFailed", reason },
      { status: "awaitingApproval", simulatedAt: 0 },
      { status: "signing" },
      { status: "signed", txId: "a", digest: "d" },
      { status: "submitted", txId: "a", submittedAt: 0 },
      { status: "confirming", txId: "a", submittedAt: 0, delayed: false },
      { status: "finalized", txId: "a", height: 1, receipt: "SUCCESS", errorName: "" },
      { status: "rejected", reason },
      { status: "expired", txId: "a" },
      { status: "failed", reason },
    ];
    for (const state of states)
      expect(() => transition(state, { type: "submitted", at: 1 }), state.status).toSatisfy(() => true);
    expect(() => transition({ status: "draft" }, { type: "approve" })).toThrow(TransitionError);
    expect(() =>
      transition(
        { status: "finalized", txId: "a", height: 1, receipt: "SUCCESS", errorName: "" },
        { type: "failed", reason },
      ),
    ).toThrow(TransitionError);
    for (const state of states.filter((s) => s.status !== "signed")) {
      expect(() => transition(state, { type: "submitted", at: 1 })).toThrow(TransitionError);
    }
    expect(() => transition({ status: "signed", txId: "a", digest: "d" }, { type: "approve" })).toThrow(
      TransitionError,
    );
    expect(() => transition({ status: "submitted", txId: "a", submittedAt: 0 }, { type: "approve" })).toThrow(
      TransitionError,
    );
    expect(() =>
      transition({ status: "confirming", txId: "a", submittedAt: 0, delayed: false }, { type: "approve" }),
    ).toThrow(TransitionError);
    expect(() => transition({ status: "signing" }, { type: "approve" })).toThrow(TransitionError);
    expect(() => transition({ status: "awaitingApproval", simulatedAt: 0 }, { type: "tracking" })).toThrow(
      TransitionError,
    );
    expect(() => transition({ status: "simulationFailed", reason }, { type: "simulate" })).toThrow(TransitionError);
    expect(() => transition({ status: "simulating" }, { type: "approve" })).toThrow(TransitionError);
  });
});

describe("fee terms", () => {
  it("derives the exact price and tight final terms", () => {
    expect(priceFrom(2000n, 2000n)).toBe(1n);
    expect(priceFrom(2000n, 2_000_000_000_000n)).toBe(1_000_000_000n);
    expect(priceFrom(0n, 0n)).toBe(0n);
    expect(() => priceFrom(0n, 5n)).toThrow(PricingError);
    expect(() => priceFrom(3n, 7n)).toThrow(PricingError);
    expect(finalTerms(2000n, 1n)).toEqual({ euLimit: 2500n, maxFee: 2500n });
    expect(finalTerms(3n, 10n)).toEqual({ euLimit: 4n, maxFee: 40n });
    expect(finalTerms(0n, 1n)).toEqual({ euLimit: 1n, maxFee: 1n });
    expect(pricingTerms(936750n)).toEqual({ maxFee: 936750n, euLimit: 10_000n });
  });

  it("refuses a zero-amount transfer", () => {
    const network = { chainId: 1, kind: "devnet" } as unknown as VerifiedNetwork;
    const draft = {
      sender: new Uint8Array(20),
      recipient: new Uint8Array(20),
      asset: 1,
      amount: 0n,
      memo: new Uint8Array(),
      feeAsset: 2,
    };
    expect(() => buildTransfer(draft, network, { nonce: 0n, slot: 5n }, pricingTerms(1n))).toThrow();
    const body = buildTransfer({ ...draft, amount: 1n }, network, { nonce: 3n, slot: 5n }, pricingTerms(1n));
    expect(body.expirySlot).toBe(1005n);
    expect(body.nonce).toBe(3n);
  });
});

function fakeNode(handlers: Record<string, (params: Record<string, unknown>) => unknown>) {
  const calls: string[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const text = String(url);
    if (text.includes("/api/v1/")) {
      const route = text.split("/api/v1")[1]!;
      calls.push(`GET ${route}`);
      const body = handlers[`GET ${route}`]?.({});
      return new Response(JSON.stringify(body ?? { error: { code: -32002, name: "NOT_FOUND", message: "no route" } }), {
        status: body ? 200 : 404,
      });
    }
    const request = JSON.parse(String(init?.body)) as { id: number; method: string; params: Record<string, unknown> };
    calls.push(request.method);
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("text/plain;charset=UTF-8");
    const handler = handlers[request.method];
    if (!handler)
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } }),
      );
    try {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: handler(request.params) }));
    } catch (error) {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, error }));
    }
  });
  return {
    client: new ChainClient({
      rpcUrl: "https://node/rpc/v1",
      restUrl: "https://node/api/v1",
      fetch: fetcher as typeof fetch,
    }),
    calls,
  };
}

const genesis = renderBlockId(new Uint8Array(32).fill(0xab), "mainnet");
const status = {
  chainId: 7770,
  network: "mainnet",
  protocolVersion: 1,
  syncing: false,
  finalizedHeight: 100,
  finalizedBlock: genesis,
  peers: null,
};
const block0 = {
  id: genesis,
  height: 0,
  slot: 0,
  epoch: 0,
  protocolTimeMs: 0,
  protocolVersion: 1,
  parent: genesis,
  txCount: 0,
  euUsed: 0,
  transactions: [],
};
const assets = [
  { id: 1, name: "AEY", decimals: 18, transferable: true },
  { id: 2, name: "ALnT", decimals: 3, transferable: true },
];
const expected = { chainId: 7770, kind: "mainnet" as const, genesisBlock: genesis, protocolVersions: [1] };

describe("network gate", () => {
  it("verifies chain, kind, protocol, genesis and asset decimals", async () => {
    const { client } = fakeNode({
      getNetworkStatus: () => status,
      getBlockByHeight: () => block0,
      getAssets: () => assets,
    });
    const verified = await verifyNetwork(client, expected, 1000);
    expect(verified).toMatchObject({ chainId: 7770, kind: "mainnet", genesisBlock: genesis, verifiedAt: 1000 });
    expect(signingBlock(verified, false, 1000)).toEqual({ reason: "mainnet-disabled" });
    expect(signingBlock(verified, true, 1000)).toBeNull();
    expect(signingBlock(verified, true, 40_000)).toMatchObject({ reason: "stale" });
    expect(signingBlock({ ...verified, syncing: true }, true, 1000)).toEqual({ reason: "syncing" });
  });

  it("refuses every kind of mismatch", async () => {
    const cases: [Record<string, unknown>, unknown, unknown, string][] = [
      [{ ...status, chainId: 7771 }, block0, assets, "WrongNetwork"],
      [{ ...status, network: "devnet" }, block0, assets, "WrongNetwork"],
      [{ ...status, protocolVersion: 2 }, block0, assets, "WrongNetwork"],
      [status, { ...block0, id: renderBlockId(new Uint8Array(32).fill(0xcd), "mainnet") }, assets, "WrongNetwork"],
      [status, { ...block0, id: "alt:Bnope" }, assets, "InvalidResponse"],
      [status, { ...block0, height: 1 }, assets, "InvalidResponse"],
      [status, block0, [assets[0]], "InvalidResponse"],
      [status, block0, [assets[0], { ...assets[1], decimals: 18 }], "InvalidResponse"],
    ];
    for (const [s, b, a, kind] of cases) {
      const { client } = fakeNode({ getNetworkStatus: () => s, getBlockByHeight: () => b, getAssets: () => a });
      await expect(verifyNetwork(client, expected)).rejects.toMatchObject({ info: { kind } });
    }
    const { client } = fakeNode({
      getNetworkStatus: () => status,
      getBlockByHeight: () => block0,
      getAssets: () => assets,
    });
    await expect(verifyNetwork(client, { ...expected, genesisBlock: null })).rejects.toMatchObject({
      info: { kind: "WrongNetwork" },
    });
  });
});

describe("chain client", () => {
  it("maps the node's error codes into the taxonomy", () => {
    expect(mapRpcError({ code: -32001 }).info.kind).toBe("RateLimited");
    expect(mapRpcError({ code: -32002, data: { detail: "none" } }).info).toEqual({ kind: "NotFound", detail: "none" });
    expect(mapRpcError({ code: -32010, data: { code: 2004, name: "TX_NONCE_TOO_LOW", detail: "used" } }).info).toEqual({
      kind: "Rejected",
      code: 2004,
      name: "TX_NONCE_TOO_LOW",
      detail: "used",
    });
    expect(
      mapRpcError({
        code: -32011,
        message: "Simulation failed",
        data: { code: 7, name: "INSUFFICIENT_BALANCE", detail: "low" },
      }).info,
    ).toMatchObject({ kind: "NodeError", code: -32011, name: "INSUFFICIENT_BALANCE" });
    expect(mapRpcError({ message: "odd" }).info).toMatchObject({ kind: "NodeError", code: 0, detail: "odd" });
  });

  it("validates results, refuses mismatched ids and reports unreachable nodes", async () => {
    const { client } = fakeNode({
      getNetworkStatus: () => ({ ...status, chainId: "7770" }),
      getAccount: () => ({ address: "a", exists: false, nonce: 0 }),
    });
    await expect(client.networkStatus()).rejects.toMatchObject({ info: { kind: "InvalidResponse" } });
    expect(await client.account("a")).toMatchObject({ nonce: 0 });
    await expect(client.assets()).rejects.toMatchObject({ info: { kind: "NodeError", code: -32601 } });
    const down = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => Promise.reject(new TypeError("offline"))) as typeof fetch,
    });
    await expect(down.networkStatus()).rejects.toMatchObject({ info: { kind: "NetworkUnreachable" } });
    const limited = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => new Response("", { status: 429 })) as typeof fetch,
    });
    await expect(limited.networkStatus()).rejects.toMatchObject({ info: { kind: "RateLimited" } });
    const html = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => new Response("<html>", { status: 502 })) as typeof fetch,
    });
    await expect(html.networkStatus()).rejects.toMatchObject({ info: { kind: "NetworkUnreachable" } });
    const plain = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => new Response("nope", { status: 400 })) as typeof fetch,
    });
    await expect(plain.networkStatus()).rejects.toMatchObject({ info: { kind: "InvalidResponse" } });
    const wrongId = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => new Response(JSON.stringify({ id: 999, result: status }))) as typeof fetch,
    });
    await expect(wrongId.networkStatus()).rejects.toMatchObject({ info: { kind: "InvalidResponse" } });
    const notObject = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => new Response("5")) as typeof fetch,
    });
    await expect(notObject.networkStatus()).rejects.toMatchObject({ info: { kind: "InvalidResponse" } });
  });

  it("reads balances over REST and maps REST errors", async () => {
    const balance = {
      address: "a",
      asset: "AEY",
      available: "1",
      locked: "0",
      display: "0.000000000000000001",
      height: 5,
    };
    const { client } = fakeNode({ "GET /accounts/a/balances": () => [balance] });
    expect(await client.balances("a")).toEqual([balance]);
    await expect(client.balances("b")).rejects.toMatchObject({ info: { kind: "NotFound" } });
    const failing = new ChainClient({
      rpcUrl: "x",
      restUrl: "https://n/api/v1",
      fetch: (async () =>
        new Response(JSON.stringify({ error: { code: 1002, name: "ADDR_MALFORMED", message: "bad" } }), {
          status: 400,
        })) as typeof fetch,
    });
    await expect(failing.balances("z")).rejects.toMatchObject({
      info: { kind: "NodeError", code: 1002, name: "ADDR_MALFORMED" },
    });
  });

  it("describes every error kind in plain words", () => {
    const kinds = [
      new ChainError({ kind: "NetworkUnreachable" }),
      new ChainError({ kind: "RateLimited" }),
      new ChainError({ kind: "NotFound", detail: "x" }),
      new ChainError({ kind: "WrongNetwork", detail: "x" }),
      new ChainError({ kind: "InvalidResponse", detail: "x" }),
      new ChainError({ kind: "Rejected", code: 1, name: "TX_EXPIRED", detail: "x" }),
      new ChainError({ kind: "Rejected", code: 1, name: "OTHER", detail: "x" }),
      new ChainError({ kind: "NodeError", code: 1, name: "INSUFFICIENT_BALANCE", detail: "x" }),
      new ChainError({ kind: "NodeError", code: 1, name: "", detail: "x" }),
    ];
    for (const error of kinds) expect(describeChainError(error).body.length).toBeGreaterThan(10);
    expect(describeChainError(new Error("boom")).title).toBe("Something went wrong");
    expect(describeProtocolName("TX_NONCE_TOO_LOW")).toMatch(/already used/);
    expect(describeProtocolName("NOPE")).toBeNull();
  });
});

describe("tracking to finality", () => {
  const finalTx = {
    txId: "alt:Tx",
    status: "FINALIZED",
    block: { height: 9, id: genesis, slot: 9, index: 0 },
    sender: "s",
    nonce: 0,
    type: "Transfer",
    txType: 1,
    fee: { asset: "ALnT", maxFee: "1", euLimit: 1 },
    validFromSlot: 1,
    expirySlot: 50,
  };
  const head = (slot: number) => ({ ...block0, slot });
  const sleep = async () => undefined;

  it("reports finality when the node finally has it", async () => {
    let lookups = 0;
    const { client } = fakeNode({
      getTransaction: () => {
        if (++lookups < 3) throw { code: -32002, message: "Not found", data: { detail: "no" } };
        return finalTx;
      },
      getFinalizedHead: () => head(10),
    });
    const updates: string[] = [];
    let clock = 0;
    const outcome = await trackTransaction(client, "alt:Tx", {
      expirySlot: 50,
      submittedAt: 0,
      sleep,
      now: () => (clock += 10_000),
      onUpdate: (u) => updates.push(u.kind === "pending" ? `pending:${u.delayed}` : u.kind),
    });
    expect(outcome.kind).toBe("finalized");
    expect(updates).toEqual(["pending:false", "pending:true", "finalized"]);
  });

  it("reports expiry only after the window closed and a last lookup", async () => {
    const { client, calls } = fakeNode({
      getTransaction: () => {
        throw { code: -32002, message: "Not found" };
      },
      getFinalizedHead: () => head(51),
    });
    expect((await trackTransaction(client, "alt:Tx", { expirySlot: 50, submittedAt: 0, sleep })).kind).toBe("expired");
    expect(calls.filter((c) => c === "getTransaction")).toHaveLength(2);
  });

  it("keeps waiting through an unreachable node and stops on abort", async () => {
    const controller = new AbortController();
    const down = new ChainClient({
      rpcUrl: "x",
      restUrl: "y",
      fetch: (async () => Promise.reject(new TypeError("offline"))) as typeof fetch,
    });
    let ticks = 0;
    const tracking = trackTransaction(down, "alt:Tx", {
      expirySlot: 50,
      submittedAt: 0,
      signal: controller.signal,
      sleep: async () => {
        if (++ticks === 3) controller.abort(new Error("stop"));
      },
    });
    await expect(tracking).rejects.toThrow("stop");
    expect(backoff(0)).toBe(600);
    expect(backoff(20)).toBe(4000);
  });

  it("rethrows unexpected node errors", async () => {
    const { client } = fakeNode({
      getTransaction: () => {
        throw { code: -32602, message: "Invalid params" };
      },
    });
    await expect(trackTransaction(client, "alt:Tx", { expirySlot: 50, submittedAt: 0, sleep })).rejects.toBeInstanceOf(
      ChainError,
    );
  });
});

describe("schema", () => {
  it("validates shapes and names the failing path", () => {
    const shape = object({ a: string, b: optional(units), c: nullable(literal("X")), d: array(string) });
    expect(parse(shape, { a: "s", c: null, d: [] })).toEqual({ a: "s", b: undefined, c: null, d: [] });
    expect(() => parse(shape, { a: 1, d: [] })).toThrow(/a: expected string, got number/);
    expect(() => parse(shape, { a: "s", b: "1.5", c: null, d: [] })).toThrow(SchemaError);
    expect(() => parse(shape, { a: "s", c: "Y", d: [] })).toThrow(/c: expected X/);
    expect(() => parse(shape, { a: "s", c: null, d: [1] })).toThrow(/d\[0\]/);
    expect(() => parse(shape, [])).toThrow(/expected object, got array/);
    expect(() => parse(shape, null)).toThrow(/got null/);
    expect(() => parse(array(string), {})).toThrow(/expected array/);
  });
});

describe("security utilities", () => {
  it("redacts phrases and raw keys but keeps identifiers", () => {
    const phrase = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    expect(redact(`X1: ${phrase} :Z9`)).toBe("X1: [redacted words] :Z9");
    const key = "a".repeat(64);
    expect(redact(`key=${key}`)).toBe("key=[redacted hex]");
    const tx = "alt:T" + "ab".repeat(32);
    expect(redact(`sent ${tx}`)).toBe(`sent ${tx}`);
    expect(redact("the account is able to send")).toBe("the account is able to send");
  });

  it("backs off unlock attempts exponentially and persists only counts", () => {
    expect([0, 1, 2, 3, 4, 5].map(delayAfter)).toEqual([0, 0, 0, 5000, 10000, 20000]);
    expect(delayAfter(30)).toBe(15 * 60_000);
    let state = { failures: 0, lockedUntil: 0 };
    for (let i = 0; i < 4; i++) state = recordFailure(state, 1000);
    expect(state).toEqual({ failures: 4, lockedUntil: 11_000 });
    expect(waitRemaining(state, 6000)).toBe(5000);
    expect(waitRemaining(state, 20_000)).toBe(0);
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    saveThrottle(state, storage);
    expect(loadThrottle(storage)).toEqual(state);
    saveThrottle({ failures: 0, lockedUntil: 0 }, storage);
    expect(store.size).toBe(0);
    expect(loadThrottle({ getItem: () => "{bad" })).toEqual({ failures: 0, lockedUntil: 0 });
    expect(loadThrottle({ getItem: () => '{"failures":"x"}' })).toEqual({ failures: 0, lockedUntil: 0 });
    expect(loadThrottle(null)).toEqual({ failures: 0, lockedUntil: 0 });
    expect(() =>
      saveThrottle(state, {
        setItem: () => {
          throw new Error("full");
        },
        removeItem: () => undefined,
      }),
    ).not.toThrow();
  });
});

describe("identifier display", () => {
  it("groups for the eye and reads in chunks", () => {
    const address = "alt:4E0dC17eD0b07f6b20245d00C1234Fd1E9D04574";
    expect(identifierParts(address)).toEqual({
      prefix: "alt:",
      groups: ["4E0d", "C17e", "D0b0", "7f6b", "2024", "5d00", "C123", "4Fd1", "E9D0", "4574"],
    });
    expect(middleEllipsis(address)).toEqual({ head: "alt:4E0d C17e", tail: "E9D0 4574" });
    expect(middleEllipsis("alt:abcd")).toEqual({ head: "alt:abcd", tail: "" });
    expect(identifierParts("alt:Tab").prefix).toBe("alt:T");
    expect(identifierParts("plain").prefix).toBe("");
    expect(spokenIdentifier("alt:abcd1234")).toBe("alt  abcd, 1234");
  });
});
