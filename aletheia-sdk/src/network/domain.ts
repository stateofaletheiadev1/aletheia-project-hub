// Domain-separated hashing (APS-0001, spec Section 10):
//   H_domain(tag, msg) = BLAKE3( u8(len(tag)) || tag || u32_le(chain_id) || u8(network_kind) || msg )
// Chain id and network kind sit inside every digest, so a signature for one network is invalid
// on every other.

import { blake3 } from "@noble/hashes/blake3.js";
import type { Digest32 } from "../util/brand.js";
import { networkCode, type NetworkKind } from "./kind.js";

export const DOMAIN_TAGS = {
  txId: "ALETHEIA/TXID/v1",
  txSignature: "ALETHEIA/TXSIG/v1",
  txWitness: "ALETHEIA/TXWIT/v1",
  address: "ALETHEIA/ADDR/v1",
} as const;
export type DomainTag = (typeof DOMAIN_TAGS)[keyof typeof DOMAIN_TAGS];

/** The two fields of a network identity that enter every digest. */
export interface NetworkBinding {
  readonly chainId: number;
  readonly kind: NetworkKind;
}

const encoder = new TextEncoder();

export function domainHash(tag: DomainTag, network: NetworkBinding, ...message: Uint8Array[]): Digest32 {
  const tagBytes = encoder.encode(tag);
  const prefix = new Uint8Array(1 + tagBytes.length + 4 + 1);
  prefix[0] = tagBytes.length;
  prefix.set(tagBytes, 1);
  new DataView(prefix.buffer).setUint32(1 + tagBytes.length, network.chainId, true);
  prefix[prefix.length - 1] = networkCode(network.kind);
  const hasher = blake3.create();
  hasher.update(prefix);
  for (const part of message) hasher.update(part);
  return hasher.digest() as Digest32;
}
