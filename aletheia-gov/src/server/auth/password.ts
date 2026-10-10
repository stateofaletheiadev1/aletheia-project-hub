import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP's recommended minimum (19 MiB memory, 2 passes, 1 lane):
// @node-rs/argon2's defaults, written out so they are visible and reviewed.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

// Verified when no account matches, so a wrong email takes as long as a wrong password.
let dummy: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  const target = stored ?? (await (dummy ??= hash("not-a-real-password-placeholder", OPTIONS)));
  try {
    const ok = await verify(target, password);
    return stored !== null && ok;
  } catch {
    return false;
  }
}

const COMMON = ["password", "123456", "qwerty", "aletheia", "letmein", "welcome", "admin"];

/** Rules for passwords people choose (temporary passwords are set by an administrator). */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 3 && lower.includes(local)) return "Do not include your email name in the password.";
  if (COMMON.some((c) => lower.includes(c)) && new Set(lower).size < 8) return "That password is too easy to guess.";
  if (new Set(password).size < 5) return "Use a wider mix of characters.";
  return null;
}
