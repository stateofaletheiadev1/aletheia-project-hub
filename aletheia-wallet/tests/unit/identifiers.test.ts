import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  addressProblem,
  BLOCK_ID_FORM,
  checksumCase,
  IdentifierError,
  parseAddress,
  parseBlockId,
  parseId,
  parseTxId,
  renderAddress,
  renderId,
  renderTxId,
  ADDRESS_FORM,
} from "$lib/stablechain/addresses/identifiers";
import { ed25519Address, ed25519Commitment } from "$lib/stablechain/addresses/derive";
import { fromHex } from "$lib/stablechain/encoding/hex";

// The test vectors published in EIP-55 itself (also in crates/core/src/text_id.rs).
const EIP55 = [
  "52908400098527886E0F7030069857D2E4169EE7",
  "8617E340B3D01FA5F11F306F4090FD50E238070D",
  "de709f2102306220921060314715629080e2fb77",
  "27b1fdb04752bbc536007a920d24acb045561c26",
  "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  "fB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
  "dbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
  "D1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
];

function sample(): Uint8Array {
  return Uint8Array.from({ length: 20 }, (_, i) => (i * 37 + 171) & 0xff);
}

describe("EIP-55 casing", () => {
  it("reproduces every published EIP-55 vector with an empty tag", () => {
    for (const vector of EIP55) expect(checksumCase("", vector.toLowerCase())).toBe(vector);
  });

  it("changes with the network tag", () => {
    const lower = EIP55[4]!.toLowerCase();
    expect(checksumCase("al:", lower)).not.toBe(checksumCase("ald:", lower));
  });
});

describe("addresses from keys (cross-implementation)", () => {
  it("derives the devnet genesis account of the published seed [0xA1; 32]", () => {
    // genesis/devnet-explorer.toml, written by apps/devnet-traffic from the Rust implementation.
    const publicKey = ed25519.getPublicKey(new Uint8Array(32).fill(0xa1));
    expect(ed25519Address({ chainId: 7771, kind: "devnet" }, publicKey)).toBe(
      "alt:a7c308Be39bA1F33fa045Dde6A90b4E623360162",
    );
  });

  it("derives the CLI keystore address from its public key", () => {
    const publicKey = fromHex("171aaaa11692a42a018c7ce27baed8a4d1a77925402d91239cb97b17517ac240");
    expect(ed25519Address({ chainId: 7771, kind: "devnet" }, publicKey)).toBe(
      "alt:7a2cD06e2E6ADD95Dd6CeC2a1AC56e3c230D3814",
    );
  });

  it("gives one key different addresses on different networks", () => {
    const publicKey = ed25519.getPublicKey(new Uint8Array(32).fill(42));
    expect(ed25519Address({ chainId: 7771, kind: "devnet" }, publicKey)).not.toBe(
      ed25519Address({ chainId: 7771, kind: "mainnet" }, publicKey),
    );
    expect(ed25519Address({ chainId: 7770, kind: "mainnet" }, publicKey)).not.toBe(
      ed25519Address({ chainId: 7771, kind: "mainnet" }, publicKey),
    );
  });

  it("refuses a public key that is not 32 bytes", () => {
    expect(() => ed25519Commitment({ chainId: 1, kind: "devnet" }, new Uint8Array(31))).toThrow();
  });
});

describe("address parsing", () => {
  it("round-trips on every network", () => {
    for (const kind of ["mainnet", "private-validation", "devnet", "regtest"] as const) {
      const text = renderAddress(sample(), kind);
      expect(text).toHaveLength(44);
      expect(text.startsWith("alt:")).toBe(true);
      expect(parseAddress(text, kind)).toBe(text);
      expect(parseId(ADDRESS_FORM, text, kind)).toEqual(sample());
    }
  });

  it("parses live mainnet addresses", () => {
    expect(parseAddress("alt:56CB50d83DD2F56b4F57599110139C37cC38655a", "mainnet")).toBeTruthy();
    expect(parseAddress("alt:4E0dC17eD0b07f6b20245d00C1234Fd1E9D04574", "mainnet")).toBeTruthy();
  });

  it("names the network of an address from another network", () => {
    const devnet = renderAddress(sample(), "devnet");
    const problem = addressProblem(devnet, "mainnet");
    expect(problem?.problem).toBe("wrong-network");
    expect(problem?.foundNetwork).toBe("devnet");
  });

  it("refuses single-case spellings and an uppercase prefix as non-canonical", () => {
    const text = renderAddress(sample(), "devnet");
    for (const spelling of [
      `alt:${text.slice(4).toLowerCase()}`,
      `alt:${text.slice(4).toUpperCase()}`,
      `ALT:${text.slice(4)}`,
    ]) {
      expect(addressProblem(spelling, "devnet")?.problem).toBe("non-canonical");
    }
  });

  it("refuses wrong length, 0x, non-hex and a flipped letter as malformed", () => {
    const text = renderAddress(sample(), "devnet");
    const position = text.slice(4).search(/[a-fA-F]/) + 4;
    const flipped =
      text.slice(0, position) +
      (text[position] === text[position]!.toUpperCase()
        ? text[position]!.toLowerCase()
        : text[position]!.toUpperCase()) +
      text.slice(position + 1);
    for (const spelling of [
      text.slice(0, 43),
      `alt:0x${text.slice(4, 42)}`,
      `${text.slice(0, 43)}g`,
      `xyz:${text.slice(4)}`,
      flipped,
    ]) {
      expect(addressProblem(spelling, "devnet")?.problem, spelling).toBe("malformed");
    }
    expect(addressProblem(text, "devnet")).toBeNull();
  });

  it("throws IdentifierError from the strict parsers", () => {
    expect(() => parseAddress("alt:nope", "mainnet")).toThrow(IdentifierError);
  });

  it("refuses rendering a payload of the wrong size", () => {
    expect(() => renderId(ADDRESS_FORM, "mainnet", new Uint8Array(19))).toThrow(IdentifierError);
  });

  it("rethrows unexpected errors from addressProblem", () => {
    expect(() => addressProblem(null as unknown as string, "mainnet")).toThrow(TypeError);
  });
});

describe("transaction and block ids", () => {
  it("parses live mainnet block ids", () => {
    expect(
      parseBlockId("alt:B7d6ec0526856a85C12a0B95edC508D378b8dfF222e7caC6cE8C7D026278a4819", "mainnet"),
    ).toBeTruthy();
  });

  it("does not verify a transaction id relabelled as a block id", () => {
    const hash = Uint8Array.from({ length: 32 }, (_, i) => (i * 29 + 171) & 0xff);
    const txId = renderTxId(hash, "mainnet");
    expect(txId).toHaveLength(69);
    expect(parseTxId(txId, "mainnet")).toBe(txId);
    expect(() => parseId(BLOCK_ID_FORM, `alt:B${txId.slice(5)}`, "mainnet")).toThrow(IdentifierError);
  });
});
