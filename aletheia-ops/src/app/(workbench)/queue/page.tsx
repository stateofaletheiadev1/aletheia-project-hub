import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRegister, PageHeader, SectionMark } from "@/components/ui/feedback";
import { Reference } from "@/components/ui/Reference";
import { ClassificationTag, StatusTag } from "@/components/ui/tags";
import { Timestamp } from "@/components/ui/Timestamp";
import { institutionName } from "@/domain/labels";
import { placeholderReference, REGISTER } from "@/domain/registers";
import { cx } from "@/lib/cx";
import { formatDue } from "@/lib/time";
import { queueFor } from "@/services/records/records";
import { definitionById } from "@/workflow/definitions";
import { dueAt } from "@/workflow/engine";
import { ACTION_LABEL } from "@/workflow/types";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

// My queue (brief §18.2): every record waiting for a step this official may take now, worked
// out from the records themselves, so it is never out of date. Oldest first.

export const metadata: Metadata = { title: "My queue" };

export default async function QueuePage() {
  const { official, actor } = await requireOfficial();
  const items = await queueFor(await requireDeps(), actor);
  const now = new Date();
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader overline={<SectionMark n="W2">Work</SectionMark>} title="My queue" lede="Records waiting for a step you may take now, oldest first." />
      {items.length === 0 ? (
        <EmptyRegister title="Nothing is waiting for you.">
          <p>Drafts to submit, submissions to review, and versions to approve or release will appear here as soon as they reach you.</p>
        </EmptyRegister>
      ) : (
        <ol className="grid border-t border-rule-strong">
          {items.map(({ record: r, offers }, i) => {
            const def = definitionById(r.workflowId);
            const due = def ? dueAt(def, r.state, new Date(r.stateEnteredAt)) : null;
            const d = due ? formatDue(due, now) : null;
            const info = REGISTER[r.register];
            return (
              <li key={r.id} className="group relative grid gap-x-6 gap-y-2 border-b border-rule py-5 md:grid-cols-12">
                <span aria-hidden className="tnum hidden text-h3 text-ink-3 md:col-span-1 md:block">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 md:col-span-8">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Reference value={r.reference ?? placeholderReference(info.referenceType)} />
                    <span className="text-meta text-ink-2">{info.label}</span>
                    <StatusTag state={r.state} />
                    {r.classification !== "public" ? <ClassificationTag value={r.classification} /> : null}
                  </div>
                  <h2 className="mt-1.5 text-h3 text-ink">
                    <Link href={`/records/${r.register}/${r.id}`} className="after:absolute after:inset-0 group-hover:text-authority">
                      {r.draft.title || "Untitled"}
                    </Link>
                  </h2>
                  <p className="mt-1 text-meta text-ink-2">
                    {institutionName(r.institution)} · at this stage since <Timestamp at={r.stateEnteredAt} now={now} timeZone={official.timezone} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:col-span-3 md:flex-col md:items-end md:justify-center md:text-right">
                  <span className="text-ui font-semibold whitespace-nowrap text-authority">{ACTION_LABEL[offers[0]!.action].replace("{noun}", info.noun)}</span>
                  {d ? <span className={cx("text-meta", d.overdue ? "font-semibold text-status-danger" : "text-ink-2")}>{d.text}</span> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
