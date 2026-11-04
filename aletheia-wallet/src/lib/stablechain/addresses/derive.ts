// Account addresses from keys (spec Section 11, ADR-062; `crates/crypto/src/address.rs`):
//   account_hash = H_domain("ALETHEIA/ADDR/v1", u8(0) || u8(alg_id = 1) || ed25519_pubkey)
//   address      = last 20 bytes of account_hash
// The network is inside the hash, so one key has a different address on every network.

import type { CanonicalAddress } from "$lib/types/brand";
import { DOMAIN_TAGS, domainHash, type NetworkBinding } from "../network/domain";
import { renderAddress } from "./identifiers";

const ADDRESS_TYPE_ED25519 = 0;
const ALG_ED25519 = 1;

export function ed25519Commitment(network: NetworkBinding, publicKey: Uint8Array): Uint8Array {
  if (publicKey.length !== 32) throw new Error(`an Ed25519 public key is 32 bytes, got ${publicKey.length}`);
  return domainHash(DOMAIN_TAGS.address, network, Uint8Array.of(ADDRESS_TYPE_ED25519, ALG_ED25519), publicKey);
}

export function ed25519AddressBytes(network: NetworkBinding, publicKey: Uint8Array): Uint8Array {
  return ed25519Commitment(network, publicKey).slice(12);
}

export function ed25519Address(network: NetworkBinding, publicKey: Uint8Array): CanonicalAddress {
  return renderAddress(ed25519AddressBytes(network, publicKey), network.kind);
}
