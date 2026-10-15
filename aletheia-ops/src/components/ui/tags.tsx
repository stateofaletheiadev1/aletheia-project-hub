import {
  CLASSIFICATION,
  PRIORITY,
  RECORD_STATE,
  STATE_TONE,
  type Classification,
  type Priority,
  type RecordState,
  type StatusTone,
} from "@/domain/glossary";
import { cx } from "@/lib/cx";

// Status, classification and priority tags (brief §10.2, §13.3). Squared, quiet, and never
// colour alone: every status has its own glyph, drawn so it reads in greyscale (as the
// portal's status seals do). "Published" is the one moment of ceremony: the seal-gold mark.

const TONE_CLASS: Record<StatusTone, string> = {
  draft: "bg-status-draft-tint text-status-draft",
  review: "bg-status-review-tint text-status-review",
  returned: "bg-status-returned-tint text-status-returned",
  approved: "bg-status-approved-tint text-status-approved",
  published: "bg-sheet text-status-published ring-1 ring-inset ring-seal",
  danger: "bg-status-danger-tint text-status-danger",
  muted: "bg-sunken text-status-muted",
};

function Glyph({ state }: { state: RecordState }) {
  const ring = <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.3" />;
  switch (state) {
    case "draft":
      return <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 1.6" />;
    case "submitted":
      return (
        <>
          {ring}
          <path d="M6 1.25a4.75 4.75 0 0 1 4.75 4.75H6z" fill="currentColor" />
        </>
      );
    case "under_review":
    case "publishing":
      return (
        <>
          {ring}
          <path d="M6 1.25a4.75 4.75 0 0 1 0 9.5z" fill="currentColor" />
        </>
      );
    case "adopted":
    case "verified":
      return (
        <>
          {ring}
          <path d="M6 6V1.25A4.75 4.75 0 1 1 1.25 6z" fill="currentColor" />
        </>
      );
    case "revision_requested":
    case "correction_in_progress":
      return (
        <>
          {ring}
          <path d="M7.4 3.6 5 6l2.4 2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </>
      );
    case "approved":
    case "publication_authorised":
      return (
        <>
          <circle cx="6" cy="6" r="5.25" fill="currentColor" />
          <path d="M3.6 6.1 5.3 7.8l3.1-3.5" fill="none" stroke="var(--c-sheet)" strokeWidth="1.3" />
        </>
      );
    case "published":
      return (
        <>
          <circle cx="6" cy="6" r="5.5" fill="var(--c-seal)" />
          <path d="M3.6 6.1 5.3 7.8l3.1-3.5" fill="none" stroke="var(--c-masthead)" strokeWidth="1.4" />
        </>
      );
    case "rejected":
    case "publication_failed":
    case "public_withdrawn":
      return (
        <>
          {ring}
          <path d="m4.1 4.1 3.8 3.8m0-3.8L4.1 7.9" stroke="currentColor" strokeWidth="1.3" />
        </>
      );
    case "withdrawn":
    case "archived":
      return (
        <>
          {ring}
          <path d="M3.4 6h5.2" stroke="currentColor" strokeWidth="1.3" />
        </>
      );
  }
}

export function StatusTag({ state, className }: { state: RecordState; className?: string }) {
  const tone = STATE_TONE[state];
  return (
    <span
      className={cx("inline-flex h-6 items-center gap-1.5 rounded-xs px-2 text-meta font-semibold whitespace-nowrap", TONE_CLASS[tone], className)}
      title={RECORD_STATE[state].meaning}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
        <Glyph state={state} />
      </svg>
      <span className="sr-only">Status: </span>
      {RECORD_STATE[state].label}
    </span>
  );
}

const CLASS_STYLE: Record<Classification, string> = {
  public: "text-class-public border-class-public",
  internal: "text-class-internal border-class-internal",
  restricted: "text-class-restricted border-class-restricted",
  confidential: "bg-class-confidential-tint text-class-confidential border-class-confidential",
};

/** Classification: an outlined caps label, distinct in shape from status tags. */
export function ClassificationTag({ value, className }: { value: Classification; className?: string }) {
  return (
    <span
      className={cx("caps inline-flex h-5 items-center rounded-xs border px-1.5 whitespace-nowrap", value !== "public" && "border-dashed", CLASS_STYLE[value], className)}
      title={CLASSIFICATION[value].meaning}
    >
      <span className="sr-only">Classification: </span>
      {CLASSIFICATION[value].label}
    </span>
  );
}

/** Priority: routine says nothing; priority and urgent say so in words, with a mark. */
export function PriorityMark({ value, className }: { value: Priority; className?: string }) {
  if (value === "routine") return <span className={cx("text-meta text-ink-3", className)}>{PRIORITY.routine.label}</span>;
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-meta font-semibold", value === "urgent" ? "text-status-danger" : "text-status-returned", className)}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        {value === "urgent" ? <path d="M5 1 9.5 9h-9z" fill="currentColor" /> : <path d="M5 1.5 9 8.5H1z" fill="none" stroke="currentColor" strokeWidth="1.3" />}
      </svg>
      {PRIORITY[value].label}
    </span>
  );
}
