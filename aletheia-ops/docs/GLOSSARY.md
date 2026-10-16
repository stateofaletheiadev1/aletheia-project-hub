# Glossary

Generated from `src/domain/glossary.ts` by `npm run docs`. Do not edit by hand. These words are used
identically in the interface, the API, the audit register and the publication mapping.

## Record status

| Term | Meaning |
|---|---|
| Draft | Being written. Visible to its author and to officers with access to the institution's drafts. |
| Submitted | Sent for review. The author can no longer edit this version. |
| Under review | A reviewer has taken the record and is examining this version. |
| Revision requested | Returned to the author with reasons. A revised version goes back for review. |
| Adopted | Decisions only: adopted by the body that took the decision, awaiting approval by a second officer. |
| Verified | Appointments only: the appointment has been checked by an officer other than the drafter. |
| Approved | Every required approval is recorded against this exact version. Not yet public. |
| Rejected | Not approved, with reasons. Closed unless reopened under policy. |
| Publication authorised | A publishing officer has authorised release to the public record. |
| Publishing | Sent to aletheiagov.org. Waiting for the portal to confirm. |
| Published | Confirmed by aletheiagov.org. The public reference and content hash are fixed. |
| Publication failed | The portal refused the publication. The reason is on the record; it can be corrected and retried. |
| Correction in progress | A corrected version of a published record is going through review. The published version stays public meanwhile. |
| Withdrawn | Withdrawn before publication, with a reason. |
| Archived | Closed and kept for the record. If it was published, it stays on aletheiagov.org. |
| Withdrawn from the public record | Taken off aletheiagov.org with a reason. The page stays at its address with a withdrawal notice; the reference is never reused. |

## Classification

| Term | Meaning |
|---|---|
| Public | May be published once approved and authorised. |
| Internal | For officers of the government. Never published. |
| Restricted | Only officers granted access to the owning institution's restricted records. Never published while restricted. |
| Confidential | Named officers only. Every view is recorded in the audit register. Never published. |

## Priority

| Term | Meaning |
|---|---|
| Routine | Due 14 days after assignment unless a date is set. |
| Priority | Due 5 days after assignment unless a date is set. |
| Urgent | Due 1 day after assignment. Overdue items escalate to the institution's administrator. |

## Publication (publication log)

| Term | Meaning |
|---|---|
| Pending | Queued or sent; no answer from the portal yet. |
| Confirmed | The portal confirmed the publication and returned its receipt. |
| Failed | The portal refused the publication, with a reason. |
| Needs reconciliation | The answer was lost or unclear. The portal is asked what happened before anything is retried. |

## Accounts

| Term | Meaning |
|---|---|
| Invited | An invitation has been issued and not yet accepted. |
| Active | Can sign in with a password, and an authenticator code if two-step sign-in is turned on. |
| Suspended | Cannot sign in. Sessions ended. Can be reinstated. |
| Revoked | Access ended permanently. The account remains in the record for audit. |

## Institutions (as on aletheiagov.org)

| Term | Meaning |
|---|---|
| Proposed | Described in a draft framework only. |
| Planned | Approved for development; no work started. |
| In formation | People and work assigned; not yet functioning. |
| In development | Active work under way. |
| Recruiting | Actively seeking founding contributors. |
| Established | Established within the founding framework. |
| Operational | Verified to be functioning, with evidence on record. |
| Suspended | Work paused. |
| Archived | No longer active; kept for the record. |

## Registers

| Register | Reference | Publication rule |
|---|---|---|
| Documents | `AGV-DOC` | Every version is kept, and every published version carries a SHA-256 content hash. An author cannot approve their own document. |
| Decisions | `AGV-DEC` | Published only once adopted and approved by a second officer. |
| Dispatches | `AGV-DSP` | One reviewer and a publishing officer. |
| Public finance | `AGV-FIN` | Each item is traced to a source document and approved by a finance officer. Restricted until publication is authorised. |
| Appointments | `AGV-APT` | Verified by an officer other than the drafter. Personal details are published only with explicit authorisation. |
| Opportunities | `AGV-OPP` | Applications are reviewed by two people and are never published. |
| Events | `AGV-EVT` | Times are shown in the event's own timezone. Changes and cancellations are published as amendments. |
