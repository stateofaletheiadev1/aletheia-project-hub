// The Explorer's single search field (spec 41A.9). It recognises, without a mode switch:
// heights (with or without grouping), AL: addresses, AL:T transaction ids, AL:B block ids,
// 64-character hashes, AANs (MOD-97 checked before any request), UETRs, and "epoch N".
// Everything is decided locally; nothing is sent until the input is known to be well formed.
//
// Messages are the reader-facing sentences. They are English here; the app routes them
// through the ICU message files with the same keys (41A.10).

import { parseIdentifier, type IdentifierKind, type NetworkKind } from "../encoding/identifiers.ts";

export type SearchTarget =
  | { readonly kind: "height"; readonly height: bigint }
  | { readonly kind: "epoch"; readonly epoch: bigint }
  | { readonly kind: IdentifierKind; readonly canonical: string }
  | { readonly kind: "hash"; readonly hex: string }
  | { readonly kind: "aan"; readonly electronic: string }
  | { readonly kind: "uetr"; readonly uetr: string }
  | { readonly kind: "refused"; readonly key: string; readonly message: string };

const U64_MAX = (1n << 64n) - 1n;

function refused(key: string, message: string): SearchTarget {
  return { kind: "refused", key, message };
}

/** Digits with optional locale grouping: commas, dots, spaces, thin or narrow no-break spaces. */
function parseGroupedInteger(text: string): bigint | null {
  if (!/^\d{1,3}([,.   ]\d{3})*$|^\d+$/.test(text)) return null;
  const value = BigInt(text.replace(/[,.   ]/g, ""));
  return value <= U64_MAX ? value : null;
}

/** ISO 7064 MOD 97-10 over the rearranged AAN, as in crates/apn/src/aan.rs (40B.3.1). */
function aanCheck(electronic: string): number {
  const rearranged = electronic.slice(5) + electronic.slice(0, 5);
  let remainder = 0;
  for (const character of rearranged) {
    remainder = /\d/.test(character)
      ? (remainder * 10 + Number(character)) % 97
      : (remainder * 100 + character.charCodeAt(0) - 55) % 97;
  }
  return remainder;
}

const IDENTIFIER_MESSAGES: Record<string, string> = {
  ADDR_WRONG_NETWORK: "This address belongs to a different Aletheia network",
  ID_WRONG_NETWORK: "This identifier belongs to a different Aletheia network",
  ADDR_NON_CANONICAL: "Aletheia addresses are written with an uppercase AL: and lowercase letters after it.",
  ID_NON_CANONICAL: "Aletheia identifiers are written with an uppercase prefix and lowercase letters after it.",
};

export function classify(input: string, network: NetworkKind): SearchTarget {
  const text = input.trim();
  if (text === "") return refused("search.empty", "Type a height, address, transaction, block, hash, AAN or UETR.");

  if (/^0x/i.test(text)) {
    return refused(
      "search.prefixed-hex",
      "Aletheia does not use the 0x prefix. Hashes are 64 lowercase hex characters; addresses start with AL:.",
    );
  }

  const epoch = /^epoch\s+(.+)$/i.exec(text);
  if (epoch) {
    const value = parseGroupedInteger(epoch[1] ?? "");
    return value === null
      ? refused("search.epoch-invalid", `"${epoch[1]}" is not an epoch number.`)
      : { kind: "epoch", epoch: value };
  }

  const height = parseGroupedInteger(text);
  if (height !== null) return { kind: "height", height };

  if (/^al:/i.test(text)) {
    const kind: IdentifierKind = /^AL:T/.test(text) && text.length === 62 ? "transaction"
      : /^AL:B/.test(text) && text.length === 62 ? "block"
      : "address";
    const parsed = parseIdentifier(kind, text, network);
    if (parsed.ok) return { kind, canonical: text };
    const known = IDENTIFIER_MESSAGES[parsed.error];
    const message = known
      ? parsed.otherNetwork
        ? `${known} (${parsed.otherNetwork}); this Explorer shows ${network}.`
        : known
      : `This is not a valid Aletheia ${kind === "address" ? "address" : `${kind} id`}: the ${parsed.reason}. Check that it was copied in full.`;
    return refused(`search.${parsed.error.toLowerCase()}`, message);
  }

  const compactAan = text.replace(/[  ]/g, "");
  if (/^ALX\d+$/i.test(compactAan)) {
    const electronic = compactAan.toUpperCase();
    if (electronic.length !== 21) {
      return refused("search.aan-length", `An AAN is ALX followed by 18 digits; this one has ${electronic.length - 3}.`);
    }
    if (aanCheck(electronic) !== 1) {
      return refused(
        "search.aan-check-digits",
        "This AAN's check digits don't match. Two neighbouring digits may be swapped.",
      );
    }
    return { kind: "aan", electronic };
  }

  if (/^[0-9a-f]{64}$/.test(text)) return { kind: "hash", hex: text };
  if (/^[0-9a-fA-F]{64}$/.test(text)) {
    return refused("search.uppercase-hex", "Aletheia writes hashes in lowercase. Enter this hash in lowercase to search for it.");
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    // The UETR is hashed in the browser before lookup; it never leaves the device (41A.8).
    return { kind: "uetr", uetr: text.toLowerCase() };
  }

  return refused("search.unrecognised", "Nothing on the chain has this form. Heights, addresses (AL:), transactions (AL:T), blocks (AL:B), hashes, AANs and UETRs are searchable.");
}
