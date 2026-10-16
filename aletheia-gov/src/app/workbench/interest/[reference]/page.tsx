import { positionName } from "@/content/positions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ActionForm } from "@/components/workbench/ActionForm";
import { CvPreview } from "@/components/workbench/CvPreview";
import { StatusPill, WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { institutionName } from "@/features/interest/schema";
import { setInterestStatus } from "@/features/workbench/actions";
import { formatDateLong } from "@/lib/dates";
import { requirePermission } from "@/server/auth/current-user";
import { can } from "@/server/authorization/policies";
import { audit } from "@/server/services/audit";
import { getRegistration } from "@/server/services/workbench";

export const metadata = { title: "Registration" };

export default async function RegistrationDetail(props: PageProps<"/workbench/interest/[reference]">) {
  const user = await requirePermission("interest.read");
  const { reference } = await props.params;
  const r = await getRegistration(reference);
  if (!r) notFound();
  await audit({ actorId: user.id, action: "interest.view", target: { type: "interest", id: r.reference }, outcome: "success" });
  const canUpdate = can({ id: user.id, roles: user.roles }, "interest.update");
  const canDownload = can({ id: user.id, roles: user.roles }, "cv.download");

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 border-b border-[var(--rule-ledger)] py-3.5 sm:grid-cols-[12rem_1fr] sm:gap-6">
      <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</dt>
      <dd className="text-[1rem]">{value}</dd>
    </div>
  );

  return (
    <>
      <p className="mb-6 text-[0.875rem]">
        <Link href="/workbench/interest" className="link-ledger">
          ← All registrations
        </Link>
      </p>
      <WorkbenchHeading eyebrow={r.reference} title={r.name}>
        <span className="inline-flex items-center gap-3">
          <StatusPill status={r.status} /> Received {formatDateLong(r.submittedAt)}
        </span>
      </WorkbenchHeading>

      <div className="grid gap-12 xl:grid-cols-[1fr_20rem]">
        <dl className="border-t border-[var(--rule-ledger)]">
          {row("Email", r.email ? <a className="link-ledger" href={`mailto:${r.email}`}>{r.email}</a> : "—")}
          {r.opportunities.length
            ? row(
                "Applied for",
                <ul className="space-y-1">
                  {r.opportunities.map((o) => (
                    <li key={o.reference}>
                      <a className="link-ledger t-ref" href={`/opportunities/${o.reference.toLowerCase()}`}>
                        {o.reference}
                      </a>{" "}
                      <span className="text-ink-500">on {formatDateLong(o.appliedAt)}</span>
                    </li>
                  ))}
                </ul>,
              )
            : null}
          {row(
            "Kinds of position",
            <ul className="space-y-1">
              {r.positionTypes.map((s) => (
                <li key={s}>{positionName(s)}</li>
              ))}
            </ul>,
          )}
          {row(
            "Institutions",
            <ul className="space-y-1">
              {r.institutions.map((s) => (
                <li key={s}>{institutionName(s)}</li>
              ))}
            </ul>,
          )}
          {row("Expertise", r.expertise.join(", "))}
          {row(
            "Notes",
            r.notes.length ? (
              <ul className="space-y-3">
                {r.notes.map((n, i) => (
                  <li key={i}>
                    <p className="whitespace-pre-line">{n.text}</p>
                    <p className="mt-1 text-[0.8125rem] text-ink-500">{formatDateLong(n.at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-500">None</span>
            ),
          )}
          {row(
            "CV",
            r.cvs.length ? (
              <ul className="space-y-2">
                {r.cvs.map((cv) => (
                  <li key={cv.fileId}>
                    {canDownload ? (
                      <span className="mr-2 inline-flex flex-wrap items-center gap-x-5 gap-y-1">
                        <CvPreview
                          src={`/workbench/interest/${r.reference}/cv/${cv.fileId}?view=1`}
                          downloadHref={`/workbench/interest/${r.reference}/cv/${cv.fileId}`}
                          title={`CV of ${r.name} · ${r.reference}`}
                        />
                        <a className="link-ledger font-medium" href={`/workbench/interest/${r.reference}/cv/${cv.fileId}`}>
                          Download PDF
                        </a>
                      </span>
                    ) : (
                      "PDF"
                    )}{" "}
                    <span className="text-[0.8125rem] text-ink-500">
                      {(cv.size / 1024).toFixed(0)} KB · uploaded {formatDateLong(cv.uploadedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-500">Not provided</span>
            ),
          )}
          {row("Last updated", formatDateLong(r.updatedAt))}
          {row("Deleted after", `${formatDateLong(r.retainUntil)} (retention policy)`)}
        </dl>

        {canUpdate ? (
          <aside className="border-t-2 border-navy-800 pt-4">
            <h2 className="t-h3">Status</h2>
            <ActionForm action={setInterestStatus} submit="Save status">
              <input type="hidden" name="reference" value={r.reference} />
              <input type="hidden" name="rev" value={r._rev} />
              <fieldset className="mt-3 space-y-2">
                <legend className="sr-only">Status</legend>
                {(["new", "contacted", "archived"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-3 text-[0.9375rem] capitalize">
                    <input type="radio" name="status" value={s} defaultChecked={r.status === s} className="h-4 w-4 accent-[#15294A]" />
                    {s}
                  </label>
                ))}
              </fieldset>
            </ActionForm>
          </aside>
        ) : null}
      </div>
    </>
  );
}
