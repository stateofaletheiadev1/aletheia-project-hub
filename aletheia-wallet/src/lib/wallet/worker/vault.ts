// The vault: everything the worker does with secrets, as plain functions over an explicit
// session object so it can be unit-tested outside a Worker. The worker entry only routes
// messages here. Secrets live in `session` while unlocked and are wiped on lock.

import { ed25519 } from "@noble/curves/ed25519.js";
import { fromHex, toHex } from "$lib/stablechain/encoding/hex";
import { ed25519Address } from "$lib/stablechain/addresses/derive";
import type { NetworkBinding } from "$lib/stablechain/network/domain";
import { parseNetworkKind } from "$lib/stablechain/network/kind";
import { accountSeed, pathText } from "../derivation/slip10";
import { entropyOf, mnemonicOf, mnemonicProblem, newMnemonic, normalizeWords, seedOf } from "../mnemonic/mnemonic";
import {
  KeystoreError,
  openSecret,
  parseKeystore,
  sealSecret,
  type AccountRecord,
  type Keystore,
  type KeystoreV2,
} from "../keystore/keystore";
import { signTransferWithKey, SigningError } from "../signing/sign";
import type { CreatedWallet, WalletErrorKind } from "./protocol";

export class VaultError extends Error {
  override name = "VaultError";
  constructor(
    readonly kind: WalletErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface Session {
  /** Entropy of a phrase shown on the Certificate but not yet sealed. */
  pending: Uint8Array | null;
  /** The SLIP-0010 master seed while unlocked (64 bytes for BIP-39, 32 for CLI keystores). */
  seed: Uint8Array | null;
  network: NetworkBinding | null;
  keystore: Keystore | null;
  accounts: AccountRecord[];
}

export function newSession(): Session {
  return { pending: null, seed: null, network: null, keystore: null, accounts: [] };
}

export function wipeSession(session: Session): void {
  session.pending?.fill(0);
  session.seed?.fill(0);
  session.pending = null;
  session.seed = null;
  session.network = null;
  session.keystore = null;
  session.accounts = [];
}

function describeAccount(seed: Uint8Array, index: number, network: NetworkBinding, name: string): AccountRecord {
  const key = accountSeed(seed, index);
  try {
    const publicKey = ed25519.getPublicKey(key);
    return {
      index,
      name,
      address: ed25519Address(network, publicKey),
      publicKey: toHex(publicKey),
      path: pathText(index),
    };
  } finally {
    key.fill(0);
  }
}

function seedFromEntropy(entropy: Uint8Array): Uint8Array {
  return seedOf(mnemonicOf(entropy));
}

async function sealEntropy(
  entropy: Uint8Array,
  password: string,
  network: NetworkBinding,
  accounts: AccountRecord[],
): Promise<KeystoreV2> {
  const sealed = await sealSecret(entropy, password);
  return {
    version: 2,
    secret: "bip39-entropy",
    network: network.kind,
    chainId: network.chainId,
    createdAt: new Date().toISOString(),
    ...sealed,
    accounts,
  };
}

export function generate(session: Session): { words: string[] } {
  session.pending?.fill(0);
  const phrase = newMnemonic();
  session.pending = entropyOf(phrase);
  return { words: phrase.split(" ") };
}

export function discardPending(session: Session): Record<string, never> {
  session.pending?.fill(0);
  session.pending = null;
  return {};
}

async function createFromEntropy(
  session: Session,
  entropy: Uint8Array,
  password: string,
  network: NetworkBinding,
  name: string,
): Promise<CreatedWallet> {
  const seed = seedFromEntropy(entropy);
  const accounts = [describeAccount(seed, 0, network, name)];
  const keystore = await sealEntropy(entropy, password, network, accounts);
  session.seed?.fill(0);
  Object.assign(session, { seed, network, keystore, accounts });
  return { keystore, accounts };
}

export async function createFromPending(
  session: Session,
  password: string,
  network: NetworkBinding,
  name: string,
): Promise<CreatedWallet> {
  if (!session.pending) throw new VaultError("refused", "there is no recovery phrase waiting to be sealed");
  const entropy = session.pending;
  session.pending = null;
  try {
    return await createFromEntropy(session, entropy, password, network, name);
  } finally {
    entropy.fill(0);
  }
}

export async function importWords(
  session: Session,
  words: string[],
  password: string,
  network: NetworkBinding,
  name: string,
): Promise<CreatedWallet> {
  const problem = mnemonicProblem(words);
  if (problem)
    throw new VaultError(
      "invalid-words",
      problem.kind === "checksum" ? "the phrase's checksum does not match" : "the phrase is not valid",
    );
  const entropy = entropyOf(normalizeWords(words));
  try {
    return await createFromEntropy(session, entropy, password, network, name);
  } finally {
    entropy.fill(0);
  }
}

function keystoreNetwork(keystore: Keystore): NetworkBinding | null {
  if (keystore.version === 2) {
    const kind = parseNetworkKind(keystore.network);
    return kind ? { chainId: keystore.chainId, kind } : null;
  }
  const kind = keystore.network ? parseNetworkKind(keystore.network) : null;
  return kind && typeof keystore.chainId === "number" ? { chainId: keystore.chainId, kind } : null;
}

function assertSameNetwork(keystore: Keystore, network: NetworkBinding): void {
  const own = keystoreNetwork(keystore);
  if (own && (own.chainId !== network.chainId || own.kind !== network.kind)) {
    throw new VaultError(
      "wrong-network",
      `this keystore was made for chain ${own.chainId} (${own.kind}); the wallet is on chain ${network.chainId} (${network.kind})`,
    );
  }
}

function keystoreFailure(error: unknown): never {
  if (error instanceof KeystoreError) throw new VaultError(error.kind, error.message);
  throw error;
}

/** Opens a keystore and checks that what it holds derives the addresses it shows in clear. */
async function open(
  keystore: Keystore,
  password: string,
  network: NetworkBinding,
): Promise<{ seed: Uint8Array; accounts: AccountRecord[] }> {
  assertSameNetwork(keystore, network);
  const { secret, kind } = await openSecret(keystore, password).catch(keystoreFailure);
  let seed: Uint8Array;
  if (kind === "bip39-entropy") {
    seed = seedFromEntropy(secret);
    secret.fill(0);
  } else {
    seed = secret;
  }
  const stored: AccountRecord[] =
    keystore.version === 2
      ? [...keystore.accounts]
      : [
          {
            index: 0,
            name: "Account 1",
            address: keystore.address,
            publicKey: keystore.publicKey ?? "",
            path: pathText(0),
          },
        ];
  const accounts = stored.map((record) => {
    const derived = describeAccount(seed, record.index, network, record.name);
    if (derived.address !== record.address) {
      seed.fill(0);
      throw new VaultError("corrupt", "the keystore's addresses do not match what it holds");
    }
    return derived;
  });
  return { seed, accounts };
}

export async function importKeystore(
  session: Session,
  file: unknown,
  password: string,
  network: NetworkBinding,
): Promise<CreatedWallet> {
  let keystore: Keystore;
  try {
    keystore = parseKeystore(file);
  } catch (error) {
    keystoreFailure(error);
  }
  if (keystore.version === 1 && !keystore.network) {
    throw new VaultError("unsupported", "this keystore does not say which network it belongs to");
  }
  const { seed, accounts } = await open(keystore, password, network);
  session.seed?.fill(0);
  Object.assign(session, { seed, network, keystore, accounts });
  return { keystore, accounts };
}

export async function unlock(session: Session, keystore: Keystore, password: string, network: NetworkBinding) {
  const { seed, accounts } = await open(keystore, password, network);
  session.seed?.fill(0);
  Object.assign(session, { seed, network, keystore, accounts });
  return { accounts, hasWords: keystore.version === 2 };
}

function requireUnlocked(session: Session): { seed: Uint8Array; network: NetworkBinding; keystore: Keystore } {
  if (!session.seed || !session.network || !session.keystore) throw new VaultError("locked", "the wallet is locked");
  return { seed: session.seed, network: session.network, keystore: session.keystore };
}

/** Derives the next index. A CLI (v1) keystore holds exactly one account. */
export function addAccount(session: Session, name: string): { account: AccountRecord; keystore: Keystore | null } {
  const { seed, network, keystore } = requireUnlocked(session);
  if (keystore.version !== 2)
    throw new VaultError("unsupported", "a keystore imported from the command line holds one account");
  const index = Math.max(-1, ...session.accounts.map((a) => a.index)) + 1;
  const account = describeAccount(seed, index, network, name);
  session.accounts = [...session.accounts, account];
  const updated: KeystoreV2 = { ...keystore, accounts: session.accounts };
  session.keystore = updated;
  return { account, keystore: updated };
}

export function sign(session: Session, bodyHex: string, index: number, network: NetworkBinding) {
  const { seed, network: own } = requireUnlocked(session);
  if (own.chainId !== network.chainId || own.kind !== network.kind)
    throw new VaultError("wrong-network", "the wallet was unlocked for another network");
  if (!session.accounts.some((a) => a.index === index)) throw new VaultError("refused", "no such account");
  const key = accountSeed(seed, index);
  try {
    const result = signTransferWithKey(fromHex(bodyHex), key, network);
    return { signedHex: toHex(result.signed), txId: result.txId, digest: result.digest, publicKey: result.publicKey };
  } catch (error) {
    if (error instanceof SigningError) throw new VaultError("refused", error.message);
    throw error;
  } finally {
    key.fill(0);
  }
}

export async function revealWords(keystore: Keystore, password: string): Promise<{ words: string[] }> {
  if (keystore.version !== 2)
    throw new VaultError("unsupported", "a keystore imported from the command line has no recovery phrase");
  const { secret } = await openSecret(keystore, password).catch(keystoreFailure);
  try {
    return { words: mnemonicOf(secret).split(" ") };
  } finally {
    secret.fill(0);
  }
}

/** Decrypt and re-encrypt with a fresh salt and nonce; the old file stays valid until replaced. */
export async function changePassword(
  keystore: Keystore,
  oldPassword: string,
  newPassword: string,
): Promise<{ keystore: Keystore }> {
  if (keystore.version !== 2) throw new VaultError("unsupported", "re-sealing is available for wallets created here");
  const { secret } = await openSecret(keystore, oldPassword).catch(keystoreFailure);
  try {
    const sealed = await sealSecret(secret, newPassword);
    return { keystore: { ...keystore, ...sealed } };
  } finally {
    secret.fill(0);
  }
}
