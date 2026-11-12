// `alt:`, `alt:T` and `alt:B` identifiers (APS-0002, ADR-062; `crates/core/src/text_id.rs`).
// A fixed prefix, then the payload in hex whose letter case is EIP-55 over
// Keccak-256(tag || lowercase hex), where tag = network HRP + suffix + ":". Exactly one spelling
// is canonical; every other spelling is refused, never normalised (wallet prompt 12.6).

import { keccak_256 } from "@noble/hashes/sha3.js";
import type { BlockId, CanonicalAddress, TxId } from "../util/brand.js";
import { fromHex, toHex } from "../encoding/hex.js";
import { NETWORK_KINDS, networkHrp, type NetworkKind } from "../network/kind.js";

export type IdentifierProblem = "malformed" | "wrong-network" | "non-canonical";

export class IdentifierError extends Error {
  override name = "IdentifierError";
  constructor(
    readonly problem: IdentifierProblem,
    message: string,
    /** For `wrong-network`: the network whose checksum the text carries. */
    readonly foundNetwork: NetworkKind | null = null,
  ) {
    super(message);
  }
}

interface IdForm {
  readonly what: string;
  readonly prefix: string;
  readonly hrpSuffix: string;
  readonly payloadLength: number;
}

export const ADDRESS_FORM: IdForm = { what: "address", prefix: "alt:", hrpSuffix: "", payloadLength: 20 };
export const TX_ID_FORM: IdForm = { what: "transaction id", prefix: "alt:T", hrpSuffix: "t", payloadLength: 32 };
export const BLOCK_ID_FORM: IdForm = { what: "block id", prefix: "alt:B", hrpSuffix: "b", payloadLength: 32 };

export function textLength(form: IdForm): number {
  return form.prefix.length + form.payloadLength * 2;
}

const encoder = new TextEncoder();

/** EIP-55 casing of `lowerHex` under `tag`; with an empty tag this is EIP-55 exactly. */
export function checksumCase(tag: string, lowerHex: string): string {
  const digest = keccak_256(encoder.encode(tag + lowerHex));
  let out = "";
  for (let i = 0; i < lowerHex.length; i++) {
    const character = lowerHex[i]!;
    const byte = digest[i >> 1]!;
    const nibble = i % 2 === 0 ? byte >> 4 : byte & 15;
    out += /[a-f]/.test(character) && nibble >= 8 ? character.toUpperCase() : character;
  }
  return out;
}

function tagFor(form: IdForm, network: NetworkKind): string {
  return `${networkHrp(network)}${form.hrpSuffix}:`;
}

export function renderId(form: IdForm, network: NetworkKind, payload: Uint8Array): string {
  if (payload.length !== form.payloadLength) {
    throw new IdentifierError(
      "malformed",
      `${form.what}: payload is ${payload.length} bytes, expected ${form.payloadLength}`,
    );
  }
  return form.prefix + checksumCase(tagFor(form, network), toHex(payload));
}

/** The payload bytes of a canonical identifier for `network`. */
export function parseId(form: IdForm, text: string, network: NetworkKind): Uint8Array {
  const fail = (problem: IdentifierProblem, reason: string, found: NetworkKind | null = null) =>
    new IdentifierError(problem, `${form.what}: ${reason}`, found);
  if (text.length !== textLength(form)) {
    throw fail("malformed", `length ${text.length} (canonical length is ${textLength(form)})`);
  }
  const prefix = text.slice(0, form.prefix.length);
  const body = text.slice(form.prefix.length);
  if (prefix !== form.prefix) {
    const caseOnly = prefix.toLowerCase() === form.prefix.toLowerCase();
    throw fail(caseOnly ? "non-canonical" : "malformed", `does not start with '${form.prefix}'`);
  }
  if (!/^[0-9a-fA-F]*$/.test(body)) throw fail("malformed", "contains a character that is not a hex digit");
  const lower = body.toLowerCase();
  if (body === checksumCase(tagFor(form, network), lower)) return fromHex(lower);
  const other = NETWORK_KINDS.find((kind) => kind !== network && body === checksumCase(tagFor(form, kind), lower));
  if (other) throw fail("wrong-network", `checksum is valid for ${other}, not ${network}`, other);
  if (body === lower || body === body.toUpperCase()) {
    throw fail("non-canonical", "hex has no checksum casing; use the mixed-case form");
  }
  throw fail("malformed", "checksum casing does not verify");
}

export function parseAddress(text: string, network: NetworkKind): CanonicalAddress {
  parseId(ADDRESS_FORM, text, network);
  return text as CanonicalAddress;
}

export function parseTxId(text: string, network: NetworkKind): TxId {
  parseId(TX_ID_FORM, text, network);
  return text as TxId;
}

export function parseBlockId(text: string, network: NetworkKind): BlockId {
  parseId(BLOCK_ID_FORM, text, network);
  return text as BlockId;
}

export function addressBytes(address: CanonicalAddress, network: NetworkKind): Uint8Array {
  return parseId(ADDRESS_FORM, address, network);
}

export function renderAddress(bytes: Uint8Array, network: NetworkKind): CanonicalAddress {
  return renderId(ADDRESS_FORM, network, bytes) as CanonicalAddress;
}

export function renderTxId(hash: Uint8Array, network: NetworkKind): TxId {
  return renderId(TX_ID_FORM, network, hash) as TxId;
}

export function renderBlockId(hash: Uint8Array, network: NetworkKind): BlockId {
  return renderId(BLOCK_ID_FORM, network, hash) as BlockId;
}

/** Non-throwing check for form fields: what is wrong, or null when canonical. */
export function addressProblem(
  text: string,
  network: NetworkKind,
): { problem: IdentifierProblem; message: string; foundNetwork: NetworkKind | null } | null {
  try {
    parseId(ADDRESS_FORM, text, network);
    return null;
  } catch (error) {
    if (error instanceof IdentifierError) {
      return { problem: error.problem, message: error.message, foundNetwork: error.foundNetwork };
    }
    throw error;
  }
}
