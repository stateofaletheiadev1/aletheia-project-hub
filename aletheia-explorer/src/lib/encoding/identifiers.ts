// Parsing of AL:, AL:T and AL:B identifiers in the browser (APS-0002, spec 41A.9, 41A.15).
//
// A port of crates/core/src/text_id.rs. It returns the same verdicts, by the same APS-0038
// error names, and the tests check it against the vectors the Rust node publishes in
// aletheia-node/tests/vectors/APS-0002. The search uses it to refuse an address whose
// checksum fails before any request is made, and never "corrects" one into another
// valid address.

export type NetworkKind = "mainnet" | "private-validation" | "devnet" | "regtest";

export const NETWORKS: readonly NetworkKind[] = ["mainnet", "private-validation", "devnet", "regtest"];

const ADDRESS_HRP: Record<NetworkKind, string> = {
  mainnet: "al",
  "private-validation": "alt",
  devnet: "ald",
  regtest: "alr",
};

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32M_CONST = 0x2bc830a3;
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const CHECKSUM_LEN = 6;
export const TEXT_LEN = 62;

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
    prefix: "AL:",
    hrpSuffix: "",
    payloadLen: 33,
    malformed: "ADDR_MALFORMED",
    wrongNetwork: "ADDR_WRONG_NETWORK",
    nonCanonical: "ADDR_NON_CANONICAL",
  },
  transaction: {
    prefix: "AL:T",
    hrpSuffix: "t",
    payloadLen: 32,
    malformed: "ID_MALFORMED",
    wrongNetwork: "ID_WRONG_NETWORK",
    nonCanonical: "ID_NON_CANONICAL",
  },
  block: {
    prefix: "AL:B",
    hrpSuffix: "b",
    payloadLen: 32,
    malformed: "ID_MALFORMED",
    wrongNetwork: "ID_WRONG_NETWORK",
    nonCanonical: "ID_NON_CANONICAL",
  },
};

/** Address types active at protocol version 1 (APS-0002). Type 4 is reserved. */
const ACTIVE_ADDRESS_TYPES = new Set([0, 1, 2, 3]);

export type ParseResult =
  | { readonly ok: true; readonly payload: Uint8Array }
  | { readonly ok: false; readonly error: string; readonly reason: string; readonly otherNetwork?: NetworkKind };

function polymod(values: Iterable<number>): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = (((checksum & 0x1ffffff) << 5) ^ value) >>> 0;
    for (let bit = 0; bit < 5; bit++) {
      if ((top >>> bit) & 1) checksum = (checksum ^ GENERATOR[bit]) >>> 0;
    }
  }
  return checksum;
}

function expandHrp(hrp: string): number[] {
  const codes = [...hrp].map((c) => c.charCodeAt(0));
  return [...codes.map((c) => c >> 5), 0, ...codes.map((c) => c & 31)];
}

function verifyChecksum(hrp: string, values: readonly number[]): boolean {
  return polymod([...expandHrp(hrp), ...values]) === BECH32M_CONST;
}

function checksum(hrp: string, data: readonly number[]): number[] {
  const residue = (polymod([...expandHrp(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ BECH32M_CONST) >>> 0;
  return Array.from({ length: CHECKSUM_LEN }, (_, i) => (residue >>> (5 * (CHECKSUM_LEN - 1 - i))) & 31);
}

function bytesToFives(bytes: Uint8Array): number[] {
  const out: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const byte of bytes) {
    accumulator = ((accumulator << 8) | byte) & 0x1fff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push((accumulator >> bits) & 31);
    }
  }
  if (bits > 0) out.push((accumulator << (5 - bits)) & 31);
  return out;
}

function fivesToBytes(fives: readonly number[]): Uint8Array | null {
  const out: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const value of fives) {
    accumulator = ((accumulator << 5) | value) & 0x1fff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((accumulator >> bits) & 0xff);
    }
  }
  if (bits >= 5 || ((accumulator << (8 - bits)) & 0xff) !== 0) return null;
  return Uint8Array.from(out);
}

function hrpFor(form: Form, network: NetworkKind): string {
  return ADDRESS_HRP[network] + form.hrpSuffix;
}

export function renderIdentifier(kind: IdentifierKind, network: NetworkKind, payload: Uint8Array): string {
  const form = FORMS[kind];
  const data = bytesToFives(payload);
  const check = checksum(hrpFor(form, network), data);
  return form.prefix + [...data, ...check].map((v) => CHARSET[v]).join("");
}

export function parseIdentifier(kind: IdentifierKind, text: string, network: NetworkKind): ParseResult {
  const form = FORMS[kind];
  const fail = (error: string, reason: string, otherNetwork?: NetworkKind): ParseResult =>
    otherNetwork ? { ok: false, error, reason, otherNetwork } : { ok: false, error, reason };

  if (text.length !== TEXT_LEN) {
    return fail(form.malformed, `length ${text.length} (canonical length is ${TEXT_LEN})`);
  }
  const prefix = text.slice(0, form.prefix.length);
  if (prefix !== form.prefix) {
    const caseOnly = prefix.toUpperCase() === form.prefix;
    return fail(caseOnly ? form.nonCanonical : form.malformed, `does not start with '${form.prefix}'`);
  }

  const body = text.slice(form.prefix.length);
  const values: number[] = [];
  let hasUppercase = false;
  for (const character of body) {
    const lowered = character.toLowerCase();
    if (lowered !== character) hasUppercase = true;
    const value = CHARSET.indexOf(lowered);
    if (value < 0 || lowered.length !== 1) {
      return fail(form.malformed, `'${character}' is not a Bech32 character`);
    }
    values.push(value);
  }
  if (hasUppercase) return fail(form.nonCanonical, "contains uppercase data characters");

  if (!verifyChecksum(hrpFor(form, network), values)) {
    const other = NETWORKS.find((kind2) => kind2 !== network && verifyChecksum(hrpFor(form, kind2), values));
    return other
      ? fail(form.wrongNetwork, `checksum is valid for ${other}, not ${network}`, other)
      : fail(form.malformed, "checksum does not verify");
  }

  const payload = fivesToBytes(values.slice(0, values.length - CHECKSUM_LEN));
  if (payload === null) return fail(form.nonCanonical, "padding bits are not zero");
  if (payload.length !== form.payloadLen) {
    return fail(form.malformed, `payload is ${payload.length} bytes, expected ${form.payloadLen}`);
  }
  if (kind === "address" && !ACTIVE_ADDRESS_TYPES.has(payload[0])) {
    return fail(form.malformed, `address type ${payload[0]} is not active`);
  }
  return { ok: true, payload };
}
