# ADR 0011: Applications are held on aletheiagov.org, and read and changed from both places

- Status: Accepted (owner, 16 October 2026)
- Date: 2026-10-16

## Context

People apply for published positions on aletheiagov.org. The owner wants to see and manage the
applications in the portal's staff area and in the workbench, and wants a status changed in one
place to be the status everywhere.

## Decision

- An application is stored once, on aletheiagov.org (its database, encrypted per person as before).
  The workbench keeps no copy. Both screens read the same record, so there is nothing to
  synchronise and nothing to drift.
- The statuses are hiring steps: Received (stored as `new`, for older records), Contacted,
  Shortlisted, Offered, Appointed, Not progressed, Archived. The list is defined on both sides
  and pinned by a unit test in each repository.
- Every change appends to the application's status history: the status, when, who (name and id),
  and from where (`portal` or `ops`). Both screens show the history.
- The workbench uses signed routes on the portal, with the same keys and signature as publication
  (ADR 0003): list (filter by status or position applied for), one application, a status change
  with the revision the official saw (a stale one is refused, so two people cannot silently
  overwrite each other), and the CV. Each request names the official; the portal records every
  read, change and download in its audit log as `ops:<official id>`.
- Permissions `application.read` and `application.update`, held by founders (who hold everything)
  and government administrators. Status changes and CV downloads are also recorded in the
  workbench's own audit chain.

## Consequences

If aletheiagov.org cannot be reached, the workbench says so and shows nothing rather than an old
copy. A key that signs publications can also read applications, so the key is now as sensitive as
the applicants' personal data; it is held only in the two sites' environment settings.
