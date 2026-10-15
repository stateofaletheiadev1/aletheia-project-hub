"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientAddress, createLimiter } from "@/lib/rate-limit";
import { confirmSignInEnrolment, Refused, signInWithPassword, verifySignInCode } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { deviceLabel, mfaToken, setMfaCookie, setSessionCookie } from "@/server/session";

// Sign-in (ADR 0004, 0007): password, then the authenticator code, or enrolment of one for an
// account that has none, or nothing more while codes are switched off. Messages never say which
// part was wrong.

export type FormState = { error?: string; email?: string };

const limiter = createLimiter({ limit: 20, windowMs: 60_000 });

async function limited(): Promise<string | null> {
  const verdict = limiter(clientAddress(await headers()));
  return verdict.ok ? null : `Too many attempts from this connection. Wait ${verdict.retryAfterSeconds} seconds and try again.`;
}

const Credentials = z.object({ email: z.string().trim().max(254), password: z.string().max(256) });
const Code = z.object({ code: z.string().trim().max(12) });

/** Only same-site paths, never "//host" or a scheme: no open redirects (brief §27). */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return /^\/(?![/\\])[\w\-/]*$/.test(v) ? v : "/";
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const tooMany = await limited();
  if (tooMany) return { error: tooMany };
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password." };
  const next = safeNext(form.get("next"));
  let destination: string;
  try {
    const result = await signInWithPassword(await requireDeps(), parsed.data.email, parsed.data.password, await deviceLabel());
    if (result.kind === "signed_in") {
      await setSessionCookie(result.sessionToken);
      destination = next;
    } else {
      await setMfaCookie(result.mfaToken);
      destination = `/sign-in/${result.kind === "enrol" ? "enrol" : "verify"}?next=${encodeURIComponent(next)}`;
    }
  } catch (e) {
    if (e instanceof Refused) return { error: e.message, email: parsed.data.email };
    throw e;
  }
  redirect(destination);
}

export async function verifyAction(_prev: FormState, form: FormData): Promise<FormState> {
  return secondStep(form, verifySignInCode);
}

export async function enrolAction(_prev: FormState, form: FormData): Promise<FormState> {
  return secondStep(form, confirmSignInEnrolment);
}

async function secondStep(form: FormData, fn: typeof verifySignInCode): Promise<FormState> {
  const tooMany = await limited();
  if (tooMany) return { error: tooMany };
  const token = await mfaToken();
  if (!token) redirect("/sign-in");
  const parsed = Code.safeParse({ code: form.get("code") });
  if (!parsed.success) return { error: "Enter the six-digit code." };
  try {
    const { sessionToken } = await fn(await requireDeps(), token, parsed.data.code, await deviceLabel());
    await setSessionCookie(sessionToken);
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}
