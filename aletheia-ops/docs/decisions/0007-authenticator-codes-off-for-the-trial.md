# ADR 0007: Authenticator codes switched off for the trial

- Status: Accepted (owner, 16 October 2026)
- Date: 2026-10-16

## Context

The owner asked to remove the authenticator (QR code) step for now, and to bring it back before
real officials are enrolled. The brief requires MFA for privileged roles (§24); this is a
temporary departure for a trial with the founders.

## Decision

- A setting, not a removal: `AUTH_MFA=required` (default) or `off`. All the code stays.
- With `off`: accepting an invitation and signing in need a password only; officials hold their
  roles' authority; every sign-in is recorded in the audit register with `mfa: off`; a banner on
  every page says codes are switched off.
- `APP_ENV=production` refuses to start with `off`, so the live system cannot leave the trial
  without codes.
- Switching back to `required`: sessions of officials without an authenticator stop at once; at
  their next sign-in each is shown a QR code and must enrol before going further. Nobody is
  locked out and nobody skips it.

## Consequences

Until codes are required again, a stolen password is enough to sign in as that official. Lockout
after 10 failures and per-address limits still apply.

## Revision, 16 October 2026: optional, not off

The owner clarified: sign-up with a password only, and each official may turn on two-step sign-in
from their account. `AUTH_MFA=optional` (the old value `off` is read the same way): an official
who has turned it on is always asked for a code; one who has not signs in with a password. They
can turn it off again with their password while it is optional. `required` still forces it on for
everyone, and production refuses `optional`.
