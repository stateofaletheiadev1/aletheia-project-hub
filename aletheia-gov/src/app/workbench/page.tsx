import Link from "next/link";
import { StatusPill, WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { institutionName } from "@/features/interest/schema";
import { auditLabel } from "@/lib/audit-labels";
import { formatDateShort } from "@/lib/dates";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/authorization/policies";
import { audit, recentAuditEvents } from "@/server/services/audit";
import { listUsers } from "@/server/services/users";
import { listRegistrations, registrationCounts } from "@/server/services/workbench";

export const metadata = { title: "My office" };

type Todo = { done: boolean; title: string; text: string; href?: string; cta?: string };

export default async function MyOffice({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const welcome = (await searchParams).welcome === "1";
  const user = await requireUser();
  const actor = { id: user.id, roles: user.roles };
  const reviewer = can(actor, "interest.read");
  const admin = can(actor, "users.read");
  const auditor = can(actor, "audit.read");

  const [counts, latest, users, events] = await Promise.all([
    reviewer ? registrationCounts() : null,
    reviewer ? listRegistrations({ page: 1, pageSize: 5 }) : null,
    admin ? listUsers() : null,
    auditor ? recentAuditEvents({ limit: 6 }) : null,
  ]);
  if (latest?.rows.length) await audit({ actorId: user.id, action: "interest.list", target: null, outcome: "success", details: { view: "my-office", rows: latest.rows.length } });

  const names = new Map((users ?? []).map((u) => [u.id, u.name] as const));

  // What needs doing, worked out from the database each time the page loads.
  const pendingUsers = users?.filter((u) => !u.disabled && u.mustChangePassword && u.id !== user.id) ?? [];
  const todos: Todo[] = [
    { done: true, title: "Choose your own password", text: "Done. Only you know it now." },
    ...(counts
      ? [
          {
            done: counts.fresh === 0,
            title: counts.fresh ? `Review ${counts.fresh} new registration${counts.fresh === 1 ? "" : "s"} of interest` : "Registrations of interest are reviewed",
            text: counts.fresh
              ? "Open each one, read the details and CV, then move it through the hiring steps: Contacted, Shortlisted, Offered, Appointed, or Not progressed."
              : `Nothing new. ${counts.inProgress} in progress.`,
            href: "/workbench/interest?status=new",
            cta: "Review new registrations",
          },
        ]
      : []),
    ...(users
      ? [
          {
            done: pendingUsers.length === 0,
            title: pendingUsers.length ? `${pendingUsers.length} colleague${pendingUsers.length === 1 ? " has" : "s have"} not signed in yet` : "Every account is set up",
            text: pendingUsers.length
              ? `${pendingUsers.map((u) => u.name).join(", ")} still ${pendingUsers.length === 1 ? "has" : "have"} a temporary password. Share it privately; they choose their own at first sign-in.`
              : "Add an account for each officer who needs the workbench, with only the roles they need.",
            href: "/workbench/users",
            cta: pendingUsers.length ? "See accounts" : "Add an account",
          },
        ]
      : []),
    {
      done: user.twoStep,
      title: user.twoStep ? "Two-step sign-in is on" : "Two-step sign-in (optional)",
      text: user.twoStep
        ? "Every sign-in asks for your password and a code from your app. You can turn it off at any time in Account and security."
        : "Off for now. You can turn it on at any time, so a stolen password is not enough to sign in as you, and turn it off again whenever you wish.",
      href: "/workbench/account#two-step",
      cta: user.twoStep ? "Account and security" : "Turn it on",
    },
  ];

  const tile = "border-t-2 border-navy-800 pt-4";
  return (
    <>
      <WorkbenchHeading eyebrow="My office" title={`Good to see you, ${user.name.split(" ")[0]}.`}>
        What needs attention today.
      </WorkbenchHeading>

      {welcome ? (
        <p role="status" className="mb-10 border-l-2 border-[#2f6b3f] bg-parchment-100 px-5 py-4 text-[0.9375rem] text-ink-800">
          <strong>Your password is changed and the workbench is open.</strong> Every other session was signed out. Below is what needs doing.
        </p>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {counts ? (
          <>
            <Link href="/workbench/interest?status=new" className={`${tile} group`}>
              <p className="t-meta text-[0.6875rem] text-ink-500">New registrations</p>
              <p className="mt-2 text-[2.5rem] font-light leading-none group-hover:text-navy-600">{counts.fresh}</p>
            </Link>
            <Link href="/workbench/interest" className={`${tile} group`}>
              <p className="t-meta text-[0.6875rem] text-ink-500">All registrations</p>
              <p className="mt-2 text-[2.5rem] font-light leading-none group-hover:text-navy-600">{counts.total}</p>
            </Link>
          </>
        ) : null}
        {users ? (
          <Link href="/workbench/users" className={`${tile} group`}>
            <p className="t-meta text-[0.6875rem] text-ink-500">Accounts</p>
            <p className="mt-2 text-[2.5rem] font-light leading-none group-hover:text-navy-600">{users.filter((u) => !u.disabled).length}</p>
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="todo" className="mt-14">
        <h2 id="todo" className="t-h3">
          To do
        </h2>
        <ol className="mt-4 border-t border-[var(--rule-ledger)]">
          {todos.map((t) => (
            <li key={t.title} className="grid grid-cols-[1.75rem_1fr] gap-x-3 border-b border-[var(--rule-ledger)] py-4 md:grid-cols-[1.75rem_1fr_auto] md:items-center md:gap-x-6">
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 items-center justify-center border text-[0.75rem] ${t.done ? "border-[#2f6b3f] bg-[#2f6b3f] text-parchment-50" : "border-navy-800"}`}
              >
                {t.done ? "✓" : ""}
              </span>
              <span>
                <span className={`block font-medium ${t.done ? "text-ink-500" : ""}`}>
                  <span className="sr-only">{t.done ? "Done: " : "To do: "}</span>
                  {t.title}
                </span>
                <span className="mt-1 block text-[0.875rem] text-ink-600">{t.text}</span>
              </span>
              {t.href && !t.done ? (
                <Link href={t.href} className="link-ledger col-start-2 mt-2 text-[0.875rem] font-semibold md:col-start-3 md:mt-0">
                  {t.cta}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {latest ? (
        <section aria-labelledby="latest" className="mt-14">
          <h2 id="latest" className="t-h3">
            Latest registrations of interest
          </h2>
          {latest.rows.length === 0 ? (
            <p className="mt-4 text-ink-600">None yet.</p>
          ) : (
            <ul className="mt-4 border-t border-[var(--rule-ledger)]">
              {latest.rows.map((r) => (
                <li key={r.reference} className="border-b border-[var(--rule-ledger)]">
                  <Link href={`/workbench/interest/${r.reference}`} className="grid gap-1 py-4 hover:bg-parchment-100 md:grid-cols-[11rem_1fr_auto] md:items-center md:gap-6 md:px-2">
                    <span className="t-ref text-gold-700">{r.reference}</span>
                    <span>
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-[0.875rem] text-ink-500">{r.institutions.map(institutionName).join(", ")}</span>
                    </span>
                    <span className="flex items-center gap-4 text-[0.8125rem] text-ink-500">
                      {formatDateShort(r.submittedAt)} <StatusPill status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {events ? (
        <section aria-labelledby="activity" className="mt-14">
          <h2 id="activity" className="t-h3">
            Recent activity
          </h2>
          <ul className="mt-4 space-y-2 text-[0.875rem] text-ink-700">
            {events.map((e) => (
              <li key={e._id}>
                <span className="t-ref text-ink-500">{e.at.slice(0, 16).replace("T", " ")}</span> · {auditLabel(e.action)}
                {e.actorId && names.get(e.actorId) ? <span className="text-ink-500"> by {names.get(e.actorId)}</span> : null}
                {e.outcome !== "success" ? <span className="font-semibold text-[#9b2c2c]"> ({e.outcome})</span> : null}
              </li>
            ))}
          </ul>
          <Link href="/workbench/audit" className="link-ledger mt-4 inline-block text-[0.875rem]">
            Full audit log
          </Link>
        </section>
      ) : null}

      {!reviewer && !admin && !auditor ? <p className="text-ink-600">Your account has no areas assigned yet. Ask an administrator for a role.</p> : null}
    </>
  );
}
