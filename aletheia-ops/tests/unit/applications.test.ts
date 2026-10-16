import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { PortalApplications } from "@/adapters/applications/portal-applications";
import { MemoryStore } from "@/adapters/memory/memory-store";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABEL, type Application } from "@/domain/applications";
import { can, type Actor, type Role } from "@/policy/roles";
import { ensureAuditHead, verifyChain } from "@/services/audit";
import { changeApplicationStatus, downloadCv } from "@/services/applications/applications";
import { Refused } from "@/services/identity/identity";

// Applications on aletheiagov.org (ADR 0011): one list of statuses in both places, the
// permissions, the signed client, and the workbench's own audit of changes and downloads.

const SECRET = "s".repeat(40);
const ID = "0b4a6c1e-8f2d-4a3b-9c5e-7d1f2a3b4c5d";
const actor = (role: Role): Actor => ({ id: ID, state: "active", mfa: true, grants: [{ role, institution: "*", clearance: "confidential" }] });

const application: Application = {
  _rev: 3,
  reference: "AGV-EOI-2026-0001",
  submittedAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  retainUntil: "2027-10-16T10:00:00.000Z",
  positionTypes: ["volunteer"],
  opportunities: [{ reference: "AGV-OPP-2026-0001", appliedAt: "2026-10-16T10:00:00.000Z" }],
  institutions: ["founding-government"],
  expertise: ["Maritime affairs"],
  status: "new",
  statusHistory: [],
  cvs: [],
  name: "Ada Seasteader",
  email: "ada@example.org",
  notes: [],
};

/** A fake portal that checks signatures as aletheia-gov/src/server/publication/signature.ts does. */
function portal(behaviour: (method: string, pathWithQuery: string, body: string) => Response) {
  const calls: { method: string; path: string; body: string }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname + u.search;
    const body = (init.body as string | undefined) ?? "";
    const headers = init.headers as Record<string, string>;
    const m = /^AGV-HMAC keyId=(\S+), ts=(\d+), sig=([0-9a-f]{64})$/.exec(headers.Authorization ?? "");
    const expected = m && createHmac("sha256", SECRET).update(`${init.method}\n${path}\n${m[2]}\n${createHash("sha256").update(body).digest("hex")}`).digest("hex");
    calls.push({ method: init.method!, path, body });
    if (!m || m[1] !== "ops-1" || m[3] !== expected) return new Response(JSON.stringify({ error: "signature does not match" }), { status: 401 });
    return behaviour(init.method!, path, body);
  }) as unknown as typeof fetch;
  return { fake, calls };
}
const client = (f: typeof fetch) => new PortalApplications({ base: "https://portal.test", keyId: "ops-1", secret: SECRET, fetch: f });

describe("statuses", () => {
  it("are the portal's list, in the portal's words (aletheia-gov src/lib/application-status.ts)", () => {
    expect(APPLICATION_STATUSES).toEqual(["new", "contacted", "shortlisted", "offered", "appointed", "not_progressed", "archived"]);
    expect(APPLICATION_STATUS_LABEL.new).toBe("Received");
    expect(APPLICATION_STATUS_LABEL.not_progressed).toBe("Not progressed");
  });
});

describe("who may see and change applications", () => {
  it("founders and government administrators; nobody else", () => {
    for (const r of ["founder", "government_administrator"] as const) {
      expect(can(actor(r), "application.read")).toBe(true);
      expect(can(actor(r), "application.update")).toBe(true);
    }
    for (const r of ["author", "reviewer", "approving_officer", "publishing_officer", "auditor", "system_administrator", "institutional_administrator"] as const) {
      expect(can(actor(r), "application.read")).toBe(false);
      expect(can(actor(r), "application.update")).toBe(false);
    }
  });
});

describe("the signed client", () => {
  it("signs the path with its query, and names the official", async () => {
    const { fake, calls } = portal(() => Response.json({ rows: [application], total: 1, hasMore: false }));
    const r = await client(fake).list(ID, { status: "new", opportunity: "AGV-OPP-2026-0001", page: 1 });
    expect(r).toEqual({ rows: [application], total: 1, hasMore: false });
    expect(calls[0]!.path).toBe(`/api/applications?status=new&opportunity=AGV-OPP-2026-0001&page=1&actor=${ID}`);
  });

  it("sends a status change with the revision, and reports a conflict as such", async () => {
    const { fake, calls } = portal(() => Response.json({ error: "Someone else changed this application since you opened it." }, { status: 409 }));
    const r = await client(fake).setStatus({ id: ID, name: "Ada Founder" }, "AGV-EOI-2026-0001", "shortlisted", 3);
    expect(r).toEqual({ conflict: "Someone else changed this application since you opened it." });
    expect(calls[0]!.path).toBe("/api/applications/AGV-EOI-2026-0001/status");
    expect(JSON.parse(calls[0]!.body)).toEqual({ status: "shortlisted", expectedRev: 3, actor: { id: ID, name: "Ada Founder" } });
  });

  it("says plainly when the portal cannot be reached or refuses", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await client(down).get(ID, "AGV-EOI-2026-0001")).toEqual({ unavailable: "aletheiagov.org could not be reached" });
    const wrongKey = new PortalApplications({ base: "https://portal.test", keyId: "ops-1", secret: "x".repeat(40), fetch: portal(() => Response.json({})).fake });
    expect(await wrongKey.get(ID, "AGV-EOI-2026-0001")).toEqual({ unavailable: "aletheiagov.org refused the request (signature does not match)" });
  });

  it("treats an unknown application as absent", async () => {
    const { fake } = portal(() => Response.json({ error: "no such application" }, { status: 404 }));
    expect(await client(fake).get(ID, "AGV-EOI-2026-0009")).toBeNull();
  });
});

describe("the workbench's own record", () => {
  let store: MemoryStore;
  const uow = () => ({ store, now: () => new Date("2026-10-16T12:00:00Z"), correlationId: "c0ffee00-0000-4000-8000-000000000000" });
  beforeEach(async () => {
    store = new MemoryStore();
    await ensureAuditHead(store);
  });

  it("records a status change made through the portal, in the audit chain", async () => {
    const { fake } = portal(() => Response.json({ ...application, status: "shortlisted", _rev: 4 }));
    await changeApplicationStatus(uow(), client(fake), actor("government_administrator"), "Gia Admin", { reference: "AGV-EOI-2026-0001", status: "shortlisted", expectedRev: 3, from: "new" });
    const events = (await store.find<{ action: string; details?: Record<string, unknown> }>("audit_events", {}, { limit: 10 })).documents;
    expect(events.map((e) => e.action)).toEqual(["application.status"]);
    expect(events[0]!.details).toEqual({ from: "new", to: "shortlisted" });
    expect((await verifyChain(store)).ok).toBe(true);
  });

  it("refuses an official without the permission before asking the portal", async () => {
    const { fake, calls } = portal(() => Response.json(application));
    await expect(changeApplicationStatus(uow(), client(fake), actor("author"), "Tobias", { reference: "AGV-EOI-2026-0001", status: "shortlisted", expectedRev: 3, from: "new" })).rejects.toBeInstanceOf(Refused);
    expect(await downloadCv(uow(), client(fake), actor("author"), "AGV-EOI-2026-0001", "a".repeat(32))).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("records nothing when the portal refuses the change", async () => {
    const { fake } = portal(() => Response.json({ error: "stale" }, { status: 409 }));
    await expect(changeApplicationStatus(uow(), client(fake), actor("founder"), "Ada", { reference: "AGV-EOI-2026-0001", status: "offered", expectedRev: 1, from: "new" })).rejects.toThrow("stale");
    expect((await store.find("audit_events", {}, { limit: 10 })).documents).toHaveLength(0);
  });
});
