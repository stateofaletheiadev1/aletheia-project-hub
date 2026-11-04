// The wallet session: whether a keystore exists, whether it is unlocked, and the public account
// list. Secrets stay in the worker; this holds only what the worker returns publicly. Locking
// terminates the worker (wallet prompt 11.3).

import { goto } from "$app/navigation";
import { watchIdle } from "$lib/security/idle";
import { loadThrottle, recordFailure, saveThrottle, waitRemaining } from "$lib/security/throttle";
import { db, PRIMARY } from "$lib/storage/db";
import type { AccountRecord, Keystore } from "$lib/wallet/keystore/keystore";
import { parseKeystore } from "$lib/wallet/keystore/keystore";
import { WalletWorker, WalletWorkerError } from "$lib/wallet/worker/client";
import type { CreatedWallet } from "$lib/wallet/worker/protocol";
import { config } from "$lib/config";
import type { CanonicalAddress } from "$lib/types/brand";
import { parseAddress } from "$lib/stablechain/addresses/identifiers";
import { prefs } from "./prefs.svelte";

export type Phase = "loading" | "empty" | "locked" | "unlocked";

const HIDDEN_LOCK_MS = 60_000;

class Session {
  phase = $state<Phase>("loading");
  /** Public account facts, available while locked from the keystore's clear metadata. */
  accounts = $state<AccountRecord[]>([]);
  hasWords = $state(false);
  keystoreVersion = $state<1 | 2 | null>(null);
  lockedReason = $state<"manual" | "idle" | "hidden" | null>(null);

  readonly worker = new WalletWorker();
  #keystore: Keystore | null = null;
  #stopIdle: (() => void) | null = null;

  get network() {
    return { chainId: config.chainId, kind: config.network };
  }

  get active(): AccountRecord | null {
    return this.accounts.find((a) => a.index === prefs.activeAccount) ?? this.accounts[0] ?? null;
  }

  get activeAddress(): CanonicalAddress | null {
    const account = this.active;
    return account ? parseAddress(account.address, config.network) : null;
  }

  async load(): Promise<void> {
    if (this.phase !== "loading") return;
    try {
      const stored = await db.get("keystore", PRIMARY);
      if (!stored) {
        this.phase = "empty";
        return;
      }
      const keystore = parseKeystore(stored);
      this.#adopt(keystore);
      this.phase = "locked";
    } catch {
      this.phase = "empty";
    }
  }

  #adopt(keystore: Keystore): void {
    this.#keystore = keystore;
    this.keystoreVersion = keystore.version;
    this.hasWords = keystore.version === 2;
    this.accounts =
      keystore.version === 2
        ? [...keystore.accounts]
        : [
            {
              index: 0,
              name: "Account 1",
              address: keystore.address,
              publicKey: keystore.publicKey ?? "",
              path: keystore.path ?? "m/44'/7771'/0'/0'/0'",
            },
          ];
  }

  async #persist(keystore: Keystore): Promise<void> {
    await db.put("keystore", keystore, PRIMARY);
    this.#adopt(keystore);
  }

  /** Remaining throttle wait in ms (0 when an attempt is allowed). */
  throttleWait(now = Date.now()): number {
    return waitRemaining(loadThrottle(), now);
  }

  async unlock(password: string): Promise<{ ok: true } | { ok: false; kind: string; message: string; waitMs: number }> {
    if (!this.#keystore)
      return { ok: false, kind: "corrupt", message: "No wallet is stored on this device.", waitMs: 0 };
    const wait = this.throttleWait();
    if (wait > 0) return { ok: false, kind: "throttled", message: "Too many attempts.", waitMs: wait };
    try {
      const result = await this.worker.request({
        op: "unlock",
        keystore: this.#keystore,
        password,
        network: this.network,
      });
      saveThrottle({ failures: 0, lockedUntil: 0 });
      this.accounts = result.accounts;
      this.hasWords = result.hasWords;
      this.#opened();
      return { ok: true };
    } catch (error) {
      const kind = error instanceof WalletWorkerError ? error.kind : "internal";
      if (kind === "wrong-password") {
        const next = recordFailure(loadThrottle(), Date.now());
        saveThrottle(next);
        return {
          ok: false,
          kind,
          message: "That password does not open this wallet.",
          waitMs: waitRemaining(next, Date.now()),
        };
      }
      await this.worker.terminate();
      return {
        ok: false,
        kind,
        message: error instanceof Error ? error.message : "The wallet could not be opened.",
        waitMs: 0,
      };
    }
  }

  async adoptCreated(created: CreatedWallet): Promise<void> {
    await this.#persist(created.keystore);
    this.accounts = created.accounts;
    prefs.activeAccount = created.accounts[0]?.index ?? 0;
    this.#opened();
  }

  #opened(): void {
    this.phase = "unlocked";
    this.lockedReason = null;
    this.#stopIdle?.();
    if (typeof window !== "undefined") {
      this.#stopIdle = watchIdle({
        idleMs: prefs.autoLockMinutes * 60_000,
        hiddenMs: HIDDEN_LOCK_MS,
        onLock: () => void this.lock("idle"),
      });
    }
  }

  /** Re-arms the idle timer after the auto-lock setting changes. */
  rearm(): void {
    if (this.phase === "unlocked") this.#opened();
  }

  async lock(reason: "manual" | "idle" | "hidden" = "manual"): Promise<void> {
    this.#stopIdle?.();
    this.#stopIdle = null;
    await this.worker.terminate();
    if (this.phase === "unlocked") {
      this.phase = this.#keystore ? "locked" : "empty";
      this.lockedReason = reason;
      if (this.#keystore?.version === 2) this.accounts = [...this.#keystore.accounts];
      await goto("/unlock");
    }
  }

  async addAccount(name: string): Promise<AccountRecord> {
    const { account, keystore } = await this.worker.request({ op: "addAccount", name });
    if (keystore) await this.#persist(keystore);
    this.accounts = [...this.accounts.filter((a) => a.index !== account.index), account];
    return account;
  }

  async renameAccount(index: number, name: string): Promise<void> {
    const keystore = this.#keystore;
    if (!keystore || keystore.version !== 2) return;
    const accounts = keystore.accounts.map((a) => (a.index === index ? { ...a, name } : a));
    await this.#persist({ ...keystore, accounts });
    this.accounts = this.accounts.map((a) => (a.index === index ? { ...a, name } : a));
  }

  async revealWords(password: string): Promise<string[]> {
    if (!this.#keystore) throw new WalletWorkerError("locked", "no wallet");
    return (await this.worker.request({ op: "revealWords", keystore: this.#keystore, password })).words;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.#keystore) throw new WalletWorkerError("locked", "no wallet");
    const { keystore } = await this.worker.request({
      op: "changePassword",
      keystore: this.#keystore,
      oldPassword,
      newPassword,
    });
    await this.#persist(keystore);
  }

  /** The sealed keystore file for an encrypted backup download. */
  exportKeystore(): string | null {
    return this.#keystore ? JSON.stringify(this.#keystore, null, 2) : null;
  }

  /** Removes the wallet from this device. The recovery phrase remains the wallet. */
  async forget(): Promise<void> {
    await this.worker.terminate();
    await db.delete("keystore", PRIMARY);
    await db.clear("activity");
    this.#keystore = null;
    this.accounts = [];
    this.keystoreVersion = null;
    this.phase = "empty";
  }
}

export const session = new Session();
