"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/patterns/ActionForm";
import { APPLICATION_STATUS_LABEL, isApplicationStatus } from "@/domain/applications";
import { changeApplicationStatus } from "@/services/applications/applications";
import { Refused } from "@/services/identity/identity";
import { applications, requireDeps } from "@/server/runtime";
import { requirePermission } from "@/server/session";

// Changing an application's status (ADR 0011). The change is made on aletheiagov.org, where the
// application is held, with the revision this page was drawn from; a stale page is refused.

export async function setStatusAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { official, actor } = await requirePermission("application.update");
  const reference = String(form.get("reference") ?? "");
  const status = String(form.get("status") ?? "");
  const from = String(form.get("from") ?? "");
  const expectedRev = Number(form.get("rev"));
  if (!/^AGV-EOI-\d{4}-\d{4,}$/.test(reference) || !isApplicationStatus(status) || !isApplicationStatus(from) || !Number.isInteger(expectedRev)) return { error: "Choose a status." };
  if (status === from) return { error: `It is already ${APPLICATION_STATUS_LABEL[status]}.` };
  const gw = applications();
  if (!gw) return { error: "The connection to aletheiagov.org is not configured here." };
  try {
    await changeApplicationStatus(await requireDeps(), gw, actor, official.name, { reference, status, expectedRev, from });
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  revalidatePath(`/applications/${reference}`);
  return { done: `Status set to ${APPLICATION_STATUS_LABEL[status]}, on aletheiagov.org as well.` };
}
