# ADR 0008: Founders may author records

- Status: Accepted (owner, 16 October 2026)
- Date: 2026-10-16

## Context

Founding administrators held only administration roles, so they could manage people but not put
anything on the record. The owner wants founders to pass information across themselves.

## Decision

- Founders hold Author in every institution (internal clearance) besides their administration
  roles (`FOUNDER_GRANTS`). New founders receive it at bootstrap; the two founders created on
  15 October received it by `scripts/founders-author.ts`, recorded in the audit register as a
  founding grant on the owner's instruction.
- Separation of duties is unchanged: nobody approves a version they wrote or edited, and approving
  and publishing roles still need a second administrator to confirm.
