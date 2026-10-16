// Applications (ADR 0011). They are held on aletheiagov.org; this service checks the official's
// permission, asks the portal, and records changes and downloads in the workbench's own audit
// register as well (the portal records them in its log, against the same official).

import type { ApplicationStatus } from "@/domain/applications";
import { can, type Actor } from "@/policy/roles";
import type { ApplicationsGateway } from "@/ports/applications";
import { audit, type UnitOfWork } from "../audit";
import { Refused } from "../identity/identity";

export async function changeApplicationStatus(
  uow: UnitOfWork,
  gw: ApplicationsGateway,
  actor: Actor,
  name: string,
  input: { reference: string; status: ApplicationStatus; expectedRev: number; from: ApplicationStatus },
): Promise<string> {
  if (!can(actor, "application.update")) throw new Refused("You may not change applications.");
  const r = await gw.setStatus({ id: actor.id, name }, input.reference, input.status, input.expectedRev);
  if ("unavailable" in r) throw new Refused(`The status was not changed: ${r.unavailable}.`);
  if ("conflict" in r) throw new Refused(r.conflict);
  await audit(uow, { actorId: actor.id, action: "application.status", target: { type: "application", id: input.reference }, details: { from: input.from, to: input.status } });
  return input.status;
}

export async function downloadCv(uow: UnitOfWork, gw: ApplicationsGateway, actor: Actor, reference: string, fileId: string): Promise<Buffer | null> {
  if (!can(actor, "application.read")) return null;
  const bytes = await gw.cv(actor.id, reference, fileId);
  if (!bytes || !Buffer.isBuffer(bytes)) return null;
  await audit(uow, { actorId: actor.id, action: "application.cv_download", target: { type: "application", id: reference }, details: { fileId } });
  return bytes;
}
