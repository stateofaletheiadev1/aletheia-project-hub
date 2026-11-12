// Multisig accounts (spec Section 11, ADR-044; `crates/crypto/src/address.rs` multisig_account):
//   keys       = Ed25519 public keys in canonical order (ascending bytes), 1 to 16, distinct
//   commitment = H_domain("ALETHEIA/ADDR/v1", u8(1) || u8(threshold) || list<u8(1) || bytes(key)>)
//   address    = last 20 bytes of the commitment
// A transfer from a multisig account carries every key and exactly `threshold` signatures, in
// ascending key index; extra signatures are refused by the node (they would change the witness).
// Each holder signs the same TXSIG digest on their own device; `assembleMultisig` checks every
// share against that digest before it is used.

import { ed25519 } from "@noble/curves/ed25519.js";
import { AceWriter } from "../encoding/ace.js";
import { equalBytes, toHex } from "../encoding/hex.js";
import { DOMAIN_TAGS, domainHash, type NetworkBinding } from "../network/domain.js";
import { renderAddress } from "../addresses/identifiers.js";
import type { CanonicalAddress } from "../util/brand.js";
import { decodeBody, signingDigest, txIdOf } from "../transactions/body.js";

const ADDRESS_TYPE_MULTISIG = 1;
const AUTH_SCHEME_MULTI_ED25519 = 2;
const ALG_ED25519 = 1;
export const MAX_MULTISIG_KEYS = 16;

export class MultisigError extends Error {
  override name = "MultisigError";
}

function compare(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

/** The keys in the order the chain uses, checked: 32 bytes each, distinct, 1 to 16. */
export function canonicalKeys(publicKeys: readonly Uint8Array[]): Uint8Array[] {
  if (publicKeys.length === 0 || publicKeys.length > MAX_MULTISIG_KEYS) {
    throw new MultisigError(`a multisig account has 1 to ${MAX_MULTISIG_KEYS} keys, not ${publicKeys.length}`);
  }
  const sorted = publicKeys.map((k) => {
    if (k.length !== 32) throw new MultisigError(`an Ed25519 public key is 32 bytes, not ${k.length}`);
    return k.slice();
  });
  sorted.sort(compare);
  for (let i = 1; i < sorted.length; i++) {
    if (equalBytes(sorted[i - 1]!, sorted[i]!)) throw new MultisigError("the same key appears twice");
  }
  return sorted;
}

function checkThreshold(threshold: number, keys: number): void {
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > keys) {
    throw new MultisigError(`the threshold is 1 to ${keys}, not ${threshold}`);
  }
}

function keyList(keys: readonly Uint8Array[]): AceWriter {
  const w = new AceWriter().u32(keys.length);
  for (const key of keys) w.u8(ALG_ED25519).bytes(key);
  return w;
}

export function multisigAddressBytes(network: NetworkBinding, threshold: number, publicKeys: readonly Uint8Array[]): Uint8Array {
  const keys = canonicalKeys(publicKeys);
  checkThreshold(threshold, keys.length);
  const commitment = domainHash(
    DOMAIN_TAGS.address,
    network,
    Uint8Array.of(ADDRESS_TYPE_MULTISIG, threshold),
    keyList(keys).finish(),
  );
  return commitment.slice(12);
}

export function multisigAddress(network: NetworkBinding, threshold: number, publicKeys: readonly Uint8Array[]): CanonicalAddress {
  return renderAddress(multisigAddressBytes(network, threshold, publicKeys), network.kind);
}

/** One holder's signature over a body, made with their own key on their own device. */
export interface MultisigShare {
  readonly publicKey: Uint8Array;
  readonly signature: Uint8Array;
}

/** Signs a multisig account's body after checking it is for this network. */
export function signMultisigShare(bodyBytes: Uint8Array, key: Uint8Array, network: NetworkBinding): MultisigShare {
  const body = decodeBody(bodyBytes);
  if (body.chainId !== network.chainId || body.networkKind !== network.kind) {
    throw new MultisigError(`the body is for chain ${body.chainId} ${body.networkKind}, not chain ${network.chainId} ${network.kind}`);
  }
  return { publicKey: ed25519.getPublicKey(key), signature: ed25519.sign(signingDigest(bodyBytes, network), key) };
}

function withAuthorization(bodyBytes: Uint8Array, authorization: Uint8Array): Uint8Array {
  const out = new Uint8Array(bodyBytes.length + authorization.length);
  out.set(bodyBytes);
  out.set(authorization, bodyBytes.length);
  return out;
}

/**
 * The signed transaction: the body, every key, and the first `threshold` valid shares in key
 * order. Refuses a body whose sender is not this multisig account, a share from a key outside it
 * or with a signature that does not verify, and fewer valid shares than the threshold.
 */
export function assembleMultisig(
  bodyBytes: Uint8Array,
  network: NetworkBinding,
  threshold: number,
  publicKeys: readonly Uint8Array[],
  shares: readonly MultisigShare[],
): { signed: Uint8Array; txId: string } {
  const keys = canonicalKeys(publicKeys);
  checkThreshold(threshold, keys.length);
  const body = decodeBody(bodyBytes);
  if (!equalBytes(body.sender, multisigAddressBytes(network, threshold, keys))) {
    throw new MultisigError("the body's sender is not the multisig account of these keys and threshold");
  }
  const digest = signingDigest(bodyBytes, network);
  const byIndex = new Map<number, Uint8Array>();
  for (const share of shares) {
    const index = keys.findIndex((k) => equalBytes(k, share.publicKey));
    if (index < 0) throw new MultisigError(`key ${toHex(share.publicKey)} is not one of the account's keys`);
    if (!ed25519.verify(share.signature, digest, share.publicKey)) {
      throw new MultisigError(`the signature from key ${toHex(share.publicKey)} does not verify`);
    }
    byIndex.set(index, share.signature);
  }
  const chosen = [...byIndex.keys()].sort((a, b) => a - b).slice(0, threshold);
  if (chosen.length < threshold) throw new MultisigError(`${chosen.length} of ${threshold} required signatures`);
  const auth = keyList(keys);
  const w = new AceWriter().u8(AUTH_SCHEME_MULTI_ED25519).u8(threshold).fixed(auth.finish()).u32(chosen.length);
  for (const index of chosen) w.u8(index).u8(ALG_ED25519).bytes(byIndex.get(index)!);
  return { signed: withAuthorization(bodyBytes, w.finish()), txId: txIdOf(bodyBytes, network) };
}

/** An unsigned preview for `simulateTransaction` (node ADR-064): every key, no signatures. */
export function encodeMultisigPreview(bodyBytes: Uint8Array, threshold: number, publicKeys: readonly Uint8Array[]): Uint8Array {
  const keys = canonicalKeys(publicKeys);
  checkThreshold(threshold, keys.length);
  const w = new AceWriter().u8(AUTH_SCHEME_MULTI_ED25519).u8(threshold).fixed(keyList(keys).finish()).u32(0);
  return withAuthorization(bodyBytes, w.finish());
}
