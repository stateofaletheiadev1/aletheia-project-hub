// Cryptographic helpers (ADR 0004). Built only on node:crypto; no hand-made algorithms.
// Keys are passed in explicitly so the helpers are testable and never read the environment.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes as base64url: invitation and session tokens. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function equalHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Lower-cased, trimmed email: the one form ever indexed or compared. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keyed hash of an email, so accounts are found without the address being stored in clear. */
export function blindIndex(key: Buffer, email: string): string {
  return createHmac("sha256", key).update(`email:${normaliseEmail(email)}`).digest("hex");
}

/**
 * AES-256-GCM sealing. `context` is bound as associated data (for example the official's id),
 * so a sealed value copied onto another record does not open. Output: v1.<iv>.<tag>.<ciphertext>.
 */
export function seal(key: Buffer, plaintext: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function open(key: Buffer, sealed: string, context: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || body === undefined) throw new Error("unrecognised sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

/** Canonical JSON (sorted keys, no whitespace): the input to content and audit hashes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite number in canonical JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}
