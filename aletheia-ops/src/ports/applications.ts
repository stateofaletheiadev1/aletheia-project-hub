// Applications on aletheiagov.org (ADR 0011). One adapter: signed requests to the portal.

import type { Application, ApplicationStatus } from "@/domain/applications";

export type Unavailable = { unavailable: string };

export interface ApplicationsGateway {
  list(actorId: string, filter: { status?: ApplicationStatus; opportunity?: string; page: number }): Promise<{ rows: Application[]; total: number; hasMore: boolean } | Unavailable>;
  get(actorId: string, reference: string): Promise<Application | null | Unavailable>;
  /** The portal checks the revision; a stale one is refused with `conflict`. */
  setStatus(actor: { id: string; name: string }, reference: string, status: ApplicationStatus, expectedRev: number): Promise<{ ok: Application } | { conflict: string } | Unavailable>;
  cv(actorId: string, reference: string, fileId: string): Promise<Buffer | null | Unavailable>;
}
