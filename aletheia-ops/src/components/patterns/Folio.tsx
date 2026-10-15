import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { ClassificationTag, StatusTag } from "../ui/tags";
import { Reference } from "../ui/Reference";
import type { Classification, RecordState } from "@/domain/glossary";

// The folio (brief §8, §13.2.3): the sheet — a header block of metadata, then the body — and
// beside it the custody column. On narrow screens the custody column follows the sheet.

export type FolioHeader = {
  reference: string;
  register: string;
  institution: string;
  classification: Classification;
  state: RecordState;
  version: number;
  versionNote?: string;
  author: string;
  title: string;
};

export function Folio({ header, body, custody, banner }: { header: FolioHeader; body: ReactNode; custody: ReactNode; banner?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-12 xl:gap-12">
      <article className="min-w-0 xl:col-span-8">
        {banner}
        <div className="border border-rule bg-sheet">
          <header className="border-b border-rule px-5 pt-5 pb-6 md:px-10 md:pt-8">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <Meta label="Reference">
                <Reference value={header.reference} />
              </Meta>
              <Meta label="Register">{header.register}</Meta>
              <Meta label="Status">
                <StatusTag state={header.state} />
              </Meta>
              <Meta label="Classification">
                <ClassificationTag value={header.classification} />
              </Meta>
              <Meta label="Institution" wide>
                {header.institution}
              </Meta>
              <Meta label="Version">
                <span className="tnum">{header.version}</span>
                {header.versionNote ? <span className="text-ink-2"> · {header.versionNote}</span> : null}
              </Meta>
              <Meta label="Author">{header.author}</Meta>
            </dl>
            {/* Long titles step down a size so the sheet keeps its proportions. */}
            <h1 className={cx("mt-8 text-ink text-balance", header.title.length > 90 ? "text-h2" : "text-h1")}>{header.title}</h1>
          </header>
          <div className="px-5 py-8 md:px-10 md:py-10">
            <div className="prose-record measure">{body}</div>
          </div>
        </div>
      </article>
      <aside aria-label="Custody of this record" className="flex min-w-0 flex-col gap-8 xl:col-span-4">
        {custody}
      </aside>
    </div>
  );
}

function Meta({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="caps text-ink-3">{label}</dt>
      <dd className="mt-1 text-ui font-medium text-ink">{children}</dd>
    </div>
  );
}

/** A titled block in the custody column. */
export function CustodySection({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule-strong pb-2">
        <h2 className="caps text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Publication eligibility: each condition named, met or not (brief §23). */
export function Eligibility({ conditions }: { conditions: { condition: string; met: boolean }[] }) {
  return (
    <ul className="grid gap-1.5">
      {conditions.map((c) => (
        <li key={c.condition} className="flex items-start gap-2.5 text-ui">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className={c.met ? "mt-0.5 shrink-0 text-status-approved" : "mt-0.5 shrink-0 text-ink-3"}>
            {c.met ? (
              <>
                <circle cx="7" cy="7" r="6" fill="currentColor" />
                <path d="M4.2 7.2 6 9l3.8-4" fill="none" stroke="var(--c-sheet)" strokeWidth="1.4" />
              </>
            ) : (
              <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.6" />
            )}
          </svg>
          <span className={c.met ? "text-ink" : "text-ink-2"}>
            <span className="sr-only">{c.met ? "Met: " : "Not met: "}</span>
            {c.condition}
          </span>
        </li>
      ))}
    </ul>
  );
}
