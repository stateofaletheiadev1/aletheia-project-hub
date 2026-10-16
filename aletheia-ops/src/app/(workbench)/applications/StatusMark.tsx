import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/domain/applications";
import { cx } from "@/lib/cx";

const TONE: Record<ApplicationStatus, string> = {
  new: "text-status-review",
  contacted: "text-authority",
  shortlisted: "text-status-returned",
  offered: "text-status-returned",
  appointed: "text-status-approved",
  not_progressed: "text-status-muted",
  archived: "text-status-muted",
};

/** An application's status, in the same words as aletheiagov.org's staff area. */
export function StatusMark({ status, className }: { status: ApplicationStatus; className?: string }) {
  return <span className={cx("text-meta font-semibold", TONE[status], className)}>{APPLICATION_STATUS_LABEL[status]}</span>;
}
