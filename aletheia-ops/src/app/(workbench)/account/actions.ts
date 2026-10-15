"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/components/patterns/ActionForm";
import { StoreConflict } from "@/ports/store";
import { beginTwoStep, changePassword, confirmTwoStep, disableTwoStep, Refused, revokeSession, updatePreferences } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { deviceLabel, requireOfficial, setSessionCookie } from "@/server/session";

async function guarded(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const done = await fn();
    revalidatePath("/account");
    return { done };
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    if (e instanceof StoreConflict) return { error: "Your account changed at the same time in another window. Reload the page and try again." };
    throw e;
  }
}

export async function passwordAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "The two new passwords are different." };
  return guarded(async () => {
    const { sessionToken } = await changePassword(await requireDeps(), signedIn, current, next, await deviceLabel());
    await setSessionCookie(sessionToken);
    return "Password changed. You have been signed out everywhere else.";
  });
}

export async function preferencesAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  const p = z.object({ timezone: z.string().max(64), density: z.enum(["comfortable", "compact"]) }).safeParse({ timezone: form.get("timezone"), density: form.get("density") });
  if (!p.success) return { error: "Choose a timezone and a density." };
  return guarded(async () => {
    await updatePreferences(await requireDeps(), signedIn, p.data);
    return "Saved.";
  });
}

export async function endSessionAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  return guarded(async () => {
    await revokeSession(await requireDeps(), signedIn, String(form.get("session")));
    return "Session ended.";
  });
}

export async function beginTwoStepAction(): Promise<void> {
  const signedIn = await requireOfficial();
  await beginTwoStep(await requireDeps(), signedIn);
  redirect("/account/two-step");
}

export async function confirmTwoStepAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  try {
    const { sessionToken } = await confirmTwoStep(await requireDeps(), signedIn, String(form.get("code") ?? ""), await deviceLabel());
    await setSessionCookie(sessionToken);
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect("/account?two-step=on#two-step");
}

export async function disableTwoStepAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const signedIn = await requireOfficial();
  return guarded(async () => {
    await disableTwoStep(await requireDeps(), signedIn, String(form.get("password") ?? ""));
    return "Two-step sign-in is off. You will sign in with your password only.";
  });
}
