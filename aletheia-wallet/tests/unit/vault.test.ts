// The worker's vault, exercised directly: every operation the worker exposes, its refusals, and
// that locking wipes what it held.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import * as vault from "$lib/wallet/worker/vault";
import { encodeBody, decodeSigned, signingDigest } from "$lib/stablechain/transactions/body";
import { addressBytes, parseAddress } from "$lib/stablechain/addresses/identifiers";
import { fromHex } from "$lib/stablechain/encoding/hex";
import { signTransferWithKey, SigningError } from "$lib/wallet/signing/sign";
import { watchIdle } from "$lib/security/idle";
import { log } from "$lib/security/redact";
import { ChainClient } from "$lib/stablechain/rpc/client";

const devnet = { chainId: 7771, kind: "devnet" } as const;
const PASSWORD = "a strong test password";
const WORDS = `${"abandon ".repeat(23)}art`.split(" ");

function body(sender: string, nonce = 0n) {
  return {
    version: 1,
    chainId: 7771,
    networkKind: "devnet" as const,
    sender: addressBytes(parseAddress(sender, "devnet"), "devnet"),
    nonce,
    feeAsset: 2,
    maxFee: 100n,
    euLimit: 100n,
    validFromSlot: 1n,
    expirySlot: 1001n,
    memo: new Uint8Array(),
    recipient: new Uint8Array(20).fill(0xab),
    asset: 1,
    amount: 5n,
  };
}

describe("vault", () => {
  it("generates, seals, signs, adds accounts, re-seals and locks", async () => {
    const session = vault.newSession();
    const { words } = vault.generate(session);
    expect(words).toHaveLength(24);
    expect(session.pending).not.toBeNull();
    const created = await vault.createFromPending(session, PASSWORD, devnet, "Main");
    expect(session.pending).toBeNull();
    expect(created.keystore.version).toBe(2);
    expect(created.accounts[0]).toMatchObject({ index: 0, name: "Main", path: "m/44'/7771'/0'/0'/0'" });
    expect(JSON.stringify(created.keystore)).not.toContain(words.join(" "));

    const signed = vault.sign(
      session,
      Buffer.from(encodeBody(body(created.accounts[0]!.address))).toString("hex"),
      0,
      devnet,
    );
    const decoded = decodeSigned(fromHex(signed.signedHex));
    expect(ed25519.verify(decoded.signature, signingDigest(decoded.bodyBytes, devnet), decoded.publicKey)).toBe(true);

    const second = vault.addAccount(session, "Savings");
    expect(second.account.index).toBe(1);
    expect(second.keystore && second.keystore.version === 2 && second.keystore.accounts).toHaveLength(2);

    expect((await vault.revealWords(created.keystore, PASSWORD)).words).toEqual(words);
    const { keystore: resealed } = await vault.changePassword(created.keystore, PASSWORD, "another long password");
    expect(resealed.kdf.salt).not.toBe(created.keystore.kdf.salt);
    await expect(vault.revealWords(resealed, PASSWORD)).rejects.toMatchObject({ kind: "wrong-password" });

    const seed = session.seed!;
    vault.wipeSession(session);
    expect(seed.every((b) => b === 0)).toBe(true);
    expect(() => vault.sign(session, "00", 0, devnet)).toThrow(vault.VaultError);
    expect(() => vault.addAccount(session, "x")).toThrow(/locked/);
  }, 60_000);

  it("imports a phrase to the same addresses every time and unlocks with the password", async () => {
    const a = await vault.importWords(vault.newSession(), WORDS, PASSWORD, devnet, "One");
    const b = await vault.importWords(
      vault.newSession(),
      WORDS.map((w) => w.toUpperCase()),
      PASSWORD,
      devnet,
      "One",
    );
    expect(a.accounts[0]!.address).toBe(b.accounts[0]!.address);
    const session = vault.newSession();
    const unlocked = await vault.unlock(session, a.keystore, PASSWORD, devnet);
    expect(unlocked).toMatchObject({ hasWords: true, accounts: a.accounts });
    await expect(vault.unlock(vault.newSession(), a.keystore, "wrong password", devnet)).rejects.toMatchObject({
      kind: "wrong-password",
    });
    await expect(
      vault.unlock(vault.newSession(), a.keystore, PASSWORD, { chainId: 7770, kind: "mainnet" }),
    ).rejects.toMatchObject({ kind: "wrong-network" });
    await expect(
      vault.importWords(vault.newSession(), Array(24).fill("abandon"), PASSWORD, devnet, "x"),
    ).rejects.toMatchObject({ kind: "invalid-words" });
    await expect(vault.importWords(vault.newSession(), ["abandon"], PASSWORD, devnet, "x")).rejects.toMatchObject({
      kind: "invalid-words",
    });
    // Metadata that does not match what the keystore holds is refused, not trusted.
    const tampered = {
      ...a.keystore,
      accounts: [{ ...a.accounts[0]!, address: b.accounts[0]!.address.replace(/.$/, "0") }],
    };
    await expect(vault.unlock(vault.newSession(), tampered, PASSWORD, devnet)).rejects.toMatchObject({
      kind: "corrupt",
    });
  }, 60_000);

  it("opens a CLI keystore with one account and no words", async () => {
    const file = JSON.parse(readFileSync("tests/vectors/cli-keystore-devnet.json", "utf8")) as Record<string, unknown>;
    const password = readFileSync("tests/vectors/cli-keystore.password", "utf8").replace(/\r?\n$/, "");
    const session = vault.newSession();
    const opened = await vault.importKeystore(session, file, password, devnet);
    expect(opened.accounts[0]!.address).toBe(file.address);
    expect(() => vault.addAccount(session, "x")).toThrow(/one account/);
    await expect(vault.revealWords(opened.keystore, password)).rejects.toMatchObject({ kind: "unsupported" });
    await expect(vault.changePassword(opened.keystore, password, "y")).rejects.toMatchObject({ kind: "unsupported" });
    await expect(
      vault.importKeystore(vault.newSession(), { ...file, network: undefined }, password, devnet),
    ).rejects.toMatchObject({ kind: "unsupported" });
    await expect(vault.importKeystore(vault.newSession(), { nope: 1 }, password, devnet)).rejects.toMatchObject({
      kind: "corrupt",
    });
    expect((await vault.unlock(vault.newSession(), opened.keystore, password, devnet)).hasWords).toBe(false);
  }, 60_000);

  it("refuses to sign for another account, network or sender", async () => {
    const session = vault.newSession();
    const created = await vault.importWords(session, WORDS, PASSWORD, devnet, "One");
    const hex = Buffer.from(encodeBody(body(created.accounts[0]!.address))).toString("hex");
    expect(() => vault.sign(session, hex, 5, devnet)).toThrow(/no such account/);
    expect(() => vault.sign(session, hex, 0, { chainId: 7770, kind: "mainnet" })).toThrow(/another network/);
    const other = Buffer.from(
      encodeBody({
        ...body(created.accounts[0]!.address),
        recipient: new Uint8Array(20),
        sender: new Uint8Array(20).fill(1),
      }),
    ).toString("hex");
    expect(() => vault.sign(session, other, 0, devnet)).toThrow(/sender/);
    expect(vault.discardPending(session)).toEqual({});
    await expect(vault.createFromPending(session, PASSWORD, devnet, "x")).rejects.toMatchObject({ kind: "refused" });
  }, 60_000);

  it("signs only bodies for the key's own network", () => {
    const key = new Uint8Array(32).fill(0xa1);
    const address = "alt:a7c308Be39bA1F33fa045Dde6A90b4E623360162";
    const bytes = encodeBody(body(address));
    expect(signTransferWithKey(bytes, key, devnet).txId.startsWith("alt:T")).toBe(true);
    expect(() => signTransferWithKey(bytes, key, { chainId: 7772, kind: "devnet" })).toThrow(SigningError);
  });
});

describe("idle lock", () => {
  function fakeWindow() {
    const listeners = new Map<string, () => void>();
    const doc = {
      visibilityState: "visible",
      addEventListener: (n: string, f: () => void) => listeners.set(`doc:${n}`, f),
      removeEventListener: (n: string) => listeners.delete(`doc:${n}`),
    };
    return {
      listeners,
      doc,
      target: {
        document: doc,
        addEventListener: (n: string, f: () => void) => listeners.set(n, f),
        removeEventListener: (n: string) => listeners.delete(n),
      } as unknown as Window & typeof globalThis,
    };
  }

  it("locks after inactivity, re-arms on input, and locks after a long hide", () => {
    vi.useFakeTimers();
    const onLock = vi.fn();
    const w = fakeWindow();
    const stop = watchIdle({ idleMs: 1000, hiddenMs: 500, onLock, target: w.target });
    vi.advanceTimersByTime(900);
    w.listeners.get("keydown")!();
    vi.advanceTimersByTime(900);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onLock).toHaveBeenCalledTimes(1);
    w.doc.visibilityState = "hidden";
    w.listeners.get("doc:visibilitychange")!();
    vi.setSystemTime(Date.now() + 600);
    w.doc.visibilityState = "visible";
    w.listeners.get("doc:visibilitychange")!();
    expect(onLock).toHaveBeenCalledTimes(2);
    stop();
    expect(w.listeners.size).toBe(0);
    vi.useRealTimers();
  });
});

describe("logging", () => {
  it("never prints a secret-shaped string", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    log.error("failed with", new Error(`seed ${"f".repeat(64)}`), { words: WORDS.join(" ") });
    log.info("plain");
    log.warn(Symbol("x"));
    const printed = [...spy.mock.calls, ...info.mock.calls, ...warn.mock.calls].flat().join(" ");
    expect(printed).not.toContain("f".repeat(64));
    expect(printed).not.toContain("abandon abandon");
    spy.mockRestore();
    info.mockRestore();
    warn.mockRestore();
  });
});

describe("client wrappers", () => {
  it("calls each node method by its registered name", async () => {
    const seen: string[] = [];
    const fetcher = (async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { id: number; method: string };
      seen.push(request.method);
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32002, message: "Not found" } }),
      );
    }) as typeof fetch;
    const client = new ChainClient({ rpcUrl: "x", restUrl: "y/", fetch: fetcher });
    const calls = [
      client.chainParams(),
      client.finalizedHead(),
      client.balance("a", "AEY"),
      client.supply("ALnT"),
      client.simulate(new Uint8Array([1])),
      client.submit(new Uint8Array([1])),
      client.receipt("t"),
    ];
    for (const call of calls) await expect(call).rejects.toMatchObject({ info: { kind: "NotFound" } });
    expect(seen).toEqual([
      "getChainParams",
      "getFinalizedHead",
      "getBalance",
      "getMonetarySupply",
      "simulateTransaction",
      "submitTransaction",
      "getReceipt",
    ]);
  });
});
