// SLIP-0010 Ed25519 derivation (spec Section 41; `crates/wallet/src/derive.rs`). Ed25519 under
// SLIP-0010 has hardened children only. Built on audited HMAC-SHA512 from @noble/hashes; the
// derivation logic is the published algorithm and is checked against its official vectors.
// Runs only inside the wallet worker.

import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";

/**
 * The coin type, settled 2026-11-12 and identical to `COIN_TYPE` in the node's wallet crate so the
 * same seed gives the same keys as `aletheia-cli` (PROTOCOL_DISCREPANCIES D-1).
 */
export const COIN_TYPE = 7771;

const HARDENED = 0x8000_0000;
const encoder = new TextEncoder();

export interface ExtendedKey {
  readonly key: Uint8Array;
  readonly chainCode: Uint8Array;
}

function split(digest: Uint8Array): ExtendedKey {
  const node = { key: digest.slice(0, 32), chainCode: digest.slice(32, 64) };
  digest.fill(0);
  return node;
}

export function wipe(node: ExtendedKey): void {
  node.key.fill(0);
  node.chainCode.fill(0);
}

export function masterKey(seed: Uint8Array): ExtendedKey {
  if (seed.length < 16 || seed.length > 64) throw new Error("a seed is 16 to 64 bytes");
  return split(hmac(sha512, encoder.encode("ed25519 seed"), seed));
}

/** Hardened child `index'`. */
export function childKey(parent: ExtendedKey, index: number): ExtendedKey {
  if (!Number.isInteger(index) || index < 0 || index >= HARDENED) throw new Error(`child index out of range: ${index}`);
  const data = new Uint8Array(37);
  data.set(parent.key, 1);
  new DataView(data.buffer).setUint32(33, (index | HARDENED) >>> 0, false);
  const node = split(hmac(sha512, parent.chainCode, data));
  data.fill(0);
  return node;
}

/** Follows hardened indices from `seed`, wiping every intermediate node. */
export function derivePath(seed: Uint8Array, indices: readonly number[]): ExtendedKey {
  let node = masterKey(seed);
  for (const index of indices) {
    const next = childKey(node, index);
    wipe(node);
    node = next;
  }
  return node;
}

export function accountPath(index: number, account = 0): readonly number[] {
  return [44, COIN_TYPE, account, 0, index];
}

export function pathText(index: number, account = 0): string {
  return `m/${accountPath(index, account)
    .map((part) => `${part}'`)
    .join("/")}`;
}

/** The 32-byte Ed25519 seed at `m/44'/7771'/account'/0'/index'`. Caller wipes it. */
export function accountSeed(seed: Uint8Array, index: number, account = 0): Uint8Array {
  const node = derivePath(seed, accountPath(index, account));
  const key = node.key.slice();
  wipe(node);
  return key;
}
