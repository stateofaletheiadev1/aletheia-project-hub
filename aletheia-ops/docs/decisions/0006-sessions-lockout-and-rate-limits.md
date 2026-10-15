# ADR 0006: Sessions, lockout, rate limits and the audit chain in practice

- Status: Accepted
- Date: 2026-10-15

## Decisions

- **Sessions** are opaque 256-bit tokens in the cookie `__Host-agv_ops`; only their SHA-256 is
  stored. Every page resolves the session against the database, so suspension, revocation, a
  password change or a role change (each bumps the official's session version) takes effect on the
  next request. Idle 30 minutes (sliding, written at most once a minute), absolute 12 hours.
- **Two-step sign-in.** The password step creates a 10-minute "mfa" session in a separate
  cookie; the authenticator step revokes it and issues a new full session (rotation). A TOTP
  time step is accepted once only.
- **Lockout** is stored on the account: 10 failed passwords or codes lock it for 15 minutes.
  Messages never say which part was wrong; an unknown email costs the same Argon2 work.
- **Rate limits** (20 attempts a minute per address on sign-in, codes and invitations) are kept
  in process memory. On Vercel each instance counts separately; the per-account lockout is the
  control that cannot be spread across instances. A shared store would need a new dependency.
- **Founding administrators**: `scripts/admin-bootstrap.ts` creates at least two, once, before
  any official exists, so the two-person rule works from the first day. These are the only grants
  made without a second administrator, and the audit register records them as bootstrap.
- **Every change is audited in the same commit** (`commitAudited`). A request key makes a double
  submit act once. The chain head is a single document, so concurrent changes are serialised;
  a commit that lost only the race for the head is rebuilt and retried.
- **CSRF.** Server actions rely on Next.js's Origin check. The one route handler that changes
  state (sign-out) checks the Origin, falling back to `Sec-Fetch-Site` when the browser withholds
  it. A per-page `no-referrer` policy was removed after the end-to-end test showed it outliving
  the page in client navigation and causing the browser to send `Origin: null`.

## Not built

Passkeys (WebAuthn); administrator reset of a lost authenticator; email delivery of invitations
(links are shown once to the inviting administrator instead).
