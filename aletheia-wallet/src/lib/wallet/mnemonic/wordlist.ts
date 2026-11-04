// The public BIP-39 English wordlist, for autocomplete on the main thread. Nothing secret here.

import { wordlist } from "@scure/bip39/wordlists/english.js";

export function isWord(word: string): boolean {
  return wordlist.includes(word.trim().toLowerCase());
}

/** Up to `limit` wordlist entries starting with `prefix`. */
export function suggest(prefix: string, limit = 6): string[] {
  const clean = prefix.trim().toLowerCase();
  if (clean.length < 1) return [];
  const out: string[] = [];
  for (const word of wordlist) {
    if (word.startsWith(clean)) {
      out.push(word);
      if (out.length === limit) break;
    }
  }
  return out;
}
