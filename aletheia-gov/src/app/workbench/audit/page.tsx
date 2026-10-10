import { auditLabel } from "@/lib/audit-labels";
import { WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { requirePermission } from "@/server/auth/current-user";
import { recentAuditEvents } from "@/server/services/audit";
import { listUsers } from "@/server/services/users";

export const metadata = { title: "Audit log" };

const OUTCOME: Record<string, string> = { success: "text-green-700", failure: "text-[#9b2c2c]", denied: "text-[#9b2c2c]" };

export default async function AuditLog(props: PageProps<"/workbench/audit">) {
  await requirePermission("audit.read");
  const q = await props.searchParams;
  const action = typeof q.action === "string" && /^[a-z_.]{1,40}$/.test(q.action) ? q.action : undefined;
  const [events, users] = await Promise.all([recentAuditEvents({ limit: 200, action }), listUsers()]);
  const names = new Map(users.map((u) => [u.id, u.name]));

  return (
    <>
      <WorkbenchHeading eyebrow="Accountability" title="Audit log">
        Every sign-in, every view of personal data, every download and every change, newest first. Entries cannot be edited or removed from the workbench.
        {action ? (
          <>
            {" "}
            Showing <span className="t-ref">{action}</span> only.{" "}
            <a className="link-ledger" href="/workbench/audit">
              Show all
            </a>
          </>
        ) : null}
      </WorkbenchHeading>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-[0.875rem]">
          <caption className="sr-only">Audit events, newest first</caption>
          <thead>
            <tr className="border-b-2 border-navy-800 text-[0.6875rem] uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="py-3 pr-4 font-semibold">Time (UTC)</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Who</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Action</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Target</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Outcome</th>
              <th scope="col" className="py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id} className="border-b border-[var(--rule-ledger)] align-top">
                <td className="t-ref py-2.5 pr-4 text-ink-600">{e.at.slice(0, 19).replace("T", " ")}</td>
                <td className="py-2.5 pr-4">{e.actorId ? (names.get(e.actorId) ?? e.actorId.slice(0, 8)) : <span className="text-ink-500">unknown</span>}</td>
                <td className="py-2.5 pr-4">
                  <a className="underline decoration-[var(--rule-ledger)] underline-offset-4" href={`/workbench/audit?action=${e.action}`}>
                    {auditLabel(e.action)}
                  </a>
                  <span className="t-ref block text-[0.75rem] text-ink-500">{e.action}</span>
                </td>
                <td className="t-ref py-2.5 pr-4 text-ink-700">{e.target ? (e.target.type === "user" ? (names.get(e.target.id) ?? e.target.id.slice(0, 8)) : e.target.id) : "—"}</td>
                <td className={`py-2.5 pr-4 font-semibold ${OUTCOME[e.outcome] ?? ""}`}>{e.outcome}</td>
                <td className="py-2.5 text-ink-600">{e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(" · ") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
