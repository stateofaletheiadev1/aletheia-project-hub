import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { can, type Permission, type Scope } from "@/policy/roles";
import { resolveSession, type SignedIn } from "@/services/identity/identity";
import { ABSOLUTE_HOURS, MFA_STAGE_MINUTES } from "@/services/identity/types";
import { deps } from "./runtime";

// The session cookie and the identity of the current request (ADR 0004). Pages and actions call
// requireOfficial / requirePermission; the proxy only checks that a cookie is present.

export const SESSION_COOKIE = "__Host-agv_ops";
export const MFA_COOKIE = "__Host-agv_ops_mfa";

/** __Host- cookies must be Secure; browsers accept them on http://localhost for development. */
function options(maxAgeSeconds: number) {
  return { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/", maxAge: maxAgeSeconds, priority: "high" as const };
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, options(ABSOLUTE_HOURS * 3600));
  jar.set(MFA_COOKIE, "", options(0));
}

export async function setMfaCookie(token: string): Promise<void> {
  (await cookies()).set(MFA_COOKIE, token, options(MFA_STAGE_MINUTES * 60));
}

export async function clearCookies(): Promise<void> {
  const jar = await cookies();
  // Expired with the same attributes, as __Host- cookies require (a bare delete is ignored).
  jar.set(SESSION_COOKIE, "", options(0));
  jar.set(MFA_COOKIE, "", options(0));
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function mfaToken(): Promise<string | undefined> {
  return (await cookies()).get(MFA_COOKIE)?.value;
}

/** A short description of the device, kept with the session so officials recognise their own. */
export async function deviceLabel(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "unknown system";
  return `${browser} on ${os}`;
}

export async function currentOfficial(): Promise<SignedIn | null> {
  const d = await deps();
  if (!d) return null;
  return resolveSession(d, await sessionToken());
}

/** For pages and actions: a signed-in official, or the sign-in page. */
export async function requireOfficial(): Promise<SignedIn> {
  const s = await currentOfficial();
  if (!s) redirect("/sign-in");
  return s;
}

/** Unauthorised looks the same as absent (brief §25): a 404, never a 403. */
export async function requirePermission(permission: Permission, scope?: Scope): Promise<SignedIn> {
  const s = await requireOfficial();
  if (!can(s.actor, permission, scope)) notFound();
  return s;
}
