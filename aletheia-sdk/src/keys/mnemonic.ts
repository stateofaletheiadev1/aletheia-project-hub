// BIP-39 recovery phrases (spec Section 41 "BIP-39 mnemonic (optional)"; ADR-0002): 24 English
// words, empty passphrase, PBKDF2-HMAC-SHA512 seed fed to SLIP-0010. @scure/bip39 is audited.
// Runs only inside the wallet worker; the public wordlist helpers are in `wordlist.ts`.

import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  mnemonicToSeedSync,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const WORD_COUNT = 24;
const ENTROPY_BITS = 256;

export function newMnemonic(): string {
  return generateMnemonic(wordlist, ENTROPY_BITS);
}

export function normalizeWords(words: readonly string[]): string {
  return words.map((word) => word.trim().toLowerCase()).join(" ");
}

export type MnemonicProblem =
  { kind: "count"; count: number } | { kind: "unknown-word"; position: number } | { kind: "checksum" };

/** What is wrong with a phrase, or null when it is valid. */
export function mnemonicProblem(words: readonly string[]): MnemonicProblem | null {
  const clean = words.map((word) => word.trim().toLowerCase());
  if (![12, 15, 18, 21, 24].includes(clean.length)) return { kind: "count", count: clean.length };
  const unknown = clean.findIndex((word) => !wordlist.includes(word));
  if (unknown !== -1) return { kind: "unknown-word", position: unknown + 1 };
  return validateMnemonic(clean.join(" "), wordlist) ? null : { kind: "checksum" };
}

export function entropyOf(mnemonic: string): Uint8Array {
  return mnemonicToEntropy(mnemonic, wordlist);
}

export function mnemonicOf(entropy: Uint8Array): string {
  return entropyToMnemonic(entropy, wordlist);
}

/** The 64-byte BIP-39 seed (empty passphrase). Caller wipes it. */
export function seedOf(mnemonic: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic, "");
}
