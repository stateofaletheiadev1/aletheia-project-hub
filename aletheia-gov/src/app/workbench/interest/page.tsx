import Link from "next/link";
import { StatusPill, WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { POSITION_SLUGS, POSITION_TYPES, positionName } from "@/content/positions";
import { ANY_INSTITUTION, INTEREST_INSTITUTIONS, institutionName } from "@/features/interest/schema";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABEL } from "@/lib/application-status";
import { formatDateShort } from "@/lib/dates";
import { requirePermission } from "@/server/auth/current-user";
import { audit } from "@/server/services/audit";
import { listRegistrations } from "@/server/services/workbench";

export const metadata = { title: "Registrations of interest" };
const PAGE_SIZE = 25;

export default async function InterestList(props: PageProps<"/workbench/interest">) {
  const user = await requirePermission("interest.read");
  const q = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const institution = [ANY_INSTITUTION, ...INTEREST_INSTITUTIONS.map((i) => i.slug)].includes(one(q.institution)) ? one(q.institution) : "";
  const positionType = (POSITION_SLUGS as string[]).includes(one(q.type)) ? one(q.type) : "";
  const status = (APPLICATION_STATUSES as readonly string[]).includes(one(q.status)) ? one(q.status) : "";
  const page = Math.max(1, Math.min(400, Number(one(q.page)) || 1));

  const { rows, total, hasMore } = await listRegistrations({ institution, positionType, status, page, pageSize: PAGE_SIZE });
  await audit({ actorId: user.id, action: "interest.list", target: null, outcome: "success", details: { institution: institution || "all", type: positionType || "all", status: status || "all", page, rows: rows.length } });

  const href = (p: number) => `/workbench/interest?${new URLSearchParams({ ...(institution && { institution }), ...(positionType && { type: positionType }), ...(status && { status }), page: String(p) })}`;
  const select = "mt-1.5 block border-0 border-b border-[var(--rule-ledger)] bg-transparent py-2 pr-8 text-[0.9375rem] focus:border-navy-800 focus:ring-0";

  return (
    <>
      <WorkbenchHeading eyebrow="Recruitment" title="Registrations of interest">
        People interested in founding roles and other positions in the institutions. Names and contact details are decrypted for this view; every view is recorded in the audit log.
      </WorkbenchHeading>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-6">
        <label className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
          Institution
          <select name="institution" defaultValue={institution} className={select}>
            <option value="">All institutions</option>
            <option value={ANY_INSTITUTION}>{institutionName(ANY_INSTITUTION)}</option>
            {INTEREST_INSTITUTIONS.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
          Kind of position
          <select name="type" defaultValue={positionType} className={select}>
            <option value="">All kinds</option>
            {POSITION_TYPES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
          Status
          <select name="status" defaultValue={status} className={select}>
            <option value="">Any status</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 border border-navy-800 px-4 text-[0.875rem] font-semibold text-navy-800 hover:bg-navy-800 hover:text-parchment-50">
          Apply
        </button>
        <p className="ml-auto t-ref text-ink-500">{total} found</p>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] border-collapse text-left text-[0.9375rem]">
          <caption className="sr-only">Registrations of interest, newest first</caption>
          <thead>
            <tr className="border-b-2 border-navy-800 text-[0.6875rem] uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="py-3 pr-4 font-semibold">Reference</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Name</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Positions</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Institutions</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Expertise</th>
              <th scope="col" className="py-3 pr-4 font-semibold">CV</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Received</th>
              <th scope="col" className="py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-ink-600">
                  No registrations match.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.reference} className="border-b border-[var(--rule-ledger)] align-top hover:bg-parchment-100">
                  <td className="py-3.5 pr-4">
                    <Link href={`/workbench/interest/${r.reference}`} className="t-ref text-gold-700 underline decoration-[var(--rule-ledger)] underline-offset-4 hover:decoration-gold-700">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-4 font-medium">{r.name}</td>
                  <td className="max-w-[14rem] py-3.5 pr-4 text-ink-700">
                    {r.opportunities.length ? <span className="t-ref block text-gold-700">{r.opportunities.map((o) => o.reference).join(", ")}</span> : null}
                    {r.positionTypes.map(positionName).join(", ")}
                  </td>
                  <td className="max-w-[18rem] py-3.5 pr-4 text-ink-700">
                    {r.institutions.slice(0, 2).map(institutionName).join(", ")}
                    {r.institutions.length > 2 ? <span className="text-ink-500"> +{r.institutions.length - 2} more</span> : null}
                  </td>
                  <td className="py-3.5 pr-4 text-ink-700">{r.expertise.join(", ")}</td>
                  <td className="py-3.5 pr-4">{r.cvs.length ? "PDF" : <span className="text-ink-500">—</span>}</td>
                  <td className="py-3.5 pr-4 t-ref text-ink-600">{formatDateShort(r.submittedAt)}</td>
                  <td className="py-3.5">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pages" className="mt-6 flex items-center gap-6 text-[0.875rem]">
        {page > 1 ? (
          <Link href={href(page - 1)} className="link-ledger">
            ← Newer
          </Link>
        ) : null}
        <span className="text-ink-500">Page {page}</span>
        {hasMore ? (
          <Link href={href(page + 1)} className="link-ledger">
            Older →
          </Link>
        ) : null}
      </nav>
    </>
  );
}
