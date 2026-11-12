import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { AceError, AceReader, AceWriter } from "../src/encoding/ace.js";
import { concatBytes, equalBytes, fromHex, HexError, toHex } from "../src/encoding/hex.js";
import {
  decodeBody,
  decodeSigned,
  encodeBody,
  encodeSigned,
  signingDigest,
  txIdOf,
  type TransferBody,
} from "../src/transactions/body.js";
import { domainHash, DOMAIN_TAGS } from "../src/network/domain.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { networkLabel, parseNetworkKind, isTestNetwork } from "../src/network/kind.js";
import { assetById, parseAssetCode } from "../src/assets/assets.js";

const network = { chainId: 7771, kind: "devnet" } as const;

// The body of `transfer_body()` in crates/core/src/tx.rs tests.
function transferBody(): TransferBody {
  return {
    version: 1,
    chainId: 7771,
    networkKind: "devnet",
    sender: new Uint8Array(20).fill(1),
    nonce: 42n,
    feeAsset: 1,
    maxFee: 2_100_000_000_000_000n,
    euLimit: 5_000n,
    validFromSlot: 100n,
    expirySlot: 200n,
    memo: new TextEncoder().encode("invoice 2026-118"),
    recipient: new Uint8Array(20).fill(2),
    asset: 1,
    amount: 125_000_000_000_000_000_000n,
  };
}

describe("hex", () => {
  it("round-trips and refuses 0x, odd length and non-hex", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
    expect(fromHex("ABcd")).toEqual(Uint8Array.of(0xab, 0xcd));
    expect(() => fromHex("0x00")).toThrow(HexError);
    expect(() => fromHex("abc")).toThrow(HexError);
    expect(() => fromHex("zz")).toThrow(HexError);
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 2))).toBe(true);
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 3))).toBe(false);
    expect(equalBytes(Uint8Array.of(1), Uint8Array.of(1, 3))).toBe(false);
    expect(concatBytes(Uint8Array.of(1), Uint8Array.of(2, 3))).toEqual(Uint8Array.of(1, 2, 3));
  });
});

describe("ACE", () => {
  it("writes fixed-width little-endian integers", () => {
    const bytes = new AceWriter().u8(1).u16(0x0203).u32(0x04050607).u64(0x08090a0b0c0d0e0fn).u128(1n).finish();
    expect(toHex(bytes)).toBe("01" + "0302" + "07060504" + "0f0e0d0c0b0a0908" + "01" + "00".repeat(15));
    const reader = new AceReader(bytes);
    expect([reader.u8(), reader.u16(), reader.u32(), reader.u64(), reader.u128()]).toEqual([
      1,
      0x0203,
      0x04050607,
      0x08090a0b0c0d0e0fn,
      1n,
    ]);
    reader.finish();
  });

  it("prefixes byte strings with a u32 length and enforces maxima", () => {
    const bytes = new AceWriter().bytes(Uint8Array.of(9, 9)).finish();
    expect(toHex(bytes)).toBe("020000000909");
    expect(() => new AceReader(bytes).bytes(1)).toThrow(AceError);
    expect(new AceReader(bytes).bytes(2)).toEqual(Uint8Array.of(9, 9));
  });

  it("refuses out-of-range values, short input and trailing bytes", () => {
    expect(() => new AceWriter().u8(256)).toThrow(AceError);
    expect(() => new AceWriter().u16(-1)).toThrow(AceError);
    expect(() => new AceWriter().u32(2 ** 32)).toThrow(AceError);
    expect(() => new AceWriter().u64(1n << 64n)).toThrow(AceError);
    expect(() => new AceWriter().u128(-1n)).toThrow(AceError);
    expect(() => new AceReader(Uint8Array.of(1)).u16()).toThrow(AceError);
    const reader = new AceReader(Uint8Array.of(1, 2));
    reader.u8();
    expect(() => reader.finish()).toThrow(AceError);
    expect(new AceReader(Uint8Array.of(0xff, 0xff, 0xff, 0xff)).u32()).toBe(0xffff_ffff);
  });
});

describe("domain hash", () => {
  it("matches the normative formula", () => {
    const tag = "ALETHEIA/TXID/v1";
    const preimage = concatBytes(
      Uint8Array.of(tag.length),
      new TextEncoder().encode(tag),
      Uint8Array.of(0x5b, 0x1e, 0, 0),
      Uint8Array.of(3),
      new TextEncoder().encode("body"),
    );
    expect(domainHash(DOMAIN_TAGS.txId, network, new TextEncoder().encode("body"))).toEqual(blake3(preimage));
  });
});

describe("transfer body", () => {
  it("lays out the bytes as crates/core/src/tx.rs does", () => {
    const bytes = encodeBody(transferBody());
    // version 1 | chain 7771 | devnet 3 | type 1 | sender | nonce 42 | fee asset 1 | ...
    expect(toHex(bytes.slice(0, 9))).toBe("0100" + "5b1e0000" + "03" + "0100");
    expect(toHex(bytes.slice(9, 29))).toBe("01".repeat(20));
    expect(toHex(bytes.slice(29, 37))).toBe("2a00000000000000");
    expect(bytes.length).toBe(2 + 4 + 1 + 2 + 20 + 8 + 4 + 16 + 8 + 8 + 8 + 4 + 16 + 20 + 4 + 16);
  });

  it("round-trips through the decoder", () => {
    const body = transferBody();
    expect(decodeBody(encodeBody(body))).toEqual(body);
  });

  it("refuses non-transfer types, unknown networks, long memos and trailing bytes", () => {
    const bytes = encodeBody(transferBody());
    const other = bytes.slice();
    other[7] = 2;
    expect(() => decodeBody(other)).toThrow(AceError);
    const unknownNetwork = bytes.slice();
    unknownNetwork[6] = 9;
    expect(() => decodeBody(unknownNetwork)).toThrow(AceError);
    expect(() => decodeBody(concatBytes(bytes, Uint8Array.of(0)))).toThrow(AceError);
    expect(() => encodeBody({ ...transferBody(), memo: new Uint8Array(257) })).toThrow(AceError);
    expect(() => encodeBody({ ...transferBody(), sender: new Uint8Array(19) })).toThrow(AceError);
  });

  it("binds digest and id to the network and keeps them apart", () => {
    const bytes = encodeBody(transferBody());
    const digest = signingDigest(bytes, network);
    expect(digest).toHaveLength(32);
    expect(signingDigest(bytes, { chainId: 7770, kind: "devnet" })).not.toEqual(digest);
    const id = txIdOf(bytes, network);
    expect(id.startsWith("alt:T")).toBe(true);
    expect(id.slice(5).toLowerCase()).not.toBe(toHex(digest));
  });

  it("encodes and decodes a signed single-key transaction", () => {
    const seed = new Uint8Array(32).fill(0xa1);
    const bytes = encodeBody(transferBody());
    const signature = ed25519.sign(signingDigest(bytes, network), seed);
    const signed = encodeSigned(bytes, ed25519.getPublicKey(seed), signature);
    const decoded = decodeSigned(signed);
    expect(decoded.bodyBytes).toEqual(bytes);
    expect(decoded.signature).toEqual(signature);
    expect(ed25519.verify(decoded.signature, signingDigest(decoded.bodyBytes, network), decoded.publicKey)).toBe(true);
    expect(() => encodeSigned(bytes, new Uint8Array(31), signature)).toThrow(AceError);
    expect(() => encodeSigned(bytes, new Uint8Array(32), new Uint8Array(63))).toThrow(AceError);
    const badScheme = signed.slice();
    badScheme[bytes.length] = 2;
    expect(() => decodeSigned(badScheme)).toThrow(AceError);
  });
});

describe("network kinds and assets", () => {
  it("names and parses", () => {
    expect(networkLabel("mainnet")).toBe("Mainnet Beta");
    expect(parseNetworkKind("devnet")).toBe("devnet");
    expect(parseNetworkKind("testnet")).toBeNull();
    expect(isTestNetwork("mainnet")).toBe(false);
    expect(isTestNetwork("regtest")).toBe(true);
    expect(assetById(2)?.code).toBe("ALnT");
    expect(assetById(9)).toBeNull();
    expect(parseAssetCode("ALNT")).toBeNull();
  });
});
