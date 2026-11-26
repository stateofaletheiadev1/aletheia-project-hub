import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// The fingerprint of a validator licence application reference, as AletheiaChain records it in
// the registration's metadata hash (aletheia-cli validator register --licence; node ADR-069).
// It must match the CLI's BLAKE3 derive_key exactly: never change the context.
const LICENCE_CONTEXT = "AletheiaChain 2026-11-26 validator licence v1";

export function licenceFingerprint(reference: string): string {
  return bytesToHex(blake3(utf8ToBytes(reference.trim().toUpperCase()), { context: utf8ToBytes(LICENCE_CONTEXT) }));
}
