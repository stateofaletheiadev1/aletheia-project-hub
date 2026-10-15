# ADR 0010: Withdrawal from the public record

- Status: Accepted (owner, 16 October 2026)
- Date: 2026-10-16

## Context

Archiving a published record closed it in the workbench but left it on aletheiagov.org. The owner
needs a way to take a record off the public site.

## Decision

- A step "Withdraw from the public record" (`withdraw_publication`), from Published or Archived,
  to the new state "Withdrawn from the public record". Permission `publication.withdraw`, held by
  founders only. A reason (published on the notice) and the typed reference are required.
- The portal endpoint `POST /api/withdrawals` (signed like publication) keeps the page at its
  address with "Withdrawn on [date]" and the reason, removes the text, summary and facts from the
  site, and drops it from registers and the homepage. Only the workbench record that published it
  may withdraw it. The reference is never reused.
- Delivery uses the publication outbox (one idempotency key per record, retried and reconciled
  the same way). The receipt in the workbench shows when the portal confirmed the withdrawal.
- Archive keeps its meaning (closed in the workbench) and now says that it does not touch the site.

## Consequences

Removing a record entirely, as if never published, is not offered; withdrawn pages keep their
address and say why. The portal caches pages for up to 60 seconds, so the notice can take a minute
to appear.
