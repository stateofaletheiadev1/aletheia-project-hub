import type { Metadata } from "next";
import { InlineAlert, PageHeader, SectionMark } from "@/components/ui/feedback";
import { Timestamp } from "@/components/ui/Timestamp";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/time";
import { listAuditEvents } from "@/services/audit-register";
import { verifyChain } from "@/services/audit";
import { requireDeps } from "@/server/runtime";
import { requirePermission } from "@/server/session";

// The audit register (brief §13.2.8, §26): read-only, newest first, with the chain verified
// on every visit. Nobody, administrators included, can change or remove an event here.

export const metadata: Metadata = { title: "Audit register" };

const OUTCOME: Record<string, string> = { success: "text-ink-2", failure: "font-semibold text-status-returned", denied: "font-semibold text-status-danger" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { official } = await requirePermission("audit.read");
  const d = await requireDeps();
  const before = Number((await searchParams).before) || undefined;
  const [report, page] = await Promise.all([verifyChain(d.store), listAuditEvents(d, { before, limit: 50 })]);
  const now = new Date();
  const tz = official.timezone;
  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <PageHeader
        overline={<SectionMark n="O1">Oversight</SectionMark>}
        title="Audit register"
        lede="Every sign-in, invitation, access change and decision, in order. Each entry carries the fingerprint of the one before it, so any alteration is detectable."
      />
      {report.ok ? (
        <InlineAlert tone="success" title={`Integrity verified as of ${formatDateTime(now, tz)}`}>
          All {report.checked} entries are present and unaltered, from the first to the latest. This shows the register is tamper-evident; it is not anchored outside this system.
        </InlineAlert>
      ) : (
        <InlineAlert tone="danger" title={`Integrity check failed at entry ${report.brokenAt}`}>
          {report.problem} Report this to the system administrators and the Office of the Auditor-General.
        </InlineAlert>
      )}
      <table className="w-full table-fixed border-collapse text-ui">
        <caption className="sr-only">Audit events, newest first</caption>
        <thead>
          <tr className="border-b border-rule-strong">
            <th scope="col" className="caps h-10 w-16 pr-3 text-right text-ink-2">
              No.
            </th>
            <th scope="col" className="caps h-10 w-36 px-3 text-left text-ink-2">
              When
            </th>
            <th scope="col" className="caps h-10 px-3 text-left text-ink-2">
              What
            </th>
            <th scope="col" className="caps hidden h-10 w-48 px-3 text-left text-ink-2 md:table-cell">
              Who
            </th>
            <th scope="col" className="caps hidden h-10 w-28 pl-3 text-left text-ink-2 lg:table-cell">
              Outcome
            </th>
          </tr>
        </thead>
        <tbody>
          {page.events.map((e) => (
            <tr key={e.seq} className="border-b border-rule align-top">
              <td className="tnum py-3 pr-3 text-right text-ink-3">{e.seq}</td>
              <td className="px-3 py-3 text-meta text-ink-2">
                <Timestamp at={e.at} now={now} timeZone={tz} />
              </td>
              <td className="px-3 py-3">
                <p className="font-semibold text-ink">{e.label}</p>
                {e.reason ? <p className="mt-0.5 text-meta text-ink-2">“{e.reason}”</p> : null}
                <p className="mt-0.5 text-meta text-ink-3 md:hidden">
                  {e.actorName} · {e.outcome}
                </p>
              </td>
              <td className="hidden px-3 py-3 text-ink-2 md:table-cell">{e.actorName}</td>
              <td className={cx("hidden py-3 pl-3 text-meta lg:table-cell", OUTCOME[e.outcome])}>{e.outcome === "success" ? "Done" : e.outcome === "failure" ? "Failed" : "Refused"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {page.nextBefore ? (
        <a href={`/audit?before=${page.nextBefore}`} className="link justify-self-start text-ui font-semibold">
          Older entries
        </a>
      ) : null}
    </div>
  );
}
