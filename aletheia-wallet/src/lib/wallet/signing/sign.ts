// Signing (spec Section 41: "sign digest"; `crates/wallet/src/flow.rs` Account::sign). The key
// signs the 32-byte TXSIG digest of the exact body bytes. Before signing, the body is decoded and
// its sender and network are checked against the key: the worker never signs bytes it has not
// read. Runs only inside the wallet worker.

import { ed25519 } from "@noble/curves/ed25519.js";
import { equalBytes, toHex } from "$lib/stablechain/encoding/hex";
import { ed25519AddressBytes } from "$lib/stablechain/addresses/derive";
import type { NetworkBinding } from "$lib/stablechain/network/domain";
import { decodeBody, encodeSigned, signingDigest, txIdOf } from "$lib/stablechain/transactions/body";

export interface SignedTransfer {
  readonly signed: Uint8Array;
  readonly txId: string;
  readonly digest: string;
  readonly publicKey: string;
}

export class SigningError extends Error {
  override name = "SigningError";
}

/** The `Signer` contract of wallet prompt 11.4; hardware signers implement the same shape. */
export interface Signer {
  getPublicKey(index: number): Promise<Uint8Array>;
  signTransfer(bodyBytes: Uint8Array, index: number, network: NetworkBinding): Promise<SignedTransfer>;
}

export function signTransferWithKey(bodyBytes: Uint8Array, key: Uint8Array, network: NetworkBinding): SignedTransfer {
  const body = decodeBody(bodyBytes);
  if (body.chainId !== network.chainId || body.networkKind !== network.kind) {
    throw new SigningError(
      `the body is for chain ${body.chainId} ${body.networkKind}, not chain ${network.chainId} ${network.kind}`,
    );
  }
  const publicKey = ed25519.getPublicKey(key);
  if (!equalBytes(ed25519AddressBytes(network, publicKey), body.sender)) {
    throw new SigningError("the body's sender is not the account this key controls");
  }
  const digest = signingDigest(bodyBytes, network);
  const signature = ed25519.sign(digest, key);
  return {
    signed: encodeSigned(bodyBytes, publicKey, signature),
    txId: txIdOf(bodyBytes, network),
    digest: toHex(digest),
    publicKey: toHex(publicKey),
  };
}
