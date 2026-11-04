// Base16 as the node writes it (spec 12.2, ADR-021): lowercase, no `0x`, even length.

const DIGITS = "0123456789abcdef";

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += DIGITS[byte >> 4]! + DIGITS[byte & 15]!;
  return out;
}

export class HexError extends Error {
  override name = "HexError";
}

/** Parses unprefixed base16 of either case. `0x` is refused, as the node refuses it. */
export function fromHex(text: string): Uint8Array {
  if (text.length % 2 !== 0) throw new HexError("hex has an odd number of digits");
  if (/^0x/i.test(text)) throw new HexError("hex must not carry a 0x prefix");
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) {
    const high = parseNibble(text.charCodeAt(i * 2));
    const low = parseNibble(text.charCodeAt(i * 2 + 1));
    if (high < 0 || low < 0) throw new HexError(`not a hex digit at position ${i * 2}`);
    out[i] = (high << 4) | low;
  }
  return out;
}

function parseNibble(code: number): number {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 102) return code - 87;
  if (code >= 65 && code <= 70) return code - 55;
  return -1;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
