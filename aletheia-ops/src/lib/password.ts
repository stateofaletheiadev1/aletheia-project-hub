// Passwords (ADR 0004): Argon2id through @node-rs/argon2, with the portal's parameters
// (OWASP minimum: 19 MiB, 2 iterations, 1 lane). The rules are checked before hashing and
// explained to the official in plain words.

import { hash, verify } from "@node-rs/argon2";

const PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 256;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { ...PARAMS, algorithm: 2 });
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** A hash to verify against when no account matches, so timing does not reveal which part was wrong. */
let decoy: Promise<string> | undefined;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword("decoy password that no account has");
  return decoy;
}

/** Returns the rules the password breaks, as sentences; empty when it is acceptable. */
export function passwordProblems(password: string, email: string, name: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD) problems.push(`Use at least ${MIN_PASSWORD} characters.`);
  if (password.length > MAX_PASSWORD) problems.push(`Use at most ${MAX_PASSWORD} characters.`);
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 3 && lower.includes(local)) problems.push("Do not include your email address.");
  for (const part of name.toLowerCase().split(/[\s'’-]+/)) {
    if (part.length >= 3 && lower.includes(part)) {
      problems.push("Do not include your name.");
      break;
    }
  }
  if (/^(.)\1+$/.test(password)) problems.push("Do not repeat a single character.");
  return problems;
}
