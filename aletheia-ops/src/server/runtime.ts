import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { AletheiaDBStore } from "@/adapters/aletheiadb/aletheiadb-store";
import { env } from "@/lib/env";
import type { DocumentStore } from "@/ports/store";
import type { IdentityDeps } from "@/services/identity/identity";

// Wires services to the configured adapters for one request. Only the AletheiaDB adapter is
// ever used here; the in-memory store exists for tests and is never imported by app code.

let store: DocumentStore | null | undefined;

function configuredStore(): DocumentStore | null {
  if (store !== undefined) return store;
  const url = env().ALETHEIADB_URL;
  store = url ? new AletheiaDBStore(url) : null;
  return store;
}

/** True when the database and keys are configured; pages say so plainly when they are not. */
export function isConnected(): boolean {
  const e = env();
  return Boolean(e.ALETHEIADB_URL && e.DATA_ENCRYPTION_KEY && e.EMAIL_INDEX_KEY);
}

export async function correlationId(): Promise<string> {
  const h = await headers();
  const id = h.get("x-correlation-id");
  return id && /^[a-f0-9-]{36}$/.test(id) ? id : randomUUID();
}

/** Services' dependencies for this request, or null when the workbench is not connected. */
export async function deps(): Promise<IdentityDeps | null> {
  const s = configuredStore();
  const e = env();
  if (!s || !e.DATA_ENCRYPTION_KEY || !e.EMAIL_INDEX_KEY) return null;
  return {
    store: s,
    now: () => new Date(),
    correlationId: await correlationId(),
    keys: { data: Buffer.from(e.DATA_ENCRYPTION_KEY, "base64"), index: Buffer.from(e.EMAIL_INDEX_KEY, "base64") },
  };
}

export async function requireDeps(): Promise<IdentityDeps> {
  const d = await deps();
  if (!d) throw new Error("The workbench is not connected to its database.");
  return d;
}
