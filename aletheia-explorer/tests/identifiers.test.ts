// The browser parser must agree with the Rust node on every published APS-0002 vector.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NETWORKS, parseIdentifier, renderIdentifier, type NetworkKind } from "../src/lib/encoding/identifiers.ts";

const vectors = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../aletheia-node/tests/vectors/APS-0002/${name}`, import.meta.url), "utf8"));

const NETWORK_BY_CODE: Record<number, NetworkKind> = { 1: "mainnet", 2: "private-validation", 3: "devnet", 4: "regtest" };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const fromHex = (text: string) => Uint8Array.from(Buffer.from(text, "hex"));

test("renders and parses every valid address vector exactly as the node does", () => {
  for (const vector of vectors("addresses.json").valid) {
    const network = NETWORK_BY_CODE[vector.network_kind];
    assert.equal(renderIdentifier("address", network, fromHex(vector.payload)), vector.text);
    const parsed = parseIdentifier("address", vector.text, network);
    assert.ok(parsed.ok, vector.text);
    assert.equal(hex(parsed.payload), vector.payload);
  }
});

test("rejects every invalid address vector with the node's error name", () => {
  for (const vector of vectors("addresses.json").invalid) {
    const parsed = parseIdentifier("address", vector.text, NETWORK_BY_CODE[vector.network_kind]);
    assert.ok(!parsed.ok, vector.reason);
    assert.equal(parsed.error, vector.error, vector.reason);
  }
});

test("transaction and block ids match the node on every network", () => {
  for (const vector of vectors("identifiers.json").cases) {
    const network = NETWORK_BY_CODE[vector.network_kind];
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
  const text = renderIdentifier("block", "private-validation", new Uint8Array(32).fill(3));
  for (const network of NETWORKS.filter((n) => n !== "private-validation")) {
    const parsed = parseIdentifier("block", text, network);
    assert.ok(!parsed.ok && parsed.error === "ID_WRONG_NETWORK" && parsed.otherNetwork === "private-validation");
  }
});
