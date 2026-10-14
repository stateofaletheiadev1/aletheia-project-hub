// Parsing of alt:, alt:T and alt:B identifiers in the browser (APS-0002, spec 41A.9, 41A.15,
// ADR-062).
//
// A port of crates/core/src/text_id.rs. It returns the same verdicts, by the same APS-0038
// error names, and the tests check it against the vectors the Rust node publishes in
// aletheia-node/tests/vectors/APS-0002. The search uses it to refuse an address whose
// checksum fails before any request is made, and never "corrects" one into another
// valid address.
//
// Form: a prefix, then the payload in hex whose letters carry an EIP-55 checksum computed over
// Keccak-256(network HRP + kind suffix + ":" + lowercase hex). Addresses are 20 bytes (44
// characters), transaction and block IDs 32 bytes (69 characters).

import { keccak256 } from "./keccak.ts";

export type NetworkKind = "mainnet" | "private-validation" | "devnet" | "regtest";

export const NETWORKS: readonly NetworkKind[] = ["mainnet", "private-validation", "devnet", "regtest"];

const ADDRESS_HRP: Record<NetworkKind, string> = {
  mainnet: "al",
  "private-validation": "alt",
  devnet: "ald",
  regtest: "alr",
};

export type IdentifierKind = "address" | "transaction" | "block";

interface Form {
  readonly prefix: string;
  readonly hrpSuffix: string;
  readonly payloadLen: number;
  readonly malformed: string;
  readonly wrongNetwork: string;
  readonly nonCanonical: string;
}

const FORMS: Record<IdentifierKind, Form> = {
  address: {
    prefix: "alt:",
    hrpSuffix: "",
    payloadLen: 20,
    malformed: "ADDR_MALFORMED",
    wrongNetwork: "ADDR_WRONG_NETWORK",
    nonCanonical: "ADDR_NON_CANONICAL",
  },
  transaction: {
    prefix: "alt:T",
    hrpSuffix: "t",
    payloadLen: 32,
    malformed: "ID_MALFORMED",
    wrongNetwork: "ID_WRONG_NETWORK",
    nonCanonical: "ID_NON_CANONICAL",
  },
  block: {
    prefix: "alt:B",
    hrpSuffix: "b",
    payloadLen: 32,
    malformed: "ID_MALFORMED",
    wrongNetwork: "ID_WRONG_NETWORK",
    nonCanonical: "ID_NON_CANONICAL",
  },
};

/** Canonical text length of each kind: the prefix plus two hex digits per payload byte. */
export const TEXT_LEN: Record<IdentifierKind, number> = {
  address: FORMS.address.prefix.length + 2 * FORMS.address.payloadLen,
  transaction: FORMS.transaction.prefix.length + 2 * FORMS.transaction.payloadLen,
  block: FORMS.block.prefix.length + 2 * FORMS.block.payloadLen,
};

export type ParseResult =
  | { readonly ok: true; readonly payload: Uint8Array }
  | { readonly ok: false; readonly error: string; readonly reason: string; readonly otherNetwork?: NetworkKind };

const encoder = new TextEncoder();

function tagFor(form: Form, network: NetworkKind): string {
  return `${ADDRESS_HRP[network]}${form.hrpSuffix}:`;
}

function toLowerHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * EIP-55 casing of `lowerHex`: digit i is uppercase when it is a letter and nibble i of
 * Keccak-256(tag + lowerHex) is 8 or more. With an empty tag this is EIP-55 exactly.
 */
export function checksumCase(tag: string, lowerHex: string): string {
  const digest = keccak256(encoder.encode(tag + lowerHex));
  let out = "";
  for (let i = 0; i < lowerHex.length; i++) {
    const character = lowerHex[i] ?? "";
    const byte = digest[i >> 1] ?? 0;
    const nibble = i % 2 === 0 ? byte >> 4 : byte & 0x0f;
    out += /[a-f]/.test(character) && nibble >= 8 ? character.toUpperCase() : character;
  }
  return out;
}

export function renderIdentifier(kind: IdentifierKind, network: NetworkKind, payload: Uint8Array): string {
  const form = FORMS[kind];
  return form.prefix + checksumCase(tagFor(form, network), toLowerHex(payload));
}

export function parseIdentifier(kind: IdentifierKind, text: string, network: NetworkKind): ParseResult {
  const form = FORMS[kind];
  const fail = (error: string, reason: string, otherNetwork?: NetworkKind): ParseResult =>
    otherNetwork ? { ok: false, error, reason, otherNetwork } : { ok: false, error, reason };

  const length = TEXT_LEN[kind];
  if (text.length !== length) {
    return fail(form.malformed, `length ${text.length} (canonical length is ${length})`);
  }
  const prefix = text.slice(0, form.prefix.length);
  if (prefix !== form.prefix) {
    const caseOnly = prefix.toLowerCase() === form.prefix.toLowerCase();
    return fail(caseOnly ? form.nonCanonical : form.malformed, `does not start with '${form.prefix}'`);
  }

  const body = text.slice(form.prefix.length);
  for (const [index, character] of [...body].entries()) {
    if (!/[0-9a-fA-F]/.test(character)) {
      return fail(form.malformed, `'${character}' at position ${index + form.prefix.length} is not a hex digit`);
    }
  }
  const lower = body.toLowerCase();
  const payload = Uint8Array.from(lower.match(/../g) ?? [], (pair) => parseInt(pair, 16));

  if (body === checksumCase(tagFor(form, network), lower)) return { ok: true, payload };
  const other = NETWORKS.find((candidate) => candidate !== network && body === checksumCase(tagFor(form, candidate), lower));
  if (other) return fail(form.wrongNetwork, `checksum is valid for ${other}, not ${network}`, other);
  if (body === lower || body === body.toUpperCase()) {
    return fail(form.nonCanonical, "hex has no checksum casing; use the mixed-case form");
  }
  return fail(form.malformed, "checksum casing does not verify");
}
