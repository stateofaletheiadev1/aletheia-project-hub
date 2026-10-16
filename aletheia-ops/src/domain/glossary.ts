// The controlled vocabulary of the workbench (brief §15). Every status, classification and
// priority is defined once here, with the label shown in the interface and the meaning given
// in docs/GLOSSARY.md (generated from this file). The UI, the API, the audit log and the
// publication mapping all use these words and no others.

export type Term = { label: string; meaning: string };

// ---------------------------------------------------------------- record states

export const RECORD_STATES = [
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
  "adopted",
  "verified",
  "approved",
  "rejected",
  "publication_authorised",
  "publishing",
  "published",
  "publication_failed",
  "correction_in_progress",
  "withdrawn",
  "archived",
  "public_withdrawn",
] as const;
export type RecordState = (typeof RECORD_STATES)[number];

export const RECORD_STATE: Record<RecordState, Term> = {
  draft: { label: "Draft", meaning: "Being written. Visible to its author and to officers with access to the institution's drafts." },
  submitted: { label: "Submitted", meaning: "Sent for review. The author can no longer edit this version." },
  under_review: { label: "Under review", meaning: "A reviewer has taken the record and is examining this version." },
  revision_requested: { label: "Revision requested", meaning: "Returned to the author with reasons. A revised version goes back for review." },
  adopted: { label: "Adopted", meaning: "Decisions only: adopted by the body that took the decision, awaiting approval by a second officer." },
  verified: { label: "Verified", meaning: "Appointments only: the appointment has been checked by an officer other than the drafter." },
  approved: { label: "Approved", meaning: "Every required approval is recorded against this exact version. Not yet public." },
  rejected: { label: "Rejected", meaning: "Not approved, with reasons. Closed unless reopened under policy." },
  publication_authorised: { label: "Publication authorised", meaning: "A publishing officer has authorised release to the public record." },
  publishing: { label: "Publishing", meaning: "Sent to aletheiagov.org. Waiting for the portal to confirm." },
  published: { label: "Published", meaning: "Confirmed by aletheiagov.org. The public reference and content hash are fixed." },
  publication_failed: { label: "Publication failed", meaning: "The portal refused the publication. The reason is on the record; it can be corrected and retried." },
  correction_in_progress: { label: "Correction in progress", meaning: "A corrected version of a published record is going through review. The published version stays public meanwhile." },
  withdrawn: { label: "Withdrawn", meaning: "Withdrawn before publication, with a reason." },
  archived: { label: "Archived", meaning: "Closed and kept for the record. If it was published, it stays on aletheiagov.org." },
  public_withdrawn: {
    label: "Withdrawn from the public record",
    meaning: "Taken off aletheiagov.org with a reason. The page stays at its address with a withdrawal notice; the reference is never reused.",
  },
};

/** Which visual role a state uses (status colour plus glyph); never colour alone. */
export type StatusTone = "draft" | "review" | "returned" | "approved" | "published" | "danger" | "muted";
export const STATE_TONE: Record<RecordState, StatusTone> = {
  draft: "draft",
  submitted: "review",
  under_review: "review",
  revision_requested: "returned",
  adopted: "review",
  verified: "review",
  approved: "approved",
  rejected: "danger",
  publication_authorised: "approved",
  publishing: "review",
  published: "published",
  publication_failed: "danger",
  correction_in_progress: "returned",
  withdrawn: "muted",
  archived: "muted",
  public_withdrawn: "danger",
};

// ---------------------------------------------------------------- classification

export const CLASSIFICATIONS = ["public", "internal", "restricted", "confidential"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];
export const CLASSIFICATION: Record<Classification, Term> = {
  public: { label: "Public", meaning: "May be published once approved and authorised." },
  internal: { label: "Internal", meaning: "For officers of the government. Never published." },
  restricted: { label: "Restricted", meaning: "Only officers granted access to the owning institution's restricted records. Never published while restricted." },
  confidential: { label: "Confidential", meaning: "Named officers only. Every view is recorded in the audit register. Never published." },
};
/** Higher ranks are more sensitive; access to a rank includes the ranks below it. */
export const CLASSIFICATION_RANK: Record<Classification, number> = { public: 0, internal: 1, restricted: 2, confidential: 3 };

// ---------------------------------------------------------------- priority

export const PRIORITIES = ["routine", "priority", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY: Record<Priority, Term & { dueDays: number }> = {
  routine: { label: "Routine", meaning: "Due 14 days after assignment unless a date is set.", dueDays: 14 },
  priority: { label: "Priority", meaning: "Due 5 days after assignment unless a date is set.", dueDays: 5 },
  urgent: { label: "Urgent", meaning: "Due 1 day after assignment. Overdue items escalate to the institution's administrator.", dueDays: 1 },
};

// ---------------------------------------------------------------- accounts

export const ACCOUNT_STATES = ["invited", "active", "suspended", "revoked"] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];
export const ACCOUNT_STATE: Record<AccountState, Term> = {
  invited: { label: "Invited", meaning: "An invitation has been issued and not yet accepted." },
  active: { label: "Active", meaning: "Can sign in with a password, and an authenticator code if two-step sign-in is turned on." },
  suspended: { label: "Suspended", meaning: "Cannot sign in. Sessions ended. Can be reinstated." },
  revoked: { label: "Revoked", meaning: "Access ended permanently. The account remains in the record for audit." },
};

// ---------------------------------------------------------------- institutions (portal vocabulary)

export const INSTITUTION_STATES = ["proposed", "planned", "in_formation", "in_development", "recruiting", "established", "operational", "suspended", "archived"] as const;
export type InstitutionState = (typeof INSTITUTION_STATES)[number];
export const INSTITUTION_STATE: Record<InstitutionState, Term> = {
  proposed: { label: "Proposed", meaning: "Described in a draft framework only." },
  planned: { label: "Planned", meaning: "Approved for development; no work started." },
  in_formation: { label: "In formation", meaning: "People and work assigned; not yet functioning." },
  in_development: { label: "In development", meaning: "Active work under way." },
  recruiting: { label: "Recruiting", meaning: "Actively seeking founding contributors." },
  established: { label: "Established", meaning: "Established within the founding framework." },
  operational: { label: "Operational", meaning: "Verified to be functioning, with evidence on record." },
  suspended: { label: "Suspended", meaning: "Work paused." },
  archived: { label: "Archived", meaning: "No longer active; kept for the record." },
};

// ---------------------------------------------------------------- publication

export const PUBLICATION_STATES = ["pending", "confirmed", "failed", "needs_reconciliation"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];
export const PUBLICATION_STATE: Record<PublicationState, Term> = {
  pending: { label: "Pending", meaning: "Queued or sent; no answer from the portal yet." },
  confirmed: { label: "Confirmed", meaning: "The portal confirmed the publication and returned its receipt." },
  failed: { label: "Failed", meaning: "The portal refused the publication, with a reason." },
  needs_reconciliation: { label: "Needs reconciliation", meaning: "The answer was lost or unclear. The portal is asked what happened before anything is retried." },
};

export function label<K extends string>(terms: Record<K, Term>, key: K): string {
  return terms[key].label;
}
