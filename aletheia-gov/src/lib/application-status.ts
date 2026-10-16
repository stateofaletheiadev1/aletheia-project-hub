// The statuses of an application (registration of interest), shared with the operations
// workbench, which reads and changes them through /api/applications. One list, one meaning,
// in both places. "new" is kept as the stored value of Received for older records.

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
