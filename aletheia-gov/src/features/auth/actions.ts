"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/server/auth/current-user";
import { passwordProblem } from "@/server/auth/password";
import { ABSOLUTE_SECONDS, cookieOptions, sealSession, SESSION_COOKIE, sessionsConfigured } from "@/server/auth/session";
import { masterKey } from "@/server/crypto/subject-keys";
import { clientKey, createLimiter } from "@/server/security/rate-limit";
import { audit } from "@/server/services/audit";
import { checkCredentials, getUser, newSessionId, revokeSession, setPassword, signOutEverywhere, verifyCurrentPassword } from "@/server/services/users";

// Sign-in limits (brief §14): per client address and per account. In memory (ADR 0004).
const perAddress = createLimiter({ limit: 20, windowMs: 60_000 });
const perAccount = createLimiter({ limit: 5, windowMs: 60_000 });

export type FormState = { error?: string; done?: string; email?: string };

const GENERIC = "The email or password is not right, or the account is temporarily locked.";

/** Only same-origin workbench paths are followed after sign-in (brief §14: redirects). */
function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/workbench(\/[\w\-/]*)?(\?[\w=&-]*)?$/.test(next) ? next : "/workbench";
}

async function startSession(user: { _id: string; sessionVersion: number }) {
  const { token } = await sealSession({ uid: user._id, sid: newSessionId(), sv: user.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(ABSOLUTE_SECONDS));
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!sessionsConfigured() || !masterKey()) return { error: "Sign-in is not available on this site yet." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!z.email().safeParse(email).success || !password) return { error: GENERIC, email };

  const h = await headers();
  if (!perAddress(clientKey(h)).ok || !perAccount(email).ok) return { error: "Too many attempts. Please wait a minute and try again.", email };

  const result = await checkCredentials(email, password);
  if (!result.ok) {
    await audit({ actorId: result.userId ?? null, action: "auth.sign_in", target: result.userId ? { type: "user", id: result.userId } : null, outcome: "failure", details: { reason: result.reason } });
    return { error: GENERIC, email };
  }
  await startSession(result.user);
  await audit({ actorId: result.user._id, action: "auth.sign_in", target: { type: "user", id: result.user._id }, outcome: "success" });
  redirect(result.user.mustChangePassword ? "/workbench/account?first=1" : safeNext(form.get("next")));
}

export async function signOut(): Promise<void> {
  const user = await currentUser();
  if (user) {
    await revokeSession(user.id, user.session.sid);
    await audit({ actorId: user.id, action: "auth.sign_out", target: { type: "user", id: user.id }, outcome: "success" });
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in?signed-out=1");
}

export async function signOutAll(): Promise<void> {
  const user = await currentUser();
  if (user) {
    await signOutEverywhere(user.id);
    await audit({ actorId: user.id, action: "auth.sign_out_everywhere", target: { type: "user", id: user.id }, outcome: "success" });
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in?signed-out=1");
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!(await verifyCurrentPassword(user.id, current))) {
    await audit({ actorId: user.id, action: "auth.change_password", target: { type: "user", id: user.id }, outcome: "failure", details: { reason: "wrong current password" } });
    return { error: "The current password is not right. On a first sign-in it is the temporary password you were given." };
  }
  const problem =
    next !== confirm ? "The two new passwords do not match." : next === current ? "Choose a password different from the current one." : passwordProblem(next, user.email);
  if (problem) {
    await audit({ actorId: user.id, action: "auth.change_password", target: { type: "user", id: user.id }, outcome: "failure", details: { reason: problem } });
    return { error: problem };
  }

  await setPassword(user.id, next, { temporary: false }); // signs out every other session
  const fresh = await getUser(user.id);
  if (fresh) await startSession(fresh);
  await audit({ actorId: user.id, action: "auth.change_password", target: { type: "user", id: user.id }, outcome: "success" });
  // First password of a new account: the workbench is now open, so go to My office.
  if (user.mustChangePassword) redirect("/workbench?welcome=1");
  return { done: "Your password is changed. Every other session has been signed out." };
}
