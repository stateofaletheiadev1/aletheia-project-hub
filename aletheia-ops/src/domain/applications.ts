// Applications (registrations of interest) are held on aletheiagov.org, not here (ADR 0011).
// The workbench reads and changes them through the portal's signed API, so a status set in
// either place is the status in both. This list mirrors aletheia-gov src/lib/application-status.ts;
// tests/unit/applications.test.ts pins it. "new" is the stored value of Received.

export const APPLICATION_STATUSES = ["new", "contacted", "shortlisted", "offered", "appointed", "not_progressed", "archived"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: "Received",
  contacted: "Contacted",
  shortlisted: "Shortlisted",
  offered: "Offered",
  appointed: "Appointed",
  not_progressed: "Not progressed",
  archived: "Archived",
};

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export type StatusChange = { status: ApplicationStatus; at: string; by: string; byName: string; via: "portal" | "ops" };

/** One application as the portal returns it. Names and emails are decrypted by the portal. */
export type Application = {
  _rev: number;
  reference: string;
  submittedAt: string;
  updatedAt: string;
  retainUntil: string;
  positionTypes: string[];
  opportunities: { reference: string; appliedAt: string }[];
  institutions: string[];
  expertise: string[];
  status: ApplicationStatus;
  statusHistory: StatusChange[];
  cvs: { fileId: string; name: string; size: number; uploadedAt: string }[];
  name: string;
  email: string;
  notes: { text: string; at: string }[];
};
