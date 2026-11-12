// State proofs (spec Section 16.3, Appendix R.5; node ADR-065), checked in the client.
//
//   StateProof    = list<ProofLevel> (root first) | ProofTerminal
//   ProofLevel    = u16 sibling_bitmap | Hash32 per set bit (ascending nibble)
//   ProofTerminal = u8 tag: 0 Empty | 1 Leaf { key Hash32, value_hash Hash32 }
//
//   leaf     = H_domain("ALETHEIA/JMT-LEAF/v1", state_key || BLAKE3(value))
//   internal = H_domain("ALETHEIA/JMT-NODE/v1", child[0] || … || child[15]), empty child = 32 zero bytes
//   key      = H_domain("ALETHEIA/STATEKEY/v1", u8(namespace) || ace(namespace key))
//
// A port of `aletheia_state::StateProof::verify`; the vectors in tests/fixtures come from the node.
// `verifyStateProof` derives the key itself from what was asked, so a node cannot answer for a
// different record, and checks the result against a state root the caller trusts.

import { blake3 } from "@noble/hashes/blake3.js";
import { AceReader, AceWriter } from "../encoding/ace.js";
import { equalBytes, fromHex, toHex } from "../encoding/hex.js";
import { networkCode, type NetworkKind } from "../network/kind.js";
import type { NetworkBinding } from "../network/domain.js";
import type { StateProofAnswer } from "../rpc/types.js";

const KEY_NIBBLES = 64;
const PLACEHOLDER = new Uint8Array(32);
const TAGS = {
  stateKey: "ALETHEIA/STATEKEY/v1",
  jmtLeaf: "ALETHEIA/JMT-LEAF/v1",
  jmtNode: "ALETHEIA/JMT-NODE/v1",
} as const;

/** State namespaces with records a client proves (crates/state/src/key.rs). */
export const NAMESPACE = { accounts: 1, balances: 2, monetaryLedger: 4 } as const;

export class ProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofError";
  }
}

const encoder = new TextEncoder();

function hDomain(tag: string, network: NetworkBinding, ...parts: Uint8Array[]): Uint8Array {
  const tagBytes = encoder.encode(tag);
  const prefix = new Uint8Array(1 + tagBytes.length + 4 + 1);
  prefix[0] = tagBytes.length;
  prefix.set(tagBytes, 1);
  new DataView(prefix.buffer).setUint32(1 + tagBytes.length, network.chainId, true);
  prefix[prefix.length - 1] = networkCode(network.kind);
  const hasher = blake3.create();
  hasher.update(prefix);
  for (const part of parts) hasher.update(part);
  return hasher.digest();
}

/** The state key of a record: an account, a balance or an asset's supply ledger. */
export function stateKey(
  network: NetworkBinding,
  record:
    | { kind: "account"; address: Uint8Array }
    | { kind: "balance"; address: Uint8Array; assetId: number }
    | { kind: "supply"; assetId: number },
): Uint8Array {
  const w = new AceWriter();
  let namespace: number;
  switch (record.kind) {
    case "account":
      namespace = NAMESPACE.accounts;
      w.fixed(checkAddress(record.address));
      break;
    case "balance":
      namespace = NAMESPACE.balances;
      w.fixed(checkAddress(record.address)).u32(record.assetId);
      break;
    case "supply":
      namespace = NAMESPACE.monetaryLedger;
      w.u32(record.assetId);
      break;
  }
  return hDomain(TAGS.stateKey, network, Uint8Array.of(namespace), w.finish());
}

function checkAddress(address: Uint8Array): Uint8Array {
  if (address.length !== 20) throw new ProofError(`an address is 20 bytes, not ${address.length}`);
  return address;
}

interface ProofLevel {
  bitmap: number;
  siblings: Uint8Array[];
}

export interface StateProof {
  levels: ProofLevel[];
  terminal: { kind: "empty" } | { kind: "leaf"; key: Uint8Array; valueHash: Uint8Array };
}

/** Decodes a proof from its canonical ACE bytes, refusing anything non-canonical. */
export function decodeStateProof(bytes: Uint8Array): StateProof {
  const r = new AceReader(bytes);
  const count = r.u32();
  if (count > KEY_NIBBLES) throw new ProofError(`${count} levels exceed the ${KEY_NIBBLES}-nibble key`);
  const levels: ProofLevel[] = [];
  for (let i = 0; i < count; i++) {
    const bitmap = r.u16();
    const siblings: Uint8Array[] = [];
    for (let n = 0; n < popcount(bitmap); n++) siblings.push(r.fixed(32));
    levels.push({ bitmap, siblings });
  }
  const tag = r.u8();
  let terminal: StateProof["terminal"];
  if (tag === 0) terminal = { kind: "empty" };
  else if (tag === 1) terminal = { kind: "leaf", key: r.fixed(32), valueHash: r.fixed(32) };
  else throw new ProofError(`proof terminal tag ${tag}`);
  r.finish();
  return { levels, terminal };
}

function popcount(n: number): number {
  let count = 0;
  for (let v = n; v; v &= v - 1) count++;
  return count;
}

function nibble(key: Uint8Array, index: number): number {
  const byte = key[index >> 1] ?? 0;
  return index % 2 === 0 ? byte >> 4 : byte & 0x0f;
}

function childrenWith(level: ProofLevel, pathNibble: number, current: Uint8Array): Uint8Array[] | null {
  if (level.bitmap & (1 << pathNibble) || popcount(level.bitmap) !== level.siblings.length) return null;
  const children: Uint8Array[] = [];
  let next = 0;
  for (let n = 0; n < 16; n++) {
    if (n === pathNibble) children.push(current);
    else if (level.bitmap & (1 << n)) children.push(level.siblings[next++]!);
    else children.push(PLACEHOLDER);
  }
  return children;
}

/**
 * Checks that `key` holds `value` (or, for `null`, is absent) in the tree whose root is `root`.
 * Throws a `ProofError` naming what is wrong; returns normally only when the proof holds.
 */
export function checkStateProof(
  network: NetworkBinding,
  root: Uint8Array,
  key: Uint8Array,
  value: Uint8Array | null,
  proof: StateProof,
): void {
  const depth = proof.levels.length;
  if (depth > KEY_NIBBLES) throw new ProofError(`${depth} levels exceed the key`);
  let current: Uint8Array;
  const t = proof.terminal;
  if (t.kind === "leaf") {
    if (value !== null) {
      if (!equalBytes(t.key, key)) throw new ProofError("proof ends at a different key's leaf, so the key is absent");
      if (!equalBytes(t.valueHash, blake3(value))) throw new ProofError("leaf holds a different value");
    } else {
      if (equalBytes(t.key, key)) throw new ProofError("proof shows the key present");
      for (let i = 0; i < depth; i++) {
        if (nibble(t.key, i) !== nibble(key, i)) throw new ProofError("terminal leaf is not on the key's path");
      }
    }
    current = hDomain(TAGS.jmtLeaf, network, t.key, t.valueHash);
  } else {
    if (value !== null) throw new ProofError("proof shows the key absent");
    current = PLACEHOLDER;
  }
  for (let level = depth - 1; level >= 0; level--) {
    const children = childrenWith(proof.levels[level]!, nibble(key, level), current);
    if (!children) throw new ProofError(`level ${level} is malformed`);
    current = hDomain(TAGS.jmtNode, network, ...children);
  }
  if (!equalBytes(current, root)) {
    throw new ProofError(`recomputed root ${toHex(current)} differs from ${toHex(root)}`);
  }
}

/**
 * Verifies a `getStateProof` answer for the record the caller asked about, against a state root
 * the caller trusts (from a block header it has checked, not from the same answer). Returns the
 * proven value bytes (canonical ACE), or `null` when the record is proven absent.
 */
export function verifyStateProof(
  network: { chainId: number; kind: NetworkKind },
  trustedStateRoot: Uint8Array,
  asked: Parameters<typeof stateKey>[1],
  answer: StateProofAnswer,
): Uint8Array | null {
  const key = stateKey(network, asked);
  if (answer.record !== asked.kind) throw new ProofError(`asked for ${asked.kind}, answered ${answer.record}`);
  if (!equalBytes(fromHex(answer.key), key)) throw new ProofError("the answer is for a different state key");
  if (!equalBytes(fromHex(answer.stateRoot), trustedStateRoot)) {
    throw new ProofError("the answer is against a different state root than the trusted one");
  }
  const value = answer.value === null ? null : fromHex(answer.value);
  checkStateProof(network, trustedStateRoot, key, value, decodeStateProof(fromHex(answer.proof)));
  return value;
}
