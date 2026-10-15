"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientAddress, createLimiter } from "@/lib/rate-limit";
import { Refused, signInWithPassword, verifySignInCode } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { deviceLabel, mfaToken, setMfaCookie, setSessionCookie } from "@/server/session";

// Sign-in in two steps (ADR 0004). Messages never say which part was wrong.

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
  try {
    const { mfaToken: token } = await signInWithPassword(await requireDeps(), parsed.data.email, parsed.data.password, await deviceLabel());
    await setMfaCookie(token);
  } catch (e) {
    if (e instanceof Refused) return { error: e.message, email: parsed.data.email };
    throw e;
  }
  redirect(`/sign-in/verify?next=${encodeURIComponent(safeNext(form.get("next")))}`);
}

export async function verifyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const tooMany = await limited();
  if (tooMany) return { error: tooMany };
  const token = await mfaToken();
  if (!token) redirect("/sign-in");
  const parsed = Code.safeParse({ code: form.get("code") });
  if (!parsed.success) return { error: "Enter the six-digit code." };
  try {
    const { sessionToken } = await verifySignInCode(await requireDeps(), token, parsed.data.code, await deviceLabel());
    await setSessionCookie(sessionToken);
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}
