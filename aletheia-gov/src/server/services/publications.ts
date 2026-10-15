import "server-only";
import { env } from "@/lib/config/env";
import { database } from "@/server/aletheiadb/client";
import { parseKeys, verify } from "@/server/publication/signature";
import { lookup, publish, Rejected, Retry, validate } from "@/server/publication/publish";
import { audit } from "./audit";

// Publication from the operations workbench (aletheia-ops ADR 0003): the routes in
// app/api/publications call these, and only these touch the database.

export type Answer = { status: number; body: unknown };

export async function receivePublication(raw: string, authorization: string | null, idempotencyKey: string | null): Promise<Answer> {
  if (raw.length > 1_000_000) return { status: 413, body: { error: "too large" } };
  const verdict = verify(authorization, parseKeys(env().PUBLICATION_HMAC_KEYS), "POST", "/api/publications", raw, Math.floor(Date.now() / 1000));
  if (!verdict.ok) return { status: 401, body: { error: verdict.reason } };
  const key = idempotencyKey ?? "";
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(key)) return { status: 400, body: { error: "an Idempotency-Key header is required" } };
  const db = database();
  if (!db) return { status: 503, body: { error: "the public record database is not connected" } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "the body is not JSON" } };
  }
  try {
    const payload = validate(parsed);
    const { receipt, replayed } = await publish(db, payload, key, raw, verdict.keyId, env().APP_BASE_URL, new Date());
    if (!replayed) {
      await audit({ actorId: null, action: "publication.receive", target: { type: "record", id: receipt.reference }, outcome: "success", details: { keyId: verdict.keyId, contentHash: receipt.contentHash } });
    }
    return { status: replayed ? 200 : 201, body: receipt };
  } catch (e) {
    if (e instanceof Rejected) return { status: e.status, body: { error: e.message } };
    if (e instanceof Retry) return { status: 503, body: { error: "another write happened at the same time; ask again by idempotency key" } };
    console.error("publication failed:", (e as Error).message);
    return { status: 503, body: { error: "the publication could not be completed; ask again by idempotency key" } };
  }
}

export async function findPublication(key: string, authorization: string | null): Promise<Answer> {
  const path = `/api/publications/${encodeURIComponent(key)}`;
  const verdict = verify(authorization, parseKeys(env().PUBLICATION_HMAC_KEYS), "GET", path, "", Math.floor(Date.now() / 1000));
  if (!verdict.ok) return { status: 401, body: { error: verdict.reason } };
  const db = database();
  if (!db) return { status: 503, body: { error: "the public record database is not connected" } };
  const receipt = await lookup(db, key);
  return receipt ? { status: 200, body: receipt } : { status: 404, body: { error: "no publication with this key" } };
}
