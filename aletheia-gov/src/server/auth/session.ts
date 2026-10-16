import "server-only";
import { hkdfSync } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { env } from "@/lib/config/env";

// Workbench sessions (brief §8.5, §11): an encrypted, HttpOnly cookie, never stored per
// request in the database. 30 minutes idle, 12 hours absolute. Revocation (sign out,
// sign out everywhere, account disabled) is checked against the user record on the server.

export const SESSION_COOKIE = "__Host-agv_workbench";
export const IDLE_SECONDS = 30 * 60;
export const ABSOLUTE_SECONDS = 12 * 60 * 60;
/** Re-issue the cookie (sliding the idle window) at most this often. */
export const REFRESH_AFTER_SECONDS = 60;

export type SessionClaims = {
  /** User id. */
  uid: string;
  /** Session id, for revoking this session alone. */
  sid: string;
  /** The user's session version: bumping it signs out every session. */
  sv: number;
  /** Last activity, seconds since the epoch. */
  last: number;
  /** Issued at / absolute expiry, seconds since the epoch. */
  iat: number;
  exp: number;
};

let key: Uint8Array | undefined;
function sessionKey(): Uint8Array {
  if (key) return key;
  const secret = env().AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set: the workbench is disabled");
  key = new Uint8Array(hkdfSync("sha256", secret, Buffer.alloc(0), "aletheiagov workbench session v1", 32));
  return key;
}

export function sessionsConfigured(): boolean {
  return Boolean(env().AUTH_SECRET);
}

const now = () => Math.floor(Date.now() / 1000);

export async function sealSession(c: Omit<SessionClaims, "iat" | "exp" | "last"> & Partial<Pick<SessionClaims, "iat" | "exp">>): Promise<{ token: string; claims: SessionClaims }> {
  const t = now();
  const claims: SessionClaims = { uid: c.uid, sid: c.sid, sv: c.sv, last: t, iat: c.iat ?? t, exp: c.exp ?? t + ABSOLUTE_SECONDS };
  const token = await new EncryptJWT({ uid: claims.uid, sid: claims.sid, sv: claims.sv, last: claims.last })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .encrypt(sessionKey());
  return { token, claims };
}

/** Decrypts and checks idle and absolute expiry. Returns null for anything invalid. */
export async function openSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token || token.length > 4096 || !sessionsConfigured()) return null;
  try {
    const { payload } = await jwtDecrypt(token, sessionKey(), { keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"] });
    const c = payload as unknown as SessionClaims;
    if (typeof c.uid !== "string" || typeof c.sid !== "string" || typeof c.sv !== "number" || typeof c.last !== "number") return null;
    if (now() - c.last > IDLE_SECONDS) return null;
    return c;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAgeSeconds: number) {
  return { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/", maxAge: maxAgeSeconds };
}

// Between the password and the authenticator code (optional two-step sign-in): a short-lived,
// encrypted cookie that names the account and nothing more. It grants no access by itself.

export const TWO_STEP_COOKIE = "__Host-agv_workbench_step";
export const TWO_STEP_SECONDS = 5 * 60;

let stepKey: Uint8Array | undefined;
function twoStepKey(): Uint8Array {
  if (stepKey) return stepKey;
  const secret = env().AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set: the workbench is disabled");
  stepKey = new Uint8Array(hkdfSync("sha256", secret, Buffer.alloc(0), "aletheiagov workbench two-step v1", 32));
  return stepKey;
}

export async function sealTwoStep(c: { uid: string; sv: number; next: string }): Promise<string> {
  const t = now();
  return new EncryptJWT({ uid: c.uid, sv: c.sv, next: c.next }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt(t).setExpirationTime(t + TWO_STEP_SECONDS).encrypt(twoStepKey());
}

export async function openTwoStep(token: string | undefined): Promise<{ uid: string; sv: number; next: string } | null> {
  if (!token || token.length > 4096 || !sessionsConfigured()) return null;
  try {
    const { payload } = await jwtDecrypt(token, twoStepKey(), { keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"] });
    const p = payload as { uid?: unknown; sv?: unknown; next?: unknown };
    if (typeof p.uid !== "string" || typeof p.sv !== "number" || typeof p.next !== "string") return null;
    return { uid: p.uid, sv: p.sv, next: p.next };
  } catch {
    return null;
  }
}
