"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientAddress, createLimiter } from "@/lib/rate-limit";
import { choosePassword, confirmAuthenticator, finishWithoutCode, Refused } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { deviceLabel, setSessionCookie } from "@/server/session";

// Accepting an invitation (ADR 0004): choose a password, then confirm an authenticator.

export type AcceptState = { error?: string };

const limiter = createLimiter({ limit: 20, windowMs: 60_000 });
const Token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

async function guard(token: unknown): Promise<{ token: string } | AcceptState> {
  const verdict = limiter(clientAddress(await headers()));
  if (!verdict.ok) return { error: `Too many attempts from this connection. Wait ${verdict.retryAfterSeconds} seconds and try again.` };
  const t = Token.safeParse(token);
  return t.success ? { token: t.data } : { error: "This invitation link is not valid." };
}

export async function choosePasswordAction(_prev: AcceptState, form: FormData): Promise<AcceptState> {
  const g = await guard(form.get("token"));
  if (!("token" in g)) return g;
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords are different. Enter the same password twice." };
  let signedIn = false;
  try {
    const result = await choosePassword(await requireDeps(), g.token, password, await deviceLabel());
    if (result.kind === "signed_in") {
      // Authenticator codes are switched off (ADR 0007): the account is active now.
      await setSessionCookie(result.sessionToken);
      signedIn = true;
    }
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect(signedIn ? "/?welcome=1" : `/invitation/${g.token}`);
}

export async function confirmAuthenticatorAction(_prev: AcceptState, form: FormData): Promise<AcceptState> {
  const g = await guard(form.get("token"));
  if (!("token" in g)) return g;
  try {
    const { sessionToken } = await confirmAuthenticator(await requireDeps(), g.token, String(form.get("code") ?? ""), await deviceLabel());
    await setSessionCookie(sessionToken);
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect("/?welcome=1");
}

/** Codes switched off (ADR 0007): complete an invitation whose password is already chosen. */
export async function finishAction(_prev: AcceptState, form: FormData): Promise<AcceptState> {
  const g = await guard(form.get("token"));
  if (!("token" in g)) return g;
  try {
    const { sessionToken } = await finishWithoutCode(await requireDeps(), g.token, await deviceLabel());
    await setSessionCookie(sessionToken);
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect("/?welcome=1");
}
