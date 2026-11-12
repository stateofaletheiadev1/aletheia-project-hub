// Multisig against a vector the node builds and validates itself (fixtures/multisig.json, from
// aletheia-node `sdk_multisig_vector`): the SDK must produce the same address and, Ed25519 being
// deterministic, byte-identical signed transactions.

import { readFileSync } from "node:fs";
import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import { fromHex, toHex } from "../src/encoding/hex.js";
import { parseNetworkKind } from "../src/network/kind.js";
import {
  MultisigError,
  assembleMultisig,
  canonicalKeys,
  encodeMultisigPreview,
  multisigAddress,
  signMultisigShare,
} from "../src/keys/multisig.js";

const v = JSON.parse(readFileSync(new URL("./fixtures/multisig.json", import.meta.url), "utf8")) as {
  network: { chainId: number; kind: string };
  seeds: number[];
  threshold: number;
  publicKeysSorted: string[];
  signerIndices: number[];
  address: string;
  body: string;
  signed: string;
};
const network = { chainId: v.network.chainId, kind: parseNetworkKind(v.network.kind)! };
const secrets = v.seeds.map((s) => new Uint8Array(32).fill(s));
const publicKeys = secrets.map((s) => ed25519.getPublicKey(s));
const body = fromHex(v.body);
const secretFor = (sortedIndex: number) =>
  secrets[publicKeys.findIndex((k) => toHex(k) === v.publicKeysSorted[sortedIndex])]!;

describe("multisig accounts, as the node builds them", () => {
  it("orders keys and derives the same address", () => {
    expect(canonicalKeys(publicKeys).map(toHex)).toEqual(v.publicKeysSorted);
    expect(multisigAddress(network, v.threshold, publicKeys)).toBe(v.address);
    // Key order given by the holders does not matter.
    expect(multisigAddress(network, v.threshold, [...publicKeys].reverse())).toBe(v.address);
  });

  it("assembles shares into the node's exact signed transaction", () => {
    const shares = v.signerIndices.map((i) => signMultisigShare(body, secretFor(i), network));
    const { signed } = assembleMultisig(body, network, v.threshold, publicKeys, shares.reverse());
    expect(toHex(signed)).toBe(v.signed);
  });

  it("uses only the threshold of shares, the lowest key indices first", () => {
    const all = [0, 1, 2].map((i) => signMultisigShare(body, secretFor(i), network));
    const { signed } = assembleMultisig(body, network, v.threshold, publicKeys, all);
    const expected = assembleMultisig(body, network, v.threshold, publicKeys, all.slice(0, 2)).signed;
    expect(toHex(signed)).toBe(toHex(expected));
  });

  it("refuses too few shares, a forged share and an outside key", () => {
    const one = [signMultisigShare(body, secretFor(0), network)];
    expect(() => assembleMultisig(body, network, v.threshold, publicKeys, one)).toThrow(/1 of 2/);
    const forged = { ...one[0]!, signature: one[0]!.signature.slice() };
    forged.signature[0] = forged.signature[0]! ^ 1;
    expect(() => assembleMultisig(body, network, v.threshold, publicKeys, [forged])).toThrow(/does not verify/);
    const stranger = signMultisigShare(body, new Uint8Array(32).fill(9), network);
    expect(() => assembleMultisig(body, network, v.threshold, publicKeys, [stranger, ...one])).toThrow(/not one of/);
  });

  it("refuses a body from another account or another threshold", () => {
    const shares = v.signerIndices.map((i) => signMultisigShare(body, secretFor(i), network));
    expect(() => assembleMultisig(body, network, 1, publicKeys, shares)).toThrow(/sender is not the multisig account/);
    expect(() => signMultisigShare(body, secrets[0]!, { ...network, chainId: 7770 })).toThrow(MultisigError);
  });

  it("refuses malformed key sets", () => {
    expect(() => canonicalKeys([])).toThrow();
    expect(() => canonicalKeys([publicKeys[0]!, publicKeys[0]!])).toThrow(/twice/);
    expect(() => multisigAddress(network, 4, publicKeys)).toThrow(/threshold/);
  });

  it("previews with every key and no signatures", () => {
    const preview = encodeMultisigPreview(body, v.threshold, publicKeys);
    const signed = fromHex(v.signed);
    // Same body and key list; the signature list is empty (u32 0) where the signed one has two.
    const common = body.length + 2 + 4 + 3 * (1 + 4 + 32);
    expect(toHex(preview.slice(0, common))).toBe(toHex(signed.slice(0, common)));
    expect(toHex(preview.slice(common))).toBe("00000000");
  });
});
