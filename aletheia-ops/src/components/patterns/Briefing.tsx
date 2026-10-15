import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Classification, Priority, RecordState } from "@/domain/glossary";
import { REGISTER, type Register } from "@/domain/registers";
import { cx } from "@/lib/cx";
import { DEFAULT_TIMEZONE, formatDue, formatEdition, formatTime } from "@/lib/time";
import { Contours } from "../brand/Contours";
import { InlineAlert, SectionMark } from "../ui/feedback";
import { Reference } from "../ui/Reference";
import { ClassificationTag, PriorityMark, StatusTag } from "../ui/tags";
import { Timestamp } from "../ui/Timestamp";

// The Briefing (brief §13.2.1, §18.1): an editorial composition, not a dashboard. In order of
// importance: what needs this official; what is due; what is moving through their institution;
// what reached the public record. Warnings only when real. Every figure links to the register
// behind it, and every figure is computed from records the official may see.

export type ActionItem = {
  id: string;
  href: string;
  reference: string;
  register: Register;
  title: string;
  institution: string;
  classification: Classification;
  priority: Priority;
  action: string;
  since: string;
  dueAt?: string;
};

export type MovingItem = { id: string; href: string; reference: string; title: string; state: RecordState; assignee: string; updatedAt: string };
export type PublishedItem = { id: string; reference: string; title: string; register: Register; publicUrl: string; publishedAt: string };
export type Warning = { id: string; title: string; detail: string; href: string; tone: "warning" | "danger" };

export function Briefing({
  official,
  institution,
  now,
  timeZone = DEFAULT_TIMEZONE,
  actions,
  due,
  moving,
  published,
  warnings,
  inFormation,
}: {
  official: { name: string; role: string };
  institution: { name: string; status: string } | null;
  now: Date;
  timeZone?: string;
  actions: ActionItem[];
  due: ActionItem[];
  moving: MovingItem[];
  published: PublishedItem[];
  warnings: Warning[];
  /** True when the institution has no records at all: the briefing says so plainly. */
  inFormation: boolean;
}) {
  const overdue = due.filter((d) => d.dueAt && new Date(d.dueAt) < now).length;
  return (
    <div className="mx-auto max-w-7xl">
      <header className="relative -mx-4 -mt-6 mb-10 overflow-hidden border-b border-rule bg-sunken px-4 pt-8 pb-7 md:-mx-8 md:-mt-8 md:px-8 xl:-mx-12 xl:px-12">
        <Contours variant="b" tone="ink" opacity={0.06} />
        <div className="relative">
          <p className="caps text-ink-2">
            Briefing for {official.name}, {official.role}
            {institution ? <span className="text-ink-3"> · {institution.name}</span> : null}
          </p>
          <h1 className="mt-2 text-display text-ink">{formatEdition(now, timeZone)}</h1>
          <p className="mt-2 text-ui text-ink-2">
            As of <time dateTime={now.toISOString()}>{formatTime(now, timeZone)}</time>.{" "}
            {actions.length === 0 ? "Nothing needs your action." : `${actions.length} ${actions.length === 1 ? "item needs" : "items need"} your action`}
            {actions.length > 0 && overdue > 0 ? <span className="font-semibold text-status-danger">, {overdue} overdue</span> : null}
            {actions.length > 0 ? "." : null}
          </p>
        </div>
      </header>

      {warnings.length > 0 ? (
        <section aria-label="Warnings" className="mb-10 grid gap-3">
          {warnings.map((w) => (
            <InlineAlert
              key={w.id}
              tone={w.tone}
              title={w.title}
              action={
                <Link href={w.href} className="link text-ui font-semibold">
                  Open the record
                </Link>
              }
            >
              {w.detail}
            </InlineAlert>
          ))}
        </section>
      ) : null}

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-12">
        <div className="grid content-start gap-12 xl:col-span-8">
          <section aria-labelledby="b-action">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule-strong pb-3">
              <div>
                <SectionMark n="01">Requires your action</SectionMark>
                <h2 id="b-action" className="mt-2 text-h2 text-ink">
                  {actions.length === 0 ? "Nothing is waiting for you" : `${actions.length} ${actions.length === 1 ? "record is" : "records are"} waiting for you`}
                </h2>
              </div>
              {actions.length > 0 ? (
                <Link href="/queue" className="link shrink-0 text-ui font-semibold">
                  My queue
                </Link>
              ) : null}
            </div>
            {actions.length === 0 ? (
              <p className="py-6 text-body font-normal text-ink-2 measure">
                {inFormation
                  ? "Your institution has no records yet. When a draft is submitted for your review or approval it will appear here first, with what is asked of you and by when."
                  : "When a record is submitted for your review, returned to you, or waiting for your approval, it will appear here first."}
              </p>
            ) : (
              <ol className="grid">
                {actions.map((a, i) => {
                  const d = a.dueAt ? formatDue(new Date(a.dueAt), now) : null;
                  return (
                    <li key={a.id} className="group relative grid gap-x-6 gap-y-2 border-b border-rule py-5 md:grid-cols-12">
                      <span aria-hidden className="tnum hidden text-h3 text-ink-3 md:col-span-1 md:block">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 md:col-span-8">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Reference value={a.reference} />
                          <span className="text-meta text-ink-2">{REGISTER[a.register].label}</span>
                          {a.classification !== "public" ? <ClassificationTag value={a.classification} /> : null}
                        </div>
                        <h3 className="mt-1.5 text-h3 text-ink">
                          <Link href={a.href} className="after:absolute after:inset-0 group-hover:text-authority">
                            {a.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-meta text-ink-2">{a.institution}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:col-span-3 md:flex-col md:items-end md:justify-center md:text-right">
                        <span className="inline-flex items-center gap-1.5 text-ui font-semibold whitespace-nowrap text-authority">
                          {a.action}
                          <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="transition-transform duration-(--dur-base) group-hover:translate-x-0.5" />
                        </span>
                        {d ? <span className={cx("text-meta", d.overdue ? "font-semibold text-status-danger" : "text-ink-2")}>{d.text}</span> : null}
                        {a.priority !== "routine" ? <PriorityMark value={a.priority} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section aria-labelledby="b-moving">
            <div className="border-b border-rule-strong pb-3">
              <SectionMark n="03">Moving through {institution ? "your institution" : "your institutions"}</SectionMark>
              <h2 id="b-moving" className="mt-2 text-h2 text-ink">
                In progress
              </h2>
            </div>
            {moving.length === 0 ? (
              <p className="py-6 text-body font-normal text-ink-2 measure">No records are in progress. Drafts, reviews and approvals will be listed here as they move.</p>
            ) : (
              <table className="w-full text-ui">
                <caption className="sr-only">Records in progress</caption>
                <thead>
                  <tr className="border-b border-rule">
                    <th scope="col" className="caps h-9 pr-3 text-left text-ink-2">
                      Reference
                    </th>
                    <th scope="col" className="caps h-9 px-3 text-left text-ink-2">
                      Title
                    </th>
                    <th scope="col" className="caps hidden h-9 px-3 text-left text-ink-2 md:table-cell">
                      Stage
                    </th>
                    <th scope="col" className="caps hidden h-9 pl-3 text-right text-ink-2 lg:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {moving.map((m) => (
                    <tr key={m.id} className="border-b border-rule">
                      <td className="py-3 pr-3 align-top">
                        <Reference value={m.reference} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Link href={m.href} className="font-semibold text-ink hover:text-authority">
                          {m.title}
                        </Link>
                        <p className="text-meta text-ink-2">{m.assignee}</p>
                        <StatusTag state={m.state} className="mt-1.5 md:hidden" />
                      </td>
                      <td className="hidden px-3 py-3 align-top md:table-cell">
                        <StatusTag state={m.state} />
                      </td>
                      <td className="hidden py-3 pl-3 text-right align-top text-meta text-ink-2 lg:table-cell">
                        <Timestamp at={m.updatedAt} now={now} timeZone={timeZone} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="grid content-start gap-12 xl:col-span-4">
          <section aria-labelledby="b-due">
            <div className="border-b border-rule-strong pb-3">
              <SectionMark n="02">Due and overdue</SectionMark>
              <h2 id="b-due" className="mt-2 text-h3 text-ink">
                Next seven days
              </h2>
            </div>
            {due.length === 0 ? (
              <p className="py-4 text-ui font-normal text-ink-2">Nothing is due in the next seven days.</p>
            ) : (
              <ul className="grid">
                {due.map((d) => {
                  const f = formatDue(new Date(d.dueAt!), now);
                  return (
                    <li key={d.id} className="border-b border-rule py-3">
                      <Link href={d.href} className="group grid gap-0.5">
                        <span className={cx("text-meta", f.overdue ? "font-semibold text-status-danger" : "text-ink-2")}>{f.text}</span>
                        <span className="text-ui font-semibold text-ink group-hover:text-authority">{d.title}</span>
                        <span className="text-meta text-ink-3">
                          {d.action} · {d.institution}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="b-published">
            <div className="border-b border-rule-strong pb-3">
              <SectionMark n="04">The public record</SectionMark>
              <h2 id="b-published" className="mt-2 text-h3 text-ink">
                Recently published
              </h2>
            </div>
            {published.length === 0 ? (
              <div className="py-4">
                <p className="ref text-ink-3">AGV-···-····-····</p>
                <p className="mt-2 text-ui font-normal text-ink-2">Nothing published yet. Records appear on aletheiagov.org only once approved and released by a publishing officer.</p>
              </div>
            ) : (
              <ul className="grid">
                {published.map((p) => (
                  <li key={p.id} className="border-b border-rule py-3">
                    <p className="flex items-center gap-2">
                      <span aria-hidden className="size-1.5 rounded-full bg-seal" />
                      <Reference value={p.reference} href={p.publicUrl} />
                    </p>
                    <p className="mt-0.5 text-ui font-semibold text-ink">{p.title}</p>
                    <p className="text-meta text-ink-2">
                      {REGISTER[p.register].label} · <Timestamp at={p.publishedAt} now={now} timeZone={timeZone} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
