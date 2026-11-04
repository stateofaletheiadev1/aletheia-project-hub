// IndexedDB storage (wallet prompt 11.2). Holds only ciphertext and public records: the sealed
// keystore, transfers the wallet has seen (ids, addresses, amounts — all public on chain),
// contacts, and the follower's position. No plaintext secret is ever written here (N8).

import type { Keystore } from "$lib/wallet/keystore/keystore";

const NAME = "aletheia-wallet";
const VERSION = 1;

export interface ActivityRecord {
  readonly txId: string;
  readonly network: string;
  readonly direction: "out" | "in" | "self";
  readonly sender: string;
  readonly recipient: string;
  readonly asset: string;
  readonly amount: string;
  readonly fee: string | null;
  readonly feeAsset: string | null;
  readonly memo: string | null;
  readonly status: "submitted" | "finalized" | "failed-on-chain" | "expired" | "rejected";
  readonly errorName: string | null;
  readonly height: number | null;
  readonly expirySlot: number | null;
  /** Wall-clock time this wallet first saw it (submitted or observed), ms. */
  readonly seenAt: number;
  readonly finalizedAt: number | null;
}

export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly network: string;
  readonly note: string;
  readonly createdAt: number;
}

type Stores = {
  keystore: { key: string; value: Keystore };
  activity: { key: string; value: ActivityRecord };
  contacts: { key: string; value: Contact };
  meta: { key: string; value: unknown };
};

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keystore")) db.createObjectStore("keystore");
      if (!db.objectStoreNames.contains("activity")) db.createObjectStore("activity", { keyPath: "txId" });
      if (!db.objectStoreNames.contains("contacts")) db.createObjectStore("contacts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error("IndexedDB is unavailable"));
    };
  });
  return opening;
}

function run<T>(
  store: keyof Stores,
  mode: IDBTransactionMode,
  body: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = body(tx.objectStore(store));
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("storage transaction aborted"));
      }),
  );
}

export const db = {
  get<S extends keyof Stores>(store: S, key: string): Promise<Stores[S]["value"] | undefined> {
    return run(store, "readonly", (s) => s.get(key)) as Promise<Stores[S]["value"] | undefined>;
  },
  all<S extends keyof Stores>(store: S): Promise<Stores[S]["value"][]> {
    return run(store, "readonly", (s) => s.getAll()).then((rows) => (rows ?? []) as Stores[S]["value"][]);
  },
  put<S extends keyof Stores>(store: S, value: Stores[S]["value"], key?: string): Promise<void> {
    return run(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key))).then(() => undefined);
  },
  delete(store: keyof Stores, key: string): Promise<void> {
    return run(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
  },
  clear(store: keyof Stores): Promise<void> {
    return run(store, "readwrite", (s) => s.clear()).then(() => undefined);
  },
};

export const PRIMARY = "primary";

/** Whether a sealed keystore exists on this device (public pages use this; no wallet code). */
export async function hasStoredWallet(): Promise<boolean> {
  try {
    return (await db.get("keystore", PRIMARY)) !== undefined;
  } catch {
    return false;
  }
}
