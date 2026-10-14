import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, type SearchTarget } from "../src/lib/search/classify.ts";
import { renderIdentifier } from "../src/lib/encoding/identifiers.ts";

// Bytes with plenty of a-f digits, so the case checksum has letters to work with.
const address = renderIdentifier("address", "mainnet", Uint8Array.from({ length: 20 }, (_, i) => 0xa0 + i * 7));
const blockId = renderIdentifier("block", "mainnet", new Uint8Array(32).fill(0xb5));
const txId = renderIdentifier("transaction", "mainnet", new Uint8Array(32).fill(0xc6));

function refusalKey(result: SearchTarget): string {
  assert.equal(result.kind, "refused");
  return result.kind === "refused" ? result.key : "";
}

test("heights with and without locale grouping", () => {
  for (const text of ["1048576", "1,048,576", "1.048.576", "1 048 576", "1 048 576"]) {
    assert.deepEqual(classify(text, "mainnet"), { kind: "height", height: 1_048_576n }, text);
  }
});

test("epochs", () => {
  assert.deepEqual(classify("epoch 4096", "mainnet"), { kind: "epoch", epoch: 4096n });
  assert.equal(refusalKey(classify("epoch soon", "mainnet")), "search.epoch-invalid");
});

test("addresses, transaction ids and block ids by prefix", () => {
  assert.deepEqual(classify(address, "mainnet"), { kind: "address", canonical: address });
  assert.deepEqual(classify(txId, "mainnet"), { kind: "transaction", canonical: txId });
  assert.deepEqual(classify(blockId, "mainnet"), { kind: "block", canonical: blockId });
});

test("an identifier from another network is refused, naming that network", () => {
  const result = classify(renderIdentifier("address", "devnet", Uint8Array.from({ length: 20 }, (_, i) => 0xa0 + i * 7)), "mainnet");
  assert.equal(refusalKey(result), "search.addr_wrong_network");
  assert.match(result.kind === "refused" ? result.message : "", /different Aletheia network \(devnet\)/);
});

test("a mistyped address is refused, never corrected into another valid one", () => {
  // One digit changed: the case pattern no longer matches what Keccak gives the new value.
  const typo = address.slice(0, 20) + (address[20] === "7" ? "8" : "7") + address.slice(21);
  assert.equal(refusalKey(classify(typo, "mainnet")), "search.addr_malformed");
  // A letter's case flipped.
  const at = [...address].findIndex((c, i) => i > 3 && /[a-fA-F]/.test(c));
  const flipped = address.slice(0, at) + (address[at] === address[at]!.toLowerCase() ? address[at]!.toUpperCase() : address[at]!.toLowerCase()) + address.slice(at + 1);
  assert.equal(refusalKey(classify(flipped, "mainnet")), "search.addr_malformed");
});

test("0x input is refused with one sentence", () => {
  assert.equal(refusalKey(classify("0x" + "ab".repeat(32), "mainnet")), "search.prefixed-hex");
});

test("hashes are lowercase base16, 64 characters", () => {
  const hex = "9f".repeat(32);
  assert.deepEqual(classify(hex, "mainnet"), { kind: "hash", hex });
  assert.equal(refusalKey(classify(hex.toUpperCase(), "mainnet")), "search.uppercase-hex");
});

test("AANs are MOD-97 checked before any request (40B.3.1)", () => {
  // IBAN arithmetic: body, then A=10 L=21 X=33, then 00; check = 98 - (n mod 97).
  const body = "1234567890123456";
  const check = (98n - (BigInt(`${body}102133` + "00") % 97n)).toString().padStart(2, "0");
  const valid = `ALX${check}${body}`;
  assert.deepEqual(classify(valid, "mainnet"), { kind: "aan", electronic: valid });
  assert.deepEqual(classify(`ALX ${check} 1234 5678 9012 3456`, "mainnet"), { kind: "aan", electronic: valid });
  assert.equal(refusalKey(classify(`ALX${check}2134567890123456`, "mainnet")), "search.aan-check-digits");
  assert.equal(refusalKey(classify("ALX12345", "mainnet")), "search.aan-length");
});

test("UETRs are recognised and lowercased", () => {
  const uetr = "EB6305C9-1F7F-49DE-AED0-16487C27B42D";
  assert.deepEqual(classify(uetr, "mainnet"), { kind: "uetr", uetr: uetr.toLowerCase() });
});

test("unrecognised input explains what is searchable", () => {
  assert.equal(refusalKey(classify("hello", "mainnet")), "search.unrecognised");
});
