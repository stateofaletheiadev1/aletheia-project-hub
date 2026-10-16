import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/patterns/ActionForm";
import { InlineAlert, PageHeader, SectionMark } from "@/components/ui/feedback";
import { Choice } from "@/components/ui/form";
import { Timestamp } from "@/components/ui/Timestamp";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABEL } from "@/domain/applications";
import { POSITION_TYPES } from "@/domain/content";
import { institutionName } from "@/domain/labels";
import { env } from "@/lib/env";
import { can } from "@/policy/roles";
import { applications } from "@/server/runtime";
import { requirePermission } from "@/server/session";
import { setStatusAction } from "../actions";
import { StatusMark } from "../StatusMark";

export const metadata: Metadata = { title: "Application" };

const positionName = (slug: string) => POSITION_TYPES.find((p) => p.slug === slug)?.name ?? slug;
const institution = (slug: string) => (slug === "any" ? "Any institution" : institutionName(slug));

export default async function ApplicationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { official, actor } = await requirePermission("application.read");
  const { reference } = await params;
  if (!/^AGV-EOI-\d{4}-\d{4,}$/.test(reference)) notFound();
  const gw = applications();
  const a = gw ? await gw.get(actor.id, reference) : { unavailable: "the connection to aletheiagov.org is not configured here" };
  if (a === null) notFound();
  const tz = official.timezone;
  const portal = env().PORTAL_BASE_URL.replace(/\/$/, "");

  const back = (
    <p className="text-meta">
      <Link href="/applications" className="link font-semibold">
        ← All applications
      </Link>
    </p>
  );
  if ("unavailable" in a) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6">
        {back}
        <InlineAlert tone="danger" title="This application cannot be shown just now">
          The workbench could not read it: {a.unavailable}. It is held on aletheiagov.org and nothing has been lost. Try again shortly.
        </InlineAlert>
      </div>
    );
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 border-b border-rule py-3 sm:grid-cols-12 sm:gap-6">
      <dt className="caps text-ink-2 sm:col-span-3">{label}</dt>
      <dd className="text-ui text-ink sm:col-span-9">{value}</dd>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      {back}
      <PageHeader
        overline={<SectionMark n="R7">{a.reference}</SectionMark>}
        title={a.name}
        lede={a.email ? <a href={`mailto:${a.email}`} className="link">{a.email}</a> : undefined}
        meta={
          <p className="text-meta text-ink-2">
            <StatusMark status={a.status} /> · Received <Timestamp at={a.submittedAt} mode="date" timeZone={tz} /> · Held on aletheiagov.org
          </p>
        }
      />

      <div className="grid gap-10 xl:grid-cols-12">
        <dl className="border-t border-rule-strong xl:col-span-8">
          {a.opportunities.length
            ? row(
                "Applied for",
                <ul className="grid gap-1">
                  {a.opportunities.map((o) => (
                    <li key={o.reference}>
                      <a className="link tnum font-semibold" href={`${portal}/opportunities/${o.reference.toLowerCase()}`} target="_blank" rel="noreferrer">
                        {o.reference}
                      </a>{" "}
                      <span className="text-meta text-ink-2">
                        on <Timestamp at={o.appliedAt} mode="date" timeZone={tz} />
                      </span>
                    </li>
                  ))}
                </ul>,
              )
            : null}
          {row("Kinds of position", a.positionTypes.map(positionName).join(", "))}
          {row("Institutions", a.institutions.map(institution).join(", "))}
          {row("Expertise", a.expertise.join(", ") || "—")}
          {row(
            "Notes",
            a.notes.length ? (
              <ul className="grid gap-3">
                {a.notes.map((n, i) => (
                  <li key={i}>
                    <p className="whitespace-pre-line">{n.text}</p>
                    <p className="mt-1 text-meta text-ink-2">
                      <Timestamp at={n.at} mode="date" timeZone={tz} />
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-3">None</span>
            ),
          )}
          {row(
            "CV",
            a.cvs.length ? (
              <ul className="grid gap-2">
                {a.cvs.map((cv) => (
                  <li key={cv.fileId}>
                    <a className="link font-semibold" href={`/applications/${a.reference}/cv/${cv.fileId}`}>
                      Download PDF
                    </a>{" "}
                    <span className="text-meta text-ink-2">
                      {(cv.size / 1024).toFixed(0)} KB · uploaded <Timestamp at={cv.uploadedAt} mode="date" timeZone={tz} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-3">Not provided</span>
            ),
          )}
          {row(
            "Status history",
            a.statusHistory.length ? (
              <ol className="grid gap-1">
                {a.statusHistory.map((h, i) => (
                  <li key={i}>
                    <span className="font-semibold">{APPLICATION_STATUS_LABEL[h.status]}</span>
                    <span className="text-meta text-ink-2">
                      {" "}
                      · {h.byName} · {h.via === "ops" ? "in the workbench" : "in the portal's staff area"} · <Timestamp at={h.at} timeZone={tz} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <span className="text-ink-3">Received; not changed since</span>
            ),
          )}
          {row("Deleted after", <Timestamp at={a.retainUntil} mode="date" timeZone={tz} />)}
        </dl>

        {can(actor, "application.update") ? (
          <section aria-labelledby="status" className="border-t-2 border-authority pt-4 xl:col-span-4">
            <h2 id="status" className="text-h3 text-ink">
              Status
            </h2>
            <p className="mt-1 text-meta text-ink-2">Changed here, it changes on aletheiagov.org too, for everyone.</p>
            <ActionForm action={setStatusAction} submit="Save status" variant="primary" className="mt-4">
              <input type="hidden" name="reference" value={a.reference} />
              <input type="hidden" name="rev" value={a._rev} />
              <input type="hidden" name="from" value={a.status} />
              <fieldset className="grid gap-2">
                <legend className="sr-only">Status</legend>
                {APPLICATION_STATUSES.map((s) => (
                  <Choice key={s} type="radio" name="status" value={s} defaultChecked={a.status === s} label={APPLICATION_STATUS_LABEL[s]} />
                ))}
              </fieldset>
            </ActionForm>
          </section>
        ) : null}
      </div>
    </div>
  );
}
