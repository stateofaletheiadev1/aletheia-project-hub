"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/server/auth/current-user";
import { passwordProblem } from "@/server/auth/password";
import { ABSOLUTE_SECONDS, cookieOptions, openTwoStep, sealSession, sealTwoStep, SESSION_COOKIE, sessionsConfigured, TWO_STEP_COOKIE, TWO_STEP_SECONDS } from "@/server/auth/session";
import { masterKey } from "@/server/crypto/subject-keys";
import { clientKey, createLimiter } from "@/server/security/rate-limit";
import { audit } from "@/server/services/audit";
import { beginTwoStep, checkCredentials, checkTwoStepCode, confirmTwoStep, disableTwoStep, getUser, newSessionId, revokeSession, setPassword, signOutEverywhere, verifyCurrentPassword } from "@/server/services/users";

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

  // The record database or a write to it can fail (misconfigured or unreachable):
  // fail closed, but answer in the form, never with a 500 page. The detail goes
  // to the server log, where an officer can diagnose it; the browser gets nothing
  // that distinguishes a missing account from a down database.
  let target: string | null = null;
  try {
    const result = await checkCredentials(email, password);
    if (!result.ok) {
      await audit({ actorId: result.userId ?? null, action: "auth.sign_in", target: result.userId ? { type: "user", id: result.userId } : null, outcome: "failure", details: { reason: result.reason } });
      return { error: GENERIC, email };
    }
    const next = result.user.mustChangePassword ? "/workbench/account?first=1" : safeNext(form.get("next"));
    if (result.user.totp) {
      // Two-step sign-in is on for this account: the code comes next.
      (await cookies()).set(TWO_STEP_COOKIE, await sealTwoStep({ uid: result.user._id, sv: result.user.sessionVersion, next }), cookieOptions(TWO_STEP_SECONDS));
      await audit({ actorId: result.user._id, action: "auth.password", target: { type: "user", id: result.user._id }, outcome: "success" });
      target = "/sign-in/code";
    } else {
      await startSession(result.user);
      await audit({ actorId: result.user._id, action: "auth.sign_in", target: { type: "user", id: result.user._id }, outcome: "success" });
      target = next;
    }
  } catch (e) {
    console.error("sign-in unavailable", e);
    return { error: "Sign-in is temporarily unavailable. Please try again in a moment.", email };
  }
  redirect(target);
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

// ------------------------------------------------------------- optional two-step sign-in

const perCode = createLimiter({ limit: 5, windowMs: 60_000 });

export async function verifySignInCode(_prev: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const pending = await openTwoStep(jar.get(TWO_STEP_COOKIE)?.value);
  if (!pending) return { error: "This sign-in has expired. Start again with your email and password." };
  if (!perCode(pending.uid).ok) return { error: "Too many attempts. Please wait a minute and try again." };
  const ok = await checkTwoStepCode(pending.uid, String(form.get("code") ?? ""));
  const user = ok ? await getUser(pending.uid) : null;
  if (!user || user.sessionVersion !== pending.sv) {
    await audit({ actorId: pending.uid, action: "auth.two_step", target: { type: "user", id: pending.uid }, outcome: "failure" });
    return { error: "That code is not right. Use the code your authenticator app shows now; it changes every 30 seconds." };
  }
  await startSession(user);
  jar.delete(TWO_STEP_COOKIE);
  await audit({ actorId: user._id, action: "auth.sign_in", target: { type: "user", id: user._id }, outcome: "success", details: { twoStep: true } });
  redirect(pending.next);
}

export async function startTwoStepSetup(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  await beginTwoStep(user.id);
  redirect("/workbench/account/two-step");
}

export async function confirmTwoStepSetup(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!(await confirmTwoStep(user.id, String(form.get("code") ?? "")))) return { error: "That code is not right. Enter the six digits your app shows now." };
  const fresh = await getUser(user.id);
  if (fresh) await startSession(fresh); // every other session was signed out
  await audit({ actorId: user.id, action: "auth.two_step_on", target: { type: "user", id: user.id }, outcome: "success" });
  redirect("/workbench/account?two-step=on");
}

export async function turnOffTwoStep(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!(await verifyCurrentPassword(user.id, String(form.get("password") ?? "")))) return { error: "The password is not right." };
  await disableTwoStep(user.id);
  await audit({ actorId: user.id, action: "auth.two_step_off", target: { type: "user", id: user.id }, outcome: "success" });
  return { done: "Two-step sign-in is off. You sign in with your password only. You can turn it on again at any time." };
}
