// Transaction wire format (APS-0003, spec Section 13; `crates/core/src/tx.rs`):
//
//   TransactionBody = version u16 | chain_id u32 | network_kind u8 | tx_type u16 | sender [20]
//                   | nonce u64 | fee_asset u32 | max_fee u128 | eu_limit u64
//                   | valid_from_slot u64 | expiry_slot u64 | memo bytes<=256 | payload
//   Transfer payload (tx_type 1) = recipient [20] | asset u32 | amount u128
//   SignedTransaction = TransactionBody || Authorization
//
// The wallet builds and signs Transfer only. Decoding exists so the review shows what the exact
// bytes say (wallet prompt 13.1 step 5), never what the form said.

import type { Digest32, TxId } from "../util/brand.js";
import { AceError, AceReader, AceWriter } from "../encoding/ace.js";
import { DOMAIN_TAGS, domainHash, type NetworkBinding } from "../network/domain.js";
import { NETWORK_KINDS, networkCode, type NetworkKind } from "../network/kind.js";
import { renderTxId } from "../addresses/identifiers.js";

export const TX_BODY_VERSION_1 = 1;
export const TX_TYPE_TRANSFER = 1;
export const MAX_MEMO_BYTES = 256;

export interface TransferBody {
  readonly version: number;
  readonly chainId: number;
  readonly networkKind: NetworkKind;
  readonly sender: Uint8Array;
  readonly nonce: bigint;
  readonly feeAsset: number;
  readonly maxFee: bigint;
  readonly euLimit: bigint;
  readonly validFromSlot: bigint;
  readonly expirySlot: bigint;
  readonly memo: Uint8Array;
  readonly recipient: Uint8Array;
  readonly asset: number;
  readonly amount: bigint;
}

function fixed20(bytes: Uint8Array, field: string): Uint8Array {
  if (bytes.length !== 20) throw new AceError(`${field} is ${bytes.length} bytes, expected 20`);
  return bytes;
}

export function encodeBody(body: TransferBody): Uint8Array {
  if (body.memo.length > MAX_MEMO_BYTES)
    throw new AceError(`memo is ${body.memo.length} bytes, at most ${MAX_MEMO_BYTES}`);
  return new AceWriter()
    .u16(body.version)
    .u32(body.chainId)
    .u8(networkCode(body.networkKind))
    .u16(TX_TYPE_TRANSFER)
    .fixed(fixed20(body.sender, "sender"))
    .u64(body.nonce)
    .u32(body.feeAsset)
    .u128(body.maxFee)
    .u64(body.euLimit)
    .u64(body.validFromSlot)
    .u64(body.expirySlot)
    .bytes(body.memo)
    .fixed(fixed20(body.recipient, "recipient"))
    .u32(body.asset)
    .u128(body.amount)
    .finish();
}

function readBody(reader: AceReader): TransferBody {
  const version = reader.u16();
  const chainId = reader.u32();
  const code = reader.u8();
  const networkKind = NETWORK_KINDS.find((kind) => networkCode(kind) === code);
  if (!networkKind) throw new AceError(`network kind ${code} is not registered`);
  const txType = reader.u16();
  if (txType !== TX_TYPE_TRANSFER) throw new AceError(`transaction type ${txType} is not a transfer`);
  return {
    version,
    chainId,
    networkKind,
    sender: reader.fixed(20),
    nonce: reader.u64(),
    feeAsset: reader.u32(),
    maxFee: reader.u128(),
    euLimit: reader.u64(),
    validFromSlot: reader.u64(),
    expirySlot: reader.u64(),
    memo: reader.bytes(MAX_MEMO_BYTES),
    recipient: reader.fixed(20),
    asset: reader.u32(),
    amount: reader.u128(),
  };
}

/** Decodes a complete transfer body; trailing bytes are an error. */
export function decodeBody(bytes: Uint8Array): TransferBody {
  const reader = new AceReader(bytes);
  const body = readBody(reader);
  reader.finish();
  return body;
}

/** `H_domain("ALETHEIA/TXSIG/v1", ace(body))`: the 32 bytes the key signs. */
export function signingDigest(bodyBytes: Uint8Array, network: NetworkBinding): Digest32 {
  return domainHash(DOMAIN_TAGS.txSignature, network, bodyBytes);
}

/** `H_domain("ALETHEIA/TXID/v1", ace(body))`; signatures are excluded (ADR-011). */
export function txIdOf(bodyBytes: Uint8Array, network: NetworkBinding): TxId {
  return renderTxId(domainHash(DOMAIN_TAGS.txId, network, bodyBytes), network.kind);
}

const AUTH_SCHEME_ED25519 = 1;
const ALG_ED25519 = 1;

/** `body || Authorization{ Ed25519, threshold 1, [key], [sig by index 0] }`. */
export function encodeSigned(bodyBytes: Uint8Array, publicKey: Uint8Array, signature: Uint8Array): Uint8Array {
  if (publicKey.length !== 32) throw new AceError("an Ed25519 public key is 32 bytes");
  if (signature.length !== 64) throw new AceError("an Ed25519 signature is 64 bytes");
  const authorization = new AceWriter()
    .u8(AUTH_SCHEME_ED25519)
    .u8(1)
    .u32(1)
    .u8(ALG_ED25519)
    .bytes(publicKey)
    .u32(1)
    .u8(0)
    .u8(ALG_ED25519)
    .bytes(signature)
    .finish();
  const out = new Uint8Array(bodyBytes.length + authorization.length);
  out.set(bodyBytes);
  out.set(authorization, bodyBytes.length);
  return out;
}

/**
 * An unsigned preview for `simulateTransaction` (node ADR-064): the body and the sender's public
 * key, with an empty signature list. The node prices it without a signature and never admits it.
 */
export function encodePreview(bodyBytes: Uint8Array, publicKey: Uint8Array): Uint8Array {
  if (publicKey.length !== 32) throw new AceError("an Ed25519 public key is 32 bytes");
  const authorization = new AceWriter()
    .u8(AUTH_SCHEME_ED25519)
    .u8(1)
    .u32(1)
    .u8(ALG_ED25519)
    .bytes(publicKey)
    .u32(0)
    .finish();
  const out = new Uint8Array(bodyBytes.length + authorization.length);
  out.set(bodyBytes);
  out.set(authorization, bodyBytes.length);
  return out;
}

export interface DecodedSigned {
  readonly body: TransferBody;
  readonly bodyBytes: Uint8Array;
  readonly publicKey: Uint8Array;
  readonly signature: Uint8Array;
}

/** Splits signed bytes back into body and single-key authorization. */
export function decodeSigned(bytes: Uint8Array): DecodedSigned {
  const reader = new AceReader(bytes);
  const body = readBody(reader);
  const bodyBytes = bytes.slice(0, reader.position);
  if (reader.u8() !== AUTH_SCHEME_ED25519) throw new AceError("authorization is not single Ed25519");
  if (reader.u8() !== 1) throw new AceError("threshold is not 1");
  if (reader.u32() !== 1) throw new AceError("expected one public key");
  if (reader.u8() !== ALG_ED25519) throw new AceError("key is not Ed25519");
  const publicKey = reader.bytes(48);
  if (reader.u32() !== 1) throw new AceError("expected one signature");
  if (reader.u8() !== 0 || reader.u8() !== ALG_ED25519) throw new AceError("signature entry is not index 0, Ed25519");
  const signature = reader.bytes(96);
  reader.finish();
  return { body, bodyBytes, publicKey, signature };
}
