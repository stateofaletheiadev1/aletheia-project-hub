import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { accountSeed, childKey, derivePath, masterKey, pathText, wipe } from "$lib/wallet/derivation/slip10";
import {
  entropyOf,
  mnemonicOf,
  mnemonicProblem,
  newMnemonic,
  normalizeWords,
  seedOf,
} from "$lib/wallet/mnemonic/mnemonic";
import { isWord, suggest } from "$lib/wallet/mnemonic/wordlist";
import { KeystoreError, openSecret, parseKeystore, sealSecret } from "$lib/wallet/keystore/keystore";
import { ed25519Address } from "$lib/stablechain/addresses/derive";
import { fromHex, toHex } from "$lib/stablechain/encoding/hex";

const hex = toHex;

describe("SLIP-0010 Ed25519 (official vectors)", () => {
  it("matches test vector 1", () => {
    const seed = fromHex("000102030405060708090a0b0c0d0e0f");
    const master = masterKey(seed);
    expect(hex(master.chainCode)).toBe("90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb");
    expect(hex(master.key)).toBe("2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7");
    const child = childKey(master, 0);
    expect(hex(child.chainCode)).toBe("8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69");
    expect(hex(child.key)).toBe("68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3");
    expect(hex(ed25519.getPublicKey(child.key))).toBe(
      "8c8a13df77a28f3445213a0f432fde644acaa215fc72dcdf300d5efaa85d350c",
    );
    const deep = derivePath(seed, [0, 1, 2, 2, 1_000_000_000]);
    expect(hex(deep.key)).toBe("8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793");
    expect(hex(deep.chainCode)).toBe("68789923a0cac2cd5a29172a475fe9e0fb14cd6adb5ad98a3fa70333e7afa230");
  });

  it("matches test vector 2", () => {
    const seed = fromHex(
      "fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542",
    );
    const master = masterKey(seed);
    expect(hex(master.key)).toBe("171cb88b1b3c1db25add599712e36245d75bc65a1a5c9e18d76f9f2b1eab4012");
    expect(hex(master.chainCode)).toBe("ef70a74db9c3a5af931b5fe73ed8e1a53464133654fd55e7a66f8570b8e33c3b");
    const node = derivePath(seed, [0, 2147483647, 1, 2147483646, 2]);
    expect(hex(node.key)).toBe("551d333177df541ad876a60ea71f00447931c0a9da16f227c11ea080d7391b8d");
    expect(hex(ed25519.getPublicKey(node.key))).toBe(
      "47150c75db263559a70d5778bf36abbab30fb061ad69f69ece61a72b0cfa4fc0",
    );
  });

  it("wipes nodes and rejects bad input", () => {
    const node = masterKey(new Uint8Array(32).fill(7));
    wipe(node);
    expect(node.key.every((b) => b === 0) && node.chainCode.every((b) => b === 0)).toBe(true);
    expect(() => masterKey(new Uint8Array(15))).toThrow();
    expect(() => masterKey(new Uint8Array(65))).toThrow();
    expect(() => childKey(masterKey(new Uint8Array(16)), -1)).toThrow();
    expect(() => childKey(masterKey(new Uint8Array(16)), 0x8000_0000)).toThrow();
  });

  it("writes the path as the CLI does", () => {
    expect(pathText(0)).toBe("m/44'/7771'/0'/0'/0'");
    expect(pathText(3, 1)).toBe("m/44'/7771'/1'/0'/3'");
  });
});

describe("BIP-39", () => {
  it("matches the official 24-word vector (all-zero entropy, empty passphrase)", () => {
    const words = `${"abandon ".repeat(23)}art`;
    expect(hex(entropyOf(words))).toBe("0".repeat(64));
    // Trezor python-mnemonic vectors use passphrase TREZOR; with the empty passphrase this
    // value comes from @scure/bip39's own vectors.
    expect(hex(seedOf(words)).slice(0, 32)).toBe("408b285c123836004f4b8842c89324c1");
    expect(mnemonicOf(new Uint8Array(32))).toBe(words);
  });

  it("generates 24 valid words", () => {
    const words = newMnemonic().split(" ");
    expect(words).toHaveLength(24);
    expect(mnemonicProblem(words)).toBeNull();
  });

  it("explains what is wrong with a phrase", () => {
    expect(mnemonicProblem(["abandon"])).toEqual({ kind: "count", count: 1 });
    expect(mnemonicProblem([...Array(23).fill("abandon"), "zzzz"])).toEqual({ kind: "unknown-word", position: 24 });
    expect(mnemonicProblem(Array(24).fill("abandon"))).toEqual({ kind: "checksum" });
    expect(normalizeWords([" Abandon ", "ART"])).toBe("abandon art");
  });

  it("suggests wordlist entries", () => {
    expect(suggest("aban")).toEqual(["abandon"]);
    expect(suggest("")).toEqual([]);
    expect(suggest("a", 3)).toHaveLength(3);
    expect(isWord(" Zoo ")).toBe(true);
    expect(isWord("zzz")).toBe(false);
  });
});

describe("keystore", () => {
  const cliFile = JSON.parse(readFileSync("tests/vectors/cli-keystore-devnet.json", "utf8")) as unknown;
  const cliPassword = readFileSync("tests/vectors/cli-keystore.password", "utf8").replace(/\r?\n$/, "");

  it("opens a keystore written by aletheia-cli and derives its address (cross-implementation)", async () => {
    const keystore = parseKeystore(cliFile);
    const { secret, kind } = await openSecret(keystore, cliPassword);
    expect(kind).toBe("slip10-seed");
    const key = accountSeed(secret, 0);
    const publicKey = ed25519.getPublicKey(key);
    expect(hex(publicKey)).toBe("171aaaa11692a42a018c7ce27baed8a4d1a77925402d91239cb97b17517ac240");
    expect(ed25519Address({ chainId: 7771, kind: "devnet" }, publicKey)).toBe(
      (keystore as { address: string }).address,
    );
  }, 30_000);

  it("refuses a wrong password and a changed ciphertext", async () => {
    const keystore = parseKeystore(cliFile);
    await expect(openSecret(keystore, "wrong")).rejects.toMatchObject({ kind: "wrong-password" });
    const text = keystore.cipher.ciphertext;
    const tampered = parseKeystore({
      ...(cliFile as object),
      cipher: { ...keystore.cipher, ciphertext: (text[0] === "0" ? "1" : "0") + text.slice(1) },
    });
    await expect(openSecret(tampered, cliPassword)).rejects.toBeInstanceOf(KeystoreError);
  }, 30_000);

  it("seals and reopens a v2 secret with fresh salt and nonce", async () => {
    const secret = new Uint8Array(32).fill(9);
    const a = await sealSecret(secret, "pässwörd ✓");
    const b = await sealSecret(secret, "pässwörd ✓");
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.nonce).not.toBe(b.cipher.nonce);
    const file = parseKeystore({
      version: 2,
      secret: "bip39-entropy",
      network: "devnet",
      chainId: 7771,
      createdAt: "2026-11-03T00:00:00Z",
      accounts: [],
      ...a,
    });
    const opened = await openSecret(file, "pässwörd ✓");
    expect(opened.kind).toBe("bip39-entropy");
    expect(opened.secret).toEqual(secret);
    await expect(sealSecret(new Uint8Array(16), "x")).rejects.toBeInstanceOf(KeystoreError);
  }, 30_000);

  it("rejects malformed files with a reason", () => {
    const good = cliFile as Record<string, unknown>;
    const cases: unknown[] = [
      null,
      [],
      { ...good, kdf: undefined },
      { ...good, kdf: { ...(good.kdf as object), name: "scrypt" } },
      { ...good, kdf: { ...(good.kdf as object), passes: 0 } },
      { ...good, kdf: { ...(good.kdf as object), salt: "0x12" } },
      { ...good, cipher: { ...(good.cipher as object), nonce: "abcd" } },
      { ...good, address: undefined },
      { ...good, version: 3 },
      { ...good, version: 2, secret: "other" },
      { ...good, version: 2, secret: "bip39-entropy" },
      { ...good, version: 2, secret: "bip39-entropy", network: "devnet", chainId: 1 },
      { ...good, version: 2, secret: "bip39-entropy", network: "devnet", chainId: 1, accounts: [{ index: 0 }] },
    ];
    for (const value of cases) expect(() => parseKeystore(value)).toThrow(KeystoreError);
  });
});
