// Payment URIs (spec Section 41; `crates/wallet/src/uri.rs`):
//   aletheia:<alt: address>?asset=AEY&amount=125.000000000000000000&memo=<percent-encoded>
// Strict: unknown parameters, repeated parameters, malformed escapes and amounts with more
// decimals than the asset has are refused. A recipient of another network is refused by its
// checksum; the caller gets the found network so it can explain.

import type { BaseUnits, CanonicalAddress } from "$lib/types/brand";
import { AmountError, formatAmount, parseAmount } from "$lib/formatting/amount";
import { ASSETS, parseAssetCode, type AssetCode } from "../assets/assets";
import { IdentifierError, parseAddress } from "../addresses/identifiers";
import type { NetworkKind } from "../network/kind";

export const URI_SCHEME = "aletheia:";
const MAX_MEMO_BYTES = 256;

export interface PaymentRequest {
  readonly recipient: CanonicalAddress;
  readonly asset: AssetCode;
  readonly amount: BaseUnits | null;
  readonly memo: string | null;
}

export class UriError extends Error {
  override name = "UriError";
  constructor(
    message: string,
    readonly foundNetwork: NetworkKind | null = null,
  ) {
    super(message);
  }
}

function percentEncode(text: string): string {
  let out = "";
  for (const byte of new TextEncoder().encode(text)) {
    const character = String.fromCharCode(byte);
    out += /[A-Za-z0-9\-._~]/.test(character) ? character : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

function percentDecode(text: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const character = text[i]!;
    if (character === "%") {
      const hex = text.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) throw new UriError("a malformed %-escape in the URI");
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      const code = character.charCodeAt(0);
      if (code > 0x7e || code < 0x21) throw new UriError("the URI contains a character that must be escaped");
      bytes.push(code);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    throw new UriError("the URI memo is not UTF-8");
  }
}

export function formatPaymentUri(request: PaymentRequest): string {
  let out = `${URI_SCHEME}${request.recipient}?asset=${request.asset}`;
  if (request.amount !== null) out += `&amount=${formatAmount(request.amount, ASSETS[request.asset].decimals)}`;
  if (request.memo !== null && request.memo !== "") out += `&memo=${percentEncode(request.memo)}`;
  return out;
}

export function parsePaymentUri(text: string, network: NetworkKind): PaymentRequest {
  if (!text.startsWith(URI_SCHEME)) throw new UriError('a payment URI starts with "aletheia:"');
  const rest = text.slice(URI_SCHEME.length);
  const question = rest.indexOf("?");
  const addressText = question === -1 ? rest : rest.slice(0, question);
  const query = question === -1 ? "" : rest.slice(question + 1);
  let recipient: CanonicalAddress;
  try {
    recipient = parseAddress(addressText, network);
  } catch (error) {
    if (error instanceof IdentifierError) throw new UriError(`recipient: ${error.message}`, error.foundNetwork);
    throw error;
  }
  const seen = new Set<string>();
  let asset: AssetCode = "AEY";
  let amountText: string | null = null;
  let memo: string | null = null;
  for (const pair of query.split("&").filter(Boolean)) {
    const equals = pair.indexOf("=");
    const key = equals === -1 ? pair : pair.slice(0, equals);
    const value = percentDecode(equals === -1 ? "" : pair.slice(equals + 1));
    if (seen.has(key)) throw new UriError(`the parameter "${key}" appears twice`);
    seen.add(key);
    switch (key) {
      case "asset": {
        const code = parseAssetCode(value);
        if (!code) throw new UriError(`"${value}" is not a native asset`);
        asset = code;
        break;
      }
      case "amount":
        amountText = value;
        break;
      case "memo":
        if (new TextEncoder().encode(value).length > MAX_MEMO_BYTES)
          throw new UriError("the memo is longer than 256 bytes");
        memo = value;
        break;
      default:
        throw new UriError(`unknown URI parameter "${key}"`);
    }
  }
  let amount: BaseUnits | null = null;
  if (amountText !== null) {
    try {
      amount = parseAmount(amountText, ASSETS[asset].decimals);
    } catch (error) {
      if (error instanceof AmountError) throw new UriError(`amount: ${error.message}`);
      throw error;
    }
  }
  return { recipient, asset, amount, memo };
}
