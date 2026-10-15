"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/patterns/ActionForm";
import { CLASSIFICATIONS } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { env } from "@/lib/env";
import { ROLES, type Grant } from "@/policy/roles";
import { StoreConflict } from "@/ports/store";
import { decideAccessChange, inviteOfficial, proposeAccessChange, Refused, revokeSession, setOfficialState } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

// Officials and access (brief §18.5). Every input is validated here with an explicit schema
// (no request body is spread into a model), and every decision is made again in the service.

const institutions = ["*", ...INSTITUTION_SEED.map((i) => i.slug)] as [string, ...string[]];
const GrantSchema = z.object({ role: z.enum(ROLES), institution: z.enum(institutions), clearance: z.enum(CLASSIFICATIONS) });

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const done = await fn();
    revalidatePath("/officials", "layout");
    return { done };
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    if (e instanceof StoreConflict) return { error: "Someone else changed this at the same time. Reload the page and try again." };
    throw e;
  }
}

export type InviteResult = ActionResult & { link?: string; name?: string };

export async function inviteAction(_prev: InviteResult, form: FormData): Promise<InviteResult> {
  const signedIn = await requireOfficial();
  const grants: Grant[] = [];
  for (let i = 0; i < 4; i++) {
    if (!form.get(`role-${i}`)) continue;
    const g = GrantSchema.safeParse({ role: form.get(`role-${i}`), institution: form.get(`institution-${i}`), clearance: form.get(`clearance-${i}`) });
    if (!g.success) return { error: `Role ${i + 1} is incomplete: choose a role, an institution and a clearance.` };
    grants.push(g.data);
  }
  const input = z.object({ name: z.string().max(120), email: z.string().max(254), reason: z.string().max(500) }).safeParse({ name: form.get("name"), email: form.get("email"), reason: form.get("reason") });
  if (!input.success) return { error: "Enter a name, an email address and a reason." };
  if (input.data.reason.trim().length < 3) return { error: "Give a reason for this invitation. It is recorded." };
  try {
    const d = await requireDeps();
    const { token, pending } = await inviteOfficial(d, signedIn.actor, { ...input.data, grants });
    revalidatePath("/officials", "layout");
    return {
      done: pending ? `Invitation created. ${pending === 1 ? "One privileged role waits" : `${pending} privileged roles wait`} for a second administrator.` : "Invitation created.",
      link: `${env().APP_BASE_URL}/invitation/${token}`,
      name: input.data.name,
    };
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
}

export async function proposeGrantAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  const g = GrantSchema.safeParse({ role: form.get("role"), institution: form.get("institution"), clearance: form.get("clearance") });
  if (!g.success) return { error: "Choose a role, an institution and a clearance." };
  const kind = form.get("kind") === "revoke_grant" ? "revoke_grant" : "grant";
  return run(async () => {
    const outcome = await proposeAccessChange(await requireDeps(), signedIn.actor, { kind, target: String(form.get("target")), grant: g.data }, String(form.get("reason") ?? ""));
    return outcome === "applied" ? "Done. The official must sign in again." : "Proposed. Another administrator must confirm it.";
  });
}

export async function decideAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  const decision = form.get("decision") === "reject" ? "reject" : "confirm";
  return run(async () => {
    await decideAccessChange(await requireDeps(), signedIn.actor, String(form.get("change")), decision, String(form.get("reason") ?? ""));
    return decision === "confirm" ? "Confirmed. It takes effect at the official's next sign-in." : "Rejected.";
  });
}

export async function stateAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  const state = z.enum(["active", "suspended", "revoked"]).safeParse(form.get("state"));
  if (!state.success) return { error: "Choose what to do." };
  return run(async () => {
    await setOfficialState(await requireDeps(), signedIn.actor, String(form.get("target")), state.data, String(form.get("reason") ?? ""));
    return state.data === "active" ? "Reinstated." : state.data === "suspended" ? "Suspended. Their sessions have ended." : "Access revoked. Their sessions have ended.";
  });
}

export async function revokeSessionAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  return run(async () => {
    await revokeSession(await requireDeps(), signedIn, String(form.get("session")));
    return "Session ended.";
  });
}
