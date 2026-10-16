import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/patterns/FilterBar";
import { Pagination } from "@/components/patterns/Pagination";
import { EmptyRegister, InlineAlert, PageHeader, SectionMark } from "@/components/ui/feedback";
import { Timestamp } from "@/components/ui/Timestamp";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABEL, isApplicationStatus, type ApplicationStatus } from "@/domain/applications";
import { POSITION_TYPES } from "@/domain/content";
import { applications } from "@/server/runtime";
import { requirePermission } from "@/server/session";
import { StatusMark } from "./StatusMark";

// Applications (ADR 0011): held on aletheiagov.org and shown here through the portal's signed
// API, so this list and the portal's staff area always show the same people and statuses.

export const metadata: Metadata = { title: "Applications" };

const PAGE_SIZE = 50;
const positionName = (slug: string) => POSITION_TYPES.find((p) => p.slug === slug)?.name ?? slug;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { official, actor } = await requirePermission("application.read");
  const sp = await searchParams;
  const status: ApplicationStatus | undefined = isApplicationStatus(sp.status ?? "") ? (sp.status as ApplicationStatus) : undefined;
  const q = (sp.q ?? "").trim().toUpperCase();
  const opportunity = /^AGV-OPP-\d{4}-\d{4,}$/.test(q) ? q : undefined;
  const page = Math.max(1, Math.min(400, Number(sp.page) || 1));
  const gw = applications();
  const result = gw ? await gw.list(actor.id, { status, opportunity, page }) : { unavailable: "the connection to aletheiagov.org is not configured here" };
  const href = (p: number) => `/applications?${new URLSearchParams({ ...(status && { status }), ...(q && { q }), page: String(p) })}`;

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader
        overline={<SectionMark n="R7">Opportunities and applications</SectionMark>}
        title="Applications"
        lede="People who applied for a position or registered their interest on aletheiagov.org. They are held there. A status changed here or in the portal's staff area is the same status in both places."
      />
      <FilterBar
        action="/applications"
        filters={[{ name: "status", label: "Status", options: APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABEL[s] })) }]}
        values={{ status }}
        query={sp.q}
        queryLabel="Position applied for"
        queryPlaceholder="AGV-OPP-2026-0001"
        noun={["application", "applications"]}
        total={"rows" in result ? { shown: result.rows.length, of: result.total } : undefined}
      />
      {q && !opportunity ? (
        <InlineAlert tone="warning" title="That is not a position reference">
          Enter one like AGV-OPP-2026-0001. The list below is not filtered by it.
        </InlineAlert>
      ) : null}

      {"unavailable" in result ? (
        <InlineAlert tone="danger" title="Applications cannot be shown just now">
          The workbench could not read them: {result.unavailable}. Nothing has been lost; they are held on aletheiagov.org. Try again shortly.
        </InlineAlert>
      ) : result.rows.length === 0 ? (
        <EmptyRegister title={status || opportunity ? "No applications match." : "No applications yet."}>
          <p>When someone applies for a published opportunity or registers their interest on aletheiagov.org, they appear here.</p>
        </EmptyRegister>
      ) : (
        <>
          <table className="hidden w-full table-fixed border-collapse text-ui md:table">
            <caption className="sr-only">Applications, newest first</caption>
            <thead>
              <tr className="border-b border-rule-strong">
                <th scope="col" className="caps h-10 w-44 pr-3 text-left text-ink-2">
                  Reference
                </th>
                <th scope="col" className="caps h-10 px-3 text-left text-ink-2">
                  Applicant
                </th>
                <th scope="col" className="caps h-10 px-3 text-left text-ink-2">
                  Applied for
                </th>
                <th scope="col" className="caps h-10 w-16 px-3 text-left text-ink-2">
                  CV
                </th>
                <th scope="col" className="caps hidden h-10 w-32 px-3 text-left text-ink-2 lg:table-cell">
                  Received
                </th>
                <th scope="col" className="caps h-10 w-36 pl-3 text-left text-ink-2">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.reference} className="group relative border-b border-rule hover:bg-sheet">
                  <td className="py-3 pr-3 align-top">
                    <Link href={`/applications/${r.reference}`} className="tnum font-semibold text-ink after:absolute after:inset-0 group-hover:text-authority">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-ink">{r.name}</p>
                    <p className="truncate text-meta text-ink-2">{r.expertise.join(", ")}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-meta text-ink">
                    {r.opportunities.length ? <p className="tnum font-semibold">{r.opportunities.map((o) => o.reference).join(", ")}</p> : null}
                    <p className="text-ink-2">{r.positionTypes.map(positionName).join(", ")}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-meta">{r.cvs.length ? "PDF" : <span className="text-ink-3">None</span>}</td>
                  <td className="hidden px-3 py-3 align-top text-meta text-ink-2 lg:table-cell">
                    <Timestamp at={r.submittedAt} mode="date" timeZone={official.timezone} />
                  </td>
                  <td className="py-3 pl-3 align-top">
                    <StatusMark status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ol className="grid border-t border-rule-strong md:hidden">
            {result.rows.map((r) => (
              <li key={r.reference} className="border-b border-rule py-4">
                <Link href={`/applications/${r.reference}`} className="grid gap-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <StatusMark status={r.status} />
                  </span>
                  <span className="tnum text-meta text-ink-2">
                    {r.reference}
                    {r.opportunities.length ? ` · for ${r.opportunities.map((o) => o.reference).join(", ")}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} href={href} />
        </>
      )}
    </div>
  );
}
