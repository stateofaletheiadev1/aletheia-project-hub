// Authenticator codes (RFC 6238) through `otpauth`: SHA-1, 6 digits, 30 seconds, as every
// authenticator app expects. One step of clock drift is accepted either way, and a code's
// time step can be used once only (the caller stores the last accepted step).

import { Secret, TOTP } from "otpauth";

const PERIOD = 30;

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totp(secret: string, label: string): TOTP {
  return new TOTP({ issuer: "Aletheia Operations", label, algorithm: "SHA1", digits: 6, period: PERIOD, secret: Secret.fromBase32(secret) });
}

/** The otpauth:// URI for the enrolment QR code. */
export function totpUri(secret: string, label: string): string {
  return totp(secret, label).toString();
}

/**
 * Checks a code. Returns the accepted time step, or null. A code whose step is not later than
 * `lastStep` is refused, so an intercepted code cannot be replayed.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const delta = totp(secret, "x").validate({ token: clean, window: 1, timestamp: now });
  if (delta === null) return null;
  const step = Math.floor(now / 1000 / PERIOD) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

/** For tests and the enrolment screen's self-check only. */
export function currentCode(secret: string, now = Date.now()): string {
  return totp(secret, "x").generate({ timestamp: now });
}
