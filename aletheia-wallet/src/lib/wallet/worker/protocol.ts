// The message protocol between the page and the wallet worker (wallet prompt 10.2). Requests
// carry an id; responses echo it. Nothing secret travels back except, on explicit request, the
// recovery words for the Certificate and re-verification screens.

import type { NetworkBinding } from "$lib/stablechain/network/domain";
import type { AccountRecord, Keystore } from "../keystore/keystore";

export type WalletRequest =
  | { op: "generate" }
  | { op: "discardPending" }
  | { op: "createFromPending"; password: string; network: NetworkBinding; name: string }
  | { op: "importWords"; words: string[]; password: string; network: NetworkBinding; name: string }
  | { op: "importKeystore"; file: unknown; password: string; network: NetworkBinding }
  | { op: "unlock"; keystore: Keystore; password: string; network: NetworkBinding }
  | { op: "addAccount"; name: string }
  | { op: "sign"; bodyHex: string; index: number; network: NetworkBinding }
  | { op: "revealWords"; keystore: Keystore; password: string }
  | { op: "changePassword"; keystore: Keystore; oldPassword: string; newPassword: string }
  | { op: "lock" };

export interface CreatedWallet {
  keystore: Keystore;
  accounts: AccountRecord[];
}

export interface WalletResponses {
  generate: { words: string[] };
  discardPending: Record<string, never>;
  createFromPending: CreatedWallet;
  importWords: CreatedWallet;
  importKeystore: CreatedWallet;
  unlock: { accounts: AccountRecord[]; hasWords: boolean };
  addAccount: { account: AccountRecord; keystore: Keystore | null };
  sign: { signedHex: string; txId: string; digest: string; publicKey: string };
  revealWords: { words: string[] };
  changePassword: { keystore: Keystore };
  lock: Record<string, never>;
}

export type WalletErrorKind =
  "wrong-password" | "unsupported" | "corrupt" | "invalid-words" | "locked" | "wrong-network" | "refused" | "internal";

export type WorkerMessage =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { kind: WalletErrorKind; message: string } };

export type RequestEnvelope = { id: number; request: WalletRequest };
