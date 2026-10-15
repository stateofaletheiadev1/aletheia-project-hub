# ADR 0009: Founders hold every power

- Status: Accepted (owner, 16 October 2026). Supersedes ADR 0008.
- Date: 2026-10-16

## Context

The owner: a founder must be able to create, review, approve, reject and publish documents and
manage everyone's roles, with full power over everything; other officials keep the roles they are
assigned. The brief's separation of duties (§22) and two-person rule (§18.5) would otherwise stop
a founder approving their own document or granting privileged roles alone.

## Decision

- A `founder` role holding every permission, in every institution, at Confidential clearance.
  Founders receive only this role (`FOUNDER_GRANTS`); the two existing founders were moved to it
  by `scripts/founders-grants.ts`, recorded in the audit register.
- Separation-of-duties guards do not bind founders (`SOD_GUARDS` in workflow/engine.ts). Every
  step a founder takes over such a rule writes a `record.founder_authority` event naming the rules
  set aside, and the countersignature shows the signer as Founder.
- A founder's access changes take effect at once, without a second administrator. Only a founder
  can make another official a founder. Nobody changes their own access.
- Unchanged for everyone else: authors cannot approve their own versions; privileged roles proposed
  by ordinary administrators need a second administrator.
- Unchanged for founders too: rules that are not about who acts (only Public records are published,
  reasons for returns and rejections, attachments scanned, publication confirmed by the portal).

## Consequences

A founder's own document can be published without anyone else seeing it first. The audit register
makes every such act visible and permanent.
