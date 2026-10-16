import "server-only";
import { ConflictError } from "@aletheia/aletheiadb";
import { isApplicationStatus, type ApplicationStatus } from "@/lib/application-status";
import { database } from "@/server/aletheiadb/client";
import { env } from "@/lib/config/env";
import { parseKeys, verify } from "@/server/publication/signature";
import { audit } from "./audit";
import { readCv, registrations } from "./interest";
import { getRegistration, listRegistrations, type RegistrationRow } from "./workbench";

// Applications are kept here, on aletheiagov.org, and nowhere else. This site's staff area and
// the operations workbench both read and change the same records, so a status set in one place
// is the status everywhere. The workbench uses the signed routes under /api/applications.

export type StatusActor = { id: string; name: string; via: "portal" | "ops" };

export class StatusConflict extends Error {}

/** Changes an application's status, with its revision checked, and records who did it and where. */
export async function changeStatus(reference: string, status: string, expectedRev: number, actor: StatusActor): Promise<RegistrationRow> {
  if (!isApplicationStatus(status)) throw new Error("unknown status");
  const db = database();
  if (!db) throw new Error("the database is not connected");
  const reg = await registrations(db).findOne({ reference });
  if (!reg) throw new StatusConflict("This application no longer exists.");
  if (reg._rev !== expectedRev) throw new StatusConflict("Someone else changed this application since you opened it. Reload and try again.");
  const at = new Date().toISOString();
  try {
    await registrations(db).updateOne(reg._id, reg._rev, {
      $set: { status, updatedAt: at, statusHistory: [...(reg.statusHistory ?? []), { status, at, by: actor.id, byName: actor.name, via: actor.via }] },
    });
  } catch (e) {
    if (e instanceof ConflictError) throw new StatusConflict("Someone else changed this application at the same moment. Reload and try again.");
    throw e;
  }
  await audit({ actorId: `${actor.via}:${actor.id}`, action: "interest.status", target: { type: "interest", id: reference }, outcome: "success", details: { from: reg.status, to: status, via: actor.via } });
  return (await getRegistration(reference))!;
}

// ---------------------------------------------------------------- signed routes for the workbench

export type Answer = { status: number; body: unknown };

function signed(method: "GET" | "POST", pathWithQuery: string, raw: string, authorization: string | null): { ok: true } | Answer {
  const v = verify(authorization, parseKeys(env().PUBLICATION_HMAC_KEYS), method, pathWithQuery, raw, Math.floor(Date.now() / 1000));
  return v.ok ? { ok: true } : { status: 401, body: { error: v.reason } };
}

const REF = /^AGV-EOI-\d{4}-\d{4,}$/;
const ACTOR = /^[0-9a-f-]{36}$/;

export async function apiList(pathWithQuery: string, query: URLSearchParams, authorization: string | null): Promise<Answer> {
  const s = signed("GET", pathWithQuery, "", authorization);
  if ("status" in s) return s;
  const actor = query.get("actor") ?? "";
  if (!ACTOR.test(actor)) return { status: 400, body: { error: "bad request" } };
  if (!database()) return { status: 503, body: { error: "the database is not connected" } };
  const status = query.get("status") ?? "";
  const opportunity = query.get("opportunity") ?? "";
  const page = Math.max(1, Number(query.get("page")) || 1);
  const result = await listRegistrations({
    status: isApplicationStatus(status) ? status : undefined,
    opportunity: /^AGV-OPP-\d{4}-\d{4,}$/.test(opportunity) ? opportunity : undefined,
    page,
    pageSize: 50,
  });
  await audit({ actorId: `ops:${actor}`, action: "interest.list", target: null, outcome: "success", details: { status: status || "all", opportunity: opportunity || "all", page, rows: result.rows.length } });
  return { status: 200, body: result };
}

export async function apiGet(pathWithQuery: string, reference: string, actor: string | null, authorization: string | null): Promise<Answer> {
  const s = signed("GET", pathWithQuery, "", authorization);
  if ("status" in s) return s;
  if (!REF.test(reference) || !actor || !ACTOR.test(actor)) return { status: 400, body: { error: "bad request" } };
  const row = await getRegistration(reference);
  if (!row) return { status: 404, body: { error: "no such application" } };
  await audit({ actorId: `ops:${actor}`, action: "interest.view", target: { type: "interest", id: reference }, outcome: "success" });
  return { status: 200, body: row };
}

export async function apiSetStatus(pathWithQuery: string, reference: string, raw: string, authorization: string | null): Promise<Answer> {
  const s = signed("POST", pathWithQuery, raw, authorization);
  if ("status" in s) return s;
  let body: { status?: string; expectedRev?: number; actor?: { id?: string; name?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "the body is not JSON" } };
  }
  const name = String(body.actor?.name ?? "").slice(0, 120);
  if (!REF.test(reference) || !isApplicationStatus(String(body.status)) || !Number.isInteger(body.expectedRev) || !ACTOR.test(String(body.actor?.id)) || name.length < 2) {
    return { status: 400, body: { error: "bad request" } };
  }
  try {
    const row = await changeStatus(reference, body.status as ApplicationStatus, body.expectedRev!, { id: body.actor!.id!, name, via: "ops" });
    return { status: 200, body: row };
  } catch (e) {
    if (e instanceof StatusConflict) return { status: 409, body: { error: e.message } };
    throw e;
  }
}

export async function apiCv(pathWithQuery: string, reference: string, fileId: string, actor: string | null, authorization: string | null): Promise<{ status: number; bytes?: Buffer; error?: string }> {
  const s = signed("GET", pathWithQuery, "", authorization);
  if ("status" in s) return { status: s.status, error: "unauthorised" };
  if (!REF.test(reference) || !/^[0-9a-f]{32}$/.test(fileId) || !actor || !ACTOR.test(actor)) return { status: 400, error: "bad request" };
  const bytes = await readCv(reference, fileId);
  if (!bytes) return { status: 404, error: "not found" };
  await audit({ actorId: `ops:${actor}`, action: "cv.download", target: { type: "interest", id: reference }, outcome: "success", details: { fileId } });
  return { status: 200, bytes };
}
