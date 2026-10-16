import type { Application, ApplicationStatus } from "@/domain/applications";
import { portalAuthorization } from "@/adapters/publication/portal-gateway";
import type { ApplicationsGateway, Unavailable } from "@/ports/applications";

// Applications held on aletheiagov.org (ADR 0011), through the portal's signed API:
//   GET  /api/applications?status=&opportunity=&page=&actor=
//   GET  /api/applications/{reference}?actor=
//   POST /api/applications/{reference}/status      { status, expectedRev, actor: { id, name } }
//   GET  /api/applications/{reference}/cv/{fileId}?actor=
// The same keys and signature as publication. The portal records every read and change in its
// audit log against the official, and is the only place an application is stored.

type Fetch = typeof fetch;

export class PortalApplications implements ApplicationsGateway {
  private readonly base: string;
  private readonly keyId: string;
  private readonly secret: string;
  private readonly fetchImpl: Fetch;

  constructor(opts: { base: string; keyId: string; secret: string; fetch?: Fetch }) {
    this.base = opts.base.replace(/\/$/, "");
    this.keyId = opts.keyId;
    this.secret = opts.secret;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async call(method: "GET" | "POST", path: string, body = ""): Promise<Response | Unavailable> {
    try {
      return await this.fetchImpl(this.base + path, {
        method,
        headers: { Authorization: portalAuthorization(this.keyId, this.secret, method, path, body), ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        body: method === "POST" ? body : undefined,
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
        cache: "no-store",
      });
    } catch (e) {
      return { unavailable: (e as Error).name === "TimeoutError" ? "aletheiagov.org did not answer in time" : "aletheiagov.org could not be reached" };
    }
  }

  private static async failure(res: Response): Promise<Unavailable> {
    const json = (await res.json().catch(() => ({}))) as { error?: unknown };
    return { unavailable: `aletheiagov.org refused the request (${typeof json.error === "string" ? json.error : `HTTP ${res.status}`})` };
  }

  async list(actorId: string, filter: { status?: ApplicationStatus; opportunity?: string; page: number }) {
    const q = new URLSearchParams({ ...(filter.status && { status: filter.status }), ...(filter.opportunity && { opportunity: filter.opportunity }), page: String(filter.page), actor: actorId });
    const res = await this.call("GET", `/api/applications?${q}`);
    if ("unavailable" in res) return res;
    if (!res.ok) return PortalApplications.failure(res);
    return (await res.json()) as { rows: Application[]; total: number; hasMore: boolean };
  }

  async get(actorId: string, reference: string) {
    const res = await this.call("GET", `/api/applications/${encodeURIComponent(reference)}?actor=${encodeURIComponent(actorId)}`);
    if ("unavailable" in res) return res;
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) return PortalApplications.failure(res);
    return (await res.json()) as Application;
  }

  async setStatus(actor: { id: string; name: string }, reference: string, status: ApplicationStatus, expectedRev: number) {
    const res = await this.call("POST", `/api/applications/${encodeURIComponent(reference)}/status`, JSON.stringify({ status, expectedRev, actor }));
    if ("unavailable" in res) return res;
    if (res.status === 409) return { conflict: String(((await res.json().catch(() => ({}))) as { error?: unknown }).error ?? "Someone else changed this application. Reload and try again.") };
    if (!res.ok) return PortalApplications.failure(res);
    return { ok: (await res.json()) as Application };
  }

  async cv(actorId: string, reference: string, fileId: string) {
    const res = await this.call("GET", `/api/applications/${encodeURIComponent(reference)}/cv/${encodeURIComponent(fileId)}?actor=${encodeURIComponent(actorId)}`);
    if ("unavailable" in res) return res;
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) return PortalApplications.failure(res);
    return Buffer.from(await res.arrayBuffer());
  }
}
