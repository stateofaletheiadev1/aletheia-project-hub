// The encrypted keystore (spec Section 41; `crates/wallet/src/keystore.rs`; ADR-0002).
// A 32-byte secret sealed with XChaCha20-Poly1305 under a key from Argon2id(password, salt).
// A wrong password or any change fails the tag; nothing is ever partly decrypted.
//
//   v1 (aletheia-cli): secret = SLIP-0010 seed, address in clear. Opened for use; never written.
//   v2 (this wallet):  secret = BIP-39 entropy, so the phrase can be re-verified; public account
//                      metadata in clear for showing addresses while locked.
//
// Runs only inside the wallet worker.

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { argon2id } from "hash-wasm";
import { fromHex, toHex } from "$lib/stablechain/encoding/hex";
import type { NetworkKind } from "$lib/stablechain/network/kind";

/** Argon2id cost, identical to the node's wallet crate: 64 MiB, 3 passes, 1 lane. */
export const KDF = { memoryKib: 64 * 1024, passes: 3, lanes: 1 } as const;

export type SecretKind = "bip39-entropy" | "slip10-seed";

export interface KdfParams {
  readonly name: "argon2id";
  readonly memoryKib: number;
  readonly passes: number;
  readonly lanes: number;
  readonly salt: string;
}

export interface CipherParams {
  readonly name: "xchacha20poly1305";
  readonly nonce: string;
  readonly ciphertext: string;
}

/** Public facts about one derived account; never anything secret. */
export interface AccountRecord {
  readonly index: number;
  readonly name: string;
  readonly address: string;
  readonly publicKey: string;
  readonly path: string;
}

export interface KeystoreV2 {
  readonly version: 2;
  readonly secret: "bip39-entropy";
  readonly network: NetworkKind;
  readonly chainId: number;
  readonly createdAt: string;
  readonly kdf: KdfParams;
  readonly cipher: CipherParams;
  readonly accounts: readonly AccountRecord[];
}

/** The CLI's file. Fields after `cipher` were added by `keys new` and may be absent. */
export interface KeystoreV1 {
  readonly version: 1;
  readonly address: string;
  readonly kdf: KdfParams;
  readonly cipher: CipherParams;
  readonly network?: string;
  readonly chainId?: number;
  readonly publicKey?: string;
  readonly path?: string;
}

export type Keystore = KeystoreV1 | KeystoreV2;

export class KeystoreError extends Error {
  override name = "KeystoreError";
  constructor(
    readonly kind: "wrong-password" | "unsupported" | "corrupt",
    message: string,
  ) {
    super(message);
  }
}

const encoder = new TextEncoder();

async function deriveKey(
  password: string,
  salt: Uint8Array,
  params: { memoryKib: number; passes: number; lanes: number },
) {
  const passwordBytes = encoder.encode(password);
  try {
    return await argon2id({
      password: passwordBytes,
      salt,
      parallelism: params.lanes,
      iterations: params.passes,
      memorySize: params.memoryKib,
      hashLength: 32,
      outputType: "binary",
    });
  } finally {
    passwordBytes.fill(0);
  }
}

function random(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function sealSecret(
  secret: Uint8Array,
  password: string,
): Promise<{ kdf: KdfParams; cipher: CipherParams }> {
  if (secret.length !== 32) throw new KeystoreError("unsupported", "the sealed secret is 32 bytes");
  const salt = random(16);
  const nonce = random(24);
  const key = await deriveKey(password, salt, KDF);
  try {
    const ciphertext = xchacha20poly1305(key, nonce).encrypt(secret);
    return {
      kdf: { name: "argon2id", ...KDF, salt: toHex(salt) },
      cipher: { name: "xchacha20poly1305", nonce: toHex(nonce), ciphertext: toHex(ciphertext) },
    };
  } finally {
    key.fill(0);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Shape check of untrusted JSON (a file the user picked, or IndexedDB contents). */
export function parseKeystore(value: unknown): Keystore {
  const corrupt = (detail: string) => new KeystoreError("corrupt", `keystore ${detail}`);
  if (!isRecord(value)) throw corrupt("is not an object");
  const { kdf, cipher } = value;
  if (!isRecord(kdf) || !isRecord(cipher)) throw corrupt("is missing kdf or cipher");
  if (kdf.name !== "argon2id" || cipher.name !== "xchacha20poly1305") {
    throw new KeystoreError("unsupported", "keystore algorithms are not argon2id + xchacha20poly1305");
  }
  for (const field of ["memoryKib", "passes", "lanes"] as const) {
    const n = kdf[field];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 4 * 1024 * 1024)
      throw corrupt(`kdf.${field} is invalid`);
  }
  for (const [field, text] of [
    ["kdf.salt", kdf.salt],
    ["cipher.nonce", cipher.nonce],
    ["cipher.ciphertext", cipher.ciphertext],
  ] as const) {
    if (typeof text !== "string" || !/^[0-9a-f]*$/.test(text) || text.length % 2 !== 0)
      throw corrupt(`${field} is not hex`);
  }
  if ((cipher.nonce as string).length !== 48) throw corrupt("nonce is not 24 bytes");
  if (value.version === 1) {
    if (typeof value.address !== "string") throw corrupt("has no address");
    return value as unknown as KeystoreV1;
  }
  if (value.version === 2) {
    if (value.secret !== "bip39-entropy") throw new KeystoreError("unsupported", "unknown keystore secret kind");
    if (typeof value.network !== "string" || typeof value.chainId !== "number") throw corrupt("has no network");
    if (!Array.isArray(value.accounts)) throw corrupt("has no accounts");
    for (const account of value.accounts as unknown[]) {
      if (
        !isRecord(account) ||
        typeof account.index !== "number" ||
        typeof account.address !== "string" ||
        typeof account.publicKey !== "string" ||
        typeof account.name !== "string" ||
        typeof account.path !== "string"
      ) {
        throw corrupt("has a malformed account");
      }
    }
    return value as unknown as KeystoreV2;
  }
  throw new KeystoreError("unsupported", `keystore version ${String(value.version)} is not supported`);
}

/** Opens either version. Returns the 32-byte secret and what it is; the caller wipes it. */
export async function openSecret(
  keystore: Keystore,
  password: string,
): Promise<{ secret: Uint8Array; kind: SecretKind }> {
  const salt = fromHex(keystore.kdf.salt);
  const key = await deriveKey(password, salt, keystore.kdf);
  try {
    let plain: Uint8Array;
    try {
      plain = xchacha20poly1305(key, fromHex(keystore.cipher.nonce)).decrypt(fromHex(keystore.cipher.ciphertext));
    } catch {
      throw new KeystoreError("wrong-password", "wrong password, or the keystore was changed");
    }
    if (plain.length !== 32) {
      plain.fill(0);
      throw new KeystoreError("corrupt", "keystore holds the wrong length of key");
    }
    return { secret: plain, kind: keystore.version === 1 ? "slip10-seed" : "bip39-entropy" };
  } finally {
    key.fill(0);
  }
}
