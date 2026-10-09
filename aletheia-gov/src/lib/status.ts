// The status taxonomy of brief §5.2. Shared by every record and rendered by StatusSeal.
export const INSTITUTIONAL_STATUSES = [
  "proposed",
  "planned",
  "in_formation",
  "in_development",
  "recruiting",
  "established",
  "operational",
  "suspended",
  "archived",
] as const;

export type InstitutionalStatus = (typeof INSTITUTIONAL_STATUSES)[number];

export const STATUS_META: Record<InstitutionalStatus, { label: string; meaning: string }> = {
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

/** `operational` is only valid with an evidence reference (brief §5.2). */
export function assertStatusEvidence(status: InstitutionalStatus, evidence?: string): void {
  if (status === "operational" && !evidence) {
    throw new Error("Status 'operational' requires an evidence reference");
  }
}
