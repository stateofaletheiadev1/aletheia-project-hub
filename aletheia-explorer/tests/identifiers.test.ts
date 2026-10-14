// The browser parser must agree with the Rust node on every published APS-0002 vector.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NETWORKS, checksumCase, parseIdentifier, renderIdentifier, type NetworkKind } from "../src/lib/encoding/identifiers.ts";
import { keccak256 } from "../src/lib/encoding/keccak.ts";

const vectors = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../aletheia-node/tests/vectors/APS-0002/${name}`, import.meta.url), "utf8"));

const NETWORK_BY_CODE: Record<number, NetworkKind> = { 1: "mainnet", 2: "private-validation", 3: "devnet", 4: "regtest" };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const fromHex = (text: string) => Uint8Array.from(Buffer.from(text, "hex"));

test("renders and parses every valid address vector exactly as the node does", () => {
  for (const vector of vectors("addresses.json").valid) {
    const network = NETWORK_BY_CODE[vector.network_kind]!;
    assert.equal(renderIdentifier("address", network, fromHex(vector.payload)), vector.text);
    const parsed = parseIdentifier("address", vector.text, network);
    assert.ok(parsed.ok, vector.text);
    assert.equal(hex(parsed.payload), vector.payload);
  }
});

test("rejects every invalid address vector with the node's error name", () => {
  for (const vector of vectors("addresses.json").invalid) {
    const parsed = parseIdentifier("address", vector.text, NETWORK_BY_CODE[vector.network_kind]!);
    assert.ok(!parsed.ok, vector.reason);
    assert.equal(parsed.error, vector.error, vector.reason);
  }
});

test("transaction and block ids match the node on every network", () => {
  for (const vector of vectors("identifiers.json").cases) {
    const network = NETWORK_BY_CODE[vector.network_kind]!;
    const hash = fromHex(vector.hash);
    assert.equal(renderIdentifier("transaction", network, hash), vector.tx_id);
    assert.equal(renderIdentifier("block", network, hash), vector.block_id);
    for (const [kind, text] of [["transaction", vector.tx_id], ["block", vector.block_id]] as const) {
      const parsed = parseIdentifier(kind, text, network);
      assert.ok(parsed.ok && hex(parsed.payload) === vector.hash, text);
    }
  }
});

test("names the network an identifier actually belongs to", () => {
  const text = renderIdentifier("block", "private-validation", new Uint8Array(32).fill(0xab));
  for (const network of NETWORKS.filter((n) => n !== "private-validation")) {
    const parsed = parseIdentifier("block", text, network);
    assert.ok(!parsed.ok && parsed.error === "ID_WRONG_NETWORK" && parsed.otherNetwork === "private-validation");
  }
});

test("keccak-256 matches the standard digests", () => {
  assert.equal(hex(keccak256(new Uint8Array())), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  assert.equal(hex(keccak256(new TextEncoder().encode("abc"))), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
  // 136 bytes: the padding block is a full extra block.
  assert.equal(keccak256(new Uint8Array(136)).length, 32);
});

test("with an empty tag the casing is EIP-55 exactly (vectors from EIP-55)", () => {
  for (const vector of [
    "52908400098527886E0F7030069857D2E4169EE7",
    "8617E340B3D01FA5F11F306F4090FD50E238070D",
    "de709f2102306220921060314715629080e2fb77",
    "27b1fdb04752bbc536007a920d24acb045561c26",
    "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "fB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "dbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "D1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
  ]) {
    assert.equal(checksumCase("", vector.toLowerCase()), vector);
  }
});
