import type { ReactNode } from "react";
import { RECORD_STATE, type RecordState } from "@/domain/glossary";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/time";
import type { DiffPart } from "@/lib/diff";
import { Timestamp } from "../ui/Timestamp";

// The custody column of a folio (brief §8, §13.2, §23): the record's actual stages, the chain
// of countersignatures, comments, attachments and the publication receipt.

// ---------------------------------------------------------------- stepper

export type Stage = {
  state: RecordState;
  status: "done" | "current" | "upcoming";
  actor?: string;
  at?: string;
  note?: string;
};

export function Stepper({ stages, timeZone }: { stages: Stage[]; timeZone?: string }) {
  return (
    <ol className="grid" aria-label="Stages of this record">
      {stages.map((s, i) => (
        <li key={s.state} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.status === "current" ? "step" : undefined}>
          {i < stages.length - 1 ? (
            <span aria-hidden className={cx("absolute top-5 bottom-0 left-2.5 w-px -translate-x-1/2", s.status === "done" ? "bg-authority" : "bg-rule")} />
          ) : null}
          <span aria-hidden className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
            {s.status === "done" ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-authority">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M2.4 5.1 4.2 6.9 7.6 3.2" fill="none" stroke="var(--c-sheet)" strokeWidth="1.4" />
                </svg>
              </span>
            ) : s.status === "current" ? (
              <span className="flex size-4 items-center justify-center rounded-full border-2 border-authority bg-sheet">
                <span className="size-1.5 rounded-full bg-authority" />
              </span>
            ) : (
              <span className="size-3 rounded-full border border-rule-control bg-sheet" />
            )}
          </span>
          <div className="min-w-0">
            <p className={cx("text-ui", s.status === "upcoming" ? "font-medium text-ink-3" : "font-semibold text-ink")}>
              {RECORD_STATE[s.state].label}
              <span className="sr-only">{s.status === "done" ? " (completed)" : s.status === "current" ? " (current stage)" : " (not reached)"}</span>
            </p>
            {s.actor || s.at ? (
              <p className="text-meta text-ink-2">
                {s.actor}
                {s.actor && s.at ? " · " : null}
                {s.at ? <Timestamp at={s.at} mode="datetime" timeZone={timeZone} /> : null}
              </p>
            ) : null}
            {s.note ? <p className="mt-0.5 text-meta text-ink-2">{s.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- countersignature

export type Signature = {
  name: string;
  role: string;
  institution: string;
  decision: "approved" | "adopted" | "verified" | "revision_requested" | "rejected" | "authorised" | "published";
  at: string;
  version: number;
  versionHash: string;
  reason?: string;
};

const DECISION: Record<Signature["decision"], { label: string; tone: string }> = {
  approved: { label: "Approved", tone: "text-status-approved" },
  adopted: { label: "Adopted", tone: "text-status-review" },
  verified: { label: "Verified", tone: "text-status-review" },
  revision_requested: { label: "Requested revision", tone: "text-status-returned" },
  rejected: { label: "Rejected", tone: "text-status-danger" },
  authorised: { label: "Authorised publication", tone: "text-status-approved" },
  published: { label: "Released to the public record", tone: "text-status-published" },
};

/** One hand in the chain: a signature block, not a tick (brief §8 "Countersignature"). */
export function Countersignature({ s, timeZone }: { s: Signature; timeZone?: string }) {
  const d = DECISION[s.decision];
  return (
    <article className="border-t border-rule pt-3">
      <p className={cx("caps", d.tone)}>{d.label}</p>
      <p className="mt-1 text-ui font-semibold text-ink">{s.name}</p>
      <p className="text-meta text-ink-2">
        {s.role}, {s.institution}
      </p>
      {s.reason ? <p className="mt-2 border-l-2 border-rule pl-3 text-ui font-normal text-ink">{s.reason}</p> : null}
      <p className="mt-2 text-meta text-ink-3">
        <Timestamp at={s.at} mode="datetime" timeZone={timeZone} /> · version {s.version} ·{" "}
        <span className="tnum" title={`SHA-256 ${s.versionHash}`}>
          {s.versionHash.slice(0, 8)}…{s.versionHash.slice(-4)}
        </span>
      </p>
    </article>
  );
}

// ---------------------------------------------------------------- comments

export type Comment = { id: string; author: string; role: string; at: string; body: string; passage?: string };

export function CommentThread({ comments, timeZone, empty = "No comments on this version." }: { comments: Comment[]; timeZone?: string; empty?: string }) {
  if (comments.length === 0) return <p className="text-ui font-normal text-ink-3">{empty}</p>;
  return (
    <ol className="grid gap-4">
      {comments.map((c) => (
        <li key={c.id} className="grid gap-1">
          <p className="text-meta">
            <span className="font-semibold text-ink">{c.author}</span>
            <span className="text-ink-2">, {c.role}</span>
            <span className="text-ink-3">
              {" "}
              · <Timestamp at={c.at} timeZone={timeZone} />
            </span>
          </p>
          {c.passage ? <blockquote className="border-l-2 border-seal pl-3 text-meta text-ink-2">“{c.passage}”</blockquote> : null}
          <p className="text-ui font-normal text-ink">{c.body}</p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- attachments

export type Attachment = { id: string; name: string; type: string; bytes: number; scan: "clean" | "unscanned" | "infected" | "failed" };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const SCAN: Record<Attachment["scan"], { label: string; tone: string }> = {
  clean: { label: "Scanned, clean", tone: "text-status-approved" },
  unscanned: { label: "Not scanned", tone: "text-status-returned" },
  infected: { label: "Blocked: malware found", tone: "text-status-danger" },
  failed: { label: "Scan failed", tone: "text-status-danger" },
};

export function AttachmentRow({ a, action }: { a: Attachment; action?: ReactNode }) {
  const s = SCAN[a.scan];
  return (
    <div className="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink-3">
        <path d="M4 1.5h5.5L12.5 4.5v10h-8.5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M9.5 1.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ui font-semibold text-ink" title={a.name}>
          {a.name}
        </p>
        <p className="text-meta text-ink-2">
          <span className="uppercase">{a.type}</span> · <span className="tnum">{formatBytes(a.bytes)}</span> · <span className={cx("font-semibold", s.tone)}>{s.label}</span>
        </p>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- diff

export function DiffText({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="text-body font-normal">
      {parts.map((p, i) =>
        p.kind === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.kind === "added" ? (
          <ins key={i} className="bg-status-approved-tint text-status-approved underline decoration-status-approved underline-offset-4">
            <span className="sr-only">[added: </span>
            {p.text}
            <span className="sr-only">]</span>
          </ins>
        ) : (
          <del key={i} className="bg-status-danger-tint text-status-danger">
            <span className="sr-only">[removed: </span>
            {p.text}
            <span className="sr-only">]</span>
          </del>
        ),
      )}
    </p>
  );
}

// ---------------------------------------------------------------- publication receipt

export type Receipt = { reference: string; url: string; publishedAt: string; contentHash: string; simulated?: boolean; withdrawnAt?: string; withdrawalReason?: string };

/** The publication receipt, kept on the record (brief §12.1: never only a toast). */
export function PublicationReceipt({ r, timeZone }: { r: Receipt; timeZone?: string }) {
  return (
    <div className={cx("seal-in border-t-2 pt-3", r.simulated ? "border-status-returned" : "border-seal")}>
      <p className={cx("caps", r.simulated ? "text-status-returned" : "text-seal-ink")}>{r.simulated ? "Simulated receipt: not public" : "Publication receipt"}</p>
      <dl className="label-value mt-2 gap-x-4 gap-y-1.5 text-meta">
        <dt className="text-ink-2">Reference</dt>
        <dd className="ref text-ink">{r.reference}</dd>
        <dt className="text-ink-2">Published</dt>
        <dd className="text-ink">{formatDateTime(new Date(r.publishedAt), timeZone)}</dd>
        <dt className="text-ink-2">Content hash</dt>
        <dd className="tnum break-all text-ink" title="SHA-256">
          {r.contentHash}
        </dd>
        {r.withdrawnAt ? (
          <>
            <dt className="text-ink-2">Withdrawn</dt>
            <dd className="font-semibold text-status-danger">
              {formatDateTime(new Date(r.withdrawnAt), timeZone)}
              {r.withdrawalReason ? <span className="block font-normal text-ink-2">{r.withdrawalReason}</span> : null}
            </dd>
          </>
        ) : null}
        <dt className="text-ink-2">Public page</dt>
        <dd className="min-w-0">
          {r.simulated ? (
            <span className="text-ink-3">None. Publication is simulated in this environment.</span>
          ) : (
            <a href={r.url} className="link break-all" rel="noopener">
              {r.url.replace(/^https:\/\//, "")}
            </a>
          )}
        </dd>
      </dl>
    </div>
  );
}
