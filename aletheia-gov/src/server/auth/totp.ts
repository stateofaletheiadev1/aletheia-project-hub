import { Secret, TOTP } from "otpauth";

// Authenticator codes (RFC 6238) for optional two-step sign-in in the staff area: SHA-1, 6 digits,
// 30 seconds, as every authenticator app expects. One step of clock drift is accepted either way,
// and a code's time step can be used once only (the caller stores the last accepted step).

const PERIOD = 30;

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totp(secret: string, label: string): TOTP {
  return new TOTP({ issuer: "Aletheia Government Workbench", label, algorithm: "SHA1", digits: 6, period: PERIOD, secret: Secret.fromBase32(secret) });
}

/** The otpauth:// URI for the set-up QR code. */
export function totpUri(secret: string, label: string): string {
  return totp(secret, label).toString();
}

/** The accepted time step, or null. A step not later than `lastStep` is refused (no replay). */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const delta = totp(secret, "x").validate({ token: clean, window: 1, timestamp: now });
  if (delta === null) return null;
  const step = Math.floor(now / 1000 / PERIOD) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}
