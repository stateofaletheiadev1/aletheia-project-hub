# ADR 0004: Identity, sessions and MFA

- Status: Accepted (owner decision D3, 15 October 2026)
- Date: 2026-10-15

## Context

The brief asks for a maintained authentication solution, invitation-only accounts, MFA for
privileged roles, and server-side revocation that takes effect on the next request. Auth.js
supports credentials sign-in only with stateless JWT sessions, which cannot meet "revocation on
the next request" without a database lookup anyway, and has no built-in TOTP or invitations.

## Decision

- Own accounts in the `workbench` database, separate from the portal's `/workbench`.
- No hand-written cryptography. Maintained primitives only:
  - passwords: Argon2id via `@node-rs/argon2` (same parameters as the portal);
  - TOTP (RFC 6238): `otpauth`; secrets sealed with AES-256-GCM (`node:crypto`) under
    `DATA_ENCRYPTION_KEY` before storage;
  - session tokens: 32 random bytes from `node:crypto`, stored only as SHA-256; looked up on
    every request, so suspension, revocation and role changes take effect immediately.
- Cookie `__Host-agv_ops` (HttpOnly, Secure, SameSite=Strict, Path=/). 30 minutes idle,
  12 hours absolute. A new session id on sign-in, on MFA completion and on any privilege change.
- MFA is required for every account (not only privileged ones). It costs one step at sign-in
  and removes a class of mistakes in deciding who needs it.
- Invitations: single-use, 72 hours, bound to an email address, stored as a hash of the token.
  Without an email provider the invitation link is shown once to the inviting administrator.
- WebAuthn/passkeys are a later addition (`@simplewebauthn/server`), recorded as not built.
