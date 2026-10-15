# Permission matrix

Generated from `src/policy/roles.ts` and `src/workflow/definitions.ts` by `npm run docs`. Do not edit by hand.

Every grant is a role, scoped to one institution or to all (`*`), with a clearance (the highest
classification it may see). Permissions are checked on the server for every page, action, query
and publication call. Nobody without an active account and a confirmed authenticator holds any
permission. Roles marked † need a second administrator to grant or remove (two-person rule).

## Roles

| Role | Summary |
|---|---|
| Founder † | Holds every power in every institution: writes, reviews, approves, releases, and grants roles without a second administrator (ADR 0009). |
| System administrator † | Runs the system: officials, roles, policies and integrations. Does not handle records. |
| Government administrator † | Administers institutions and officials across the government. |
| Institutional administrator † | Administers one institution: its officials and the assignment of its work. |
| Departmental officer | Reads the institution's records and comments on them. |
| Author | Drafts records and submits them for review. |
| Reviewer | Examines submitted versions; requests revision or rejects with reasons. |
| Approving officer † | Countersigns versions for the institution, and records adoption of decisions. |
| Publishing officer † | Authorises and releases approved records to the public record. |
| Finance officer † | Approves public finance records. |
| Appointments verifier | Verifies appointments before they can be approved. |
| Auditor | Reads everything it is cleared for, and the audit register. Changes nothing. |

## Permissions by role

| Permission | Founder | System administrator | Government administrator | Institutional administrator | Departmental officer | Author | Reviewer | Approving officer | Publishing officer | Finance officer | Appointments verifier | Auditor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Read records (`record.read`) | ● |  | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Create drafts (`record.create`) | ● |  |  |  |  | ● |  |  |  |  |  |  |
| Edit own drafts and revisions (`record.edit`) | ● |  |  |  |  | ● |  |  |  |  |  |  |
| Submit for review (`record.submit`) | ● |  |  |  |  | ● |  |  |  |  |  |  |
| Review, request revision, reject (`record.review`) | ● |  |  |  |  |  | ● | ● |  | ● |  |  |
| Approve (`record.approve`) | ● |  |  |  |  |  |  | ● |  |  |  |  |
| Record adoption of a decision (`record.adopt`) | ● |  |  |  |  |  |  | ● |  |  |  |  |
| Verify an appointment (`record.verify`) | ● |  |  |  |  |  |  |  |  |  | ● |  |
| Withdraw before publication (`record.withdraw`) | ● |  |  |  |  | ● |  | ● |  |  |  |  |
| Archive (`record.archive`) | ● |  |  | ● |  |  |  |  |  |  |  |  |
| Comment (`record.comment`) | ● |  |  |  | ● | ● | ● | ● | ● | ● | ● |  |
| Approve finance records (`finance.approve`) | ● |  |  |  |  |  |  |  |  | ● |  |  |
| Authorise publication (`publication.authorise`) | ● |  |  |  |  |  |  |  | ● |  |  |  |
| Publish to the public record (`publication.publish`) | ● |  |  |  |  |  |  |  | ● |  |  |  |
| Assign and reassign work (`task.assign`) | ● |  | ● | ● |  |  |  |  |  |  |  |  |
| Manage institutions and positions (`institution.manage`) | ● |  | ● |  |  |  |  |  |  |  |  |  |
| See officials and their access (`official.read`) | ● | ● | ● | ● |  |  |  |  |  |  |  | ● |
| Invite officials (`official.invite`) | ● | ● | ● | ● |  |  |  |  |  |  |  |  |
| Suspend, reinstate or revoke officials (`official.manage`) | ● | ● | ● |  |  |  |  |  |  |  |  |  |
| Propose a role grant or removal (`role.propose`) | ● | ● | ● | ● |  |  |  |  |  |  |  |  |
| Confirm another administrator's role change (`role.confirm`) | ● | ● | ● | ● |  |  |  |  |  |  |  |  |
| Propose a workflow policy change (`policy.propose`) | ● | ● |  |  |  |  |  |  |  |  |  |  |
| Confirm another administrator's policy change (`policy.confirm`) | ● | ● |  |  |  |  |  |  |  |  |  |  |
| Read the audit register (`audit.read`) | ● | ● | ● |  |  |  |  |  |  |  |  | ● |
| Read the publication log (`publication_log.read`) | ● | ● | ● |  |  |  |  |  | ● |  |  | ● |
| See integration health (`integration.read`) | ● | ● |  |  |  |  |  |  |  |  |  | ● |

## Workflow steps and the permission each needs

### Documents (`documents.v1`)

Approvals required: 1. Approver may also release: yes.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject document | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Approve document | Under review | Approved | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_complete` |
| Approve document | Under review | Under review | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw document | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive document | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen document | Rejected | Draft | `record.approve` | `reason_given` |

### Decisions (`decisions.v1`)

Approvals required: 1. Approver may also release: no.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject decision | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Record adoption | Under review | Adopted | `record.adopt` | `actor_did_not_author_version` |
| Approve decision | Adopted | Approved | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `actor_is_second_officer`, `approvals_complete` |
| Approve decision | Adopted | Adopted | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `actor_is_second_officer`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw decision | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive decision | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen decision | Rejected | Draft | `record.approve` | `reason_given` |

### Dispatches (`dispatches.v1`)

Approvals required: 1. Approver may also release: yes.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject dispatch | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Approve dispatch | Under review | Approved | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_complete` |
| Approve dispatch | Under review | Under review | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw dispatch | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive dispatch | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen dispatch | Rejected | Draft | `record.approve` | `reason_given` |

### Public finance (`finance.v1`)

Approvals required: 1. Approver may also release: no.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author`, `source_document_linked` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject finance record | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Approve finance record | Under review | Approved | `finance.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_complete` |
| Approve finance record | Under review | Under review | `finance.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw finance record | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive finance record | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen finance record | Rejected | Draft | `record.approve` | `reason_given` |

### Appointments (`appointments.v1`)

Approvals required: 1. Approver may also release: no.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject appointment | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Verify appointment | Under review | Verified | `record.verify` | `actor_did_not_author_version` |
| Approve appointment | Verified | Approved | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `actor_is_second_officer`, `approvals_complete` |
| Approve appointment | Verified | Verified | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `actor_is_second_officer`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version`, `disclosure_authorised` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned`, `actor_did_not_approve_version` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw appointment | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive appointment | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen appointment | Rejected | Draft | `record.approve` | `reason_given` |

### Opportunities (`opportunities.v1`)

Approvals required: 1. Approver may also release: yes.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject opportunity | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Approve opportunity | Under review | Approved | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_complete` |
| Approve opportunity | Under review | Under review | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw opportunity | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive opportunity | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen opportunity | Rejected | Draft | `record.approve` | `reason_given` |

### Events (`events.v1`)

Approvals required: 1. Approver may also release: yes.

| Step | From | To | Permission | Conditions |
|---|---|---|---|---|
| Submit for review | Draft, Revision requested, Correction in progress | Submitted | `record.submit` | `actor_is_author` |
| Take for review | Submitted | Under review | `record.review` | `actor_did_not_author_version` |
| Request revision | Submitted, Under review, Adopted, Verified | Revision requested | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Reject event | Submitted, Under review, Adopted, Verified | Rejected | `record.review` | `actor_did_not_author_version`, `reason_given` |
| Approve event | Under review | Approved | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_complete` |
| Approve event | Under review | Under review | `record.approve` | `actor_did_not_author_version`, `actor_has_not_approved_version`, `approvals_outstanding` |
| Authorise publication | Approved | Publication authorised | `publication.authorise` | `classification_is_public`, `attachments_scanned` |
| Publish to the public record | Publication authorised | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Confirm publication | Publishing | Published | system | `system_only` |
| Record publication failure | Publishing | Publication failed | system | `system_only` |
| Retry publication | Publication failed | Publishing | `publication.publish` | `classification_is_public`, `attachments_scanned` |
| Start a correction | Published | Correction in progress | `record.edit` | `reason_given` |
| Withdraw event | Draft, Submitted, Under review, Revision requested, Adopted, Verified, Approved, Publication authorised, Publication failed | Withdrawn | `record.withdraw` | `reason_given` |
| Archive event | Published, Rejected, Withdrawn | Archived | `record.archive` |  |
| Reopen event | Rejected | Draft | `record.approve` | `reason_given` |
