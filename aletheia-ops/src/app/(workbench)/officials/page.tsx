import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/patterns/ActionForm";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/form";
import { Timestamp } from "@/components/ui/Timestamp";
import { ACCOUNT_STATE } from "@/domain/glossary";
import { grantLabel, institutionName } from "@/domain/labels";
import { cx } from "@/lib/cx";
import { env } from "@/lib/env";
import { can, institutionsWhere, ROLE_INFO } from "@/policy/roles";
import { listDecidedChanges, listOfficials, listPendingChanges } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { requirePermission } from "@/server/session";
import { decideAction } from "./actions";

export const metadata: Metadata = { title: "Officials and access" };

const STATE_STYLE: Record<string, string> = {
  active: "text-status-approved",
  invited: "text-status-review",
  suspended: "text-status-returned",
  revoked: "text-status-muted",
};

export default async function OfficialsPage() {
  const { official, actor } = await requirePermission("official.read");
  const d = await requireDeps();
  const [officials, pending, decided] = await Promise.all([listOfficials(d, actor), listPendingChanges(d, actor), listDecidedChanges(d, actor)]);
  const names = new Map(officials.map((o) => [o.id, o.name]));
  const invites = institutionsWhere(actor, "official.invite");
  const mfaRequired = env().AUTH_MFA === "required";
  return (
    <div className="mx-auto grid max-w-7xl gap-10">
      <PageHeader
        overline={<SectionMark n="I2">Institutions</SectionMark>}
        title="Officials and access"
        lede="Accounts are by invitation only. Administrator, approving, publishing and finance roles take effect only when a second administrator confirms them."
        actions={invites === "*" || invites.length ? <ButtonLink href="/officials/invite" variant="primary">Invite an official</ButtonLink> : undefined}
      />

      {pending.length ? (
        <section aria-labelledby="pending">
          <h2 id="pending" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
            Waiting for a second administrator
          </h2>
          <ul className="grid">
            {pending.map((p) => {
              const mine = p.proposedBy === official.id;
              const what =
                p.change.kind === "workflow_policy"
                  ? `Workflow policy for ${p.change.register}, version ${p.change.version}`
                  : `${p.change.kind === "grant" ? "Grant" : "Remove"} ${grantLabel(p.change.grant)} ${p.change.kind === "grant" ? "to" : "from"} ${names.get(p.change.target) ?? "an official"}`;
              const decidable = !mine && can(actor, "role.confirm", { institution: p.change.kind === "workflow_policy" || p.change.grant.institution === "*" ? undefined : p.change.grant.institution });
              return (
                <li key={p.id} className="grid gap-3 border-b border-rule py-4 lg:grid-cols-12 lg:gap-8">
                  <div className="lg:col-span-7">
                    <p className="text-ui font-semibold text-ink">{what}</p>
                    <p className="mt-1 text-meta text-ink-2">
                      Proposed by {names.get(p.proposedBy) ?? "an administrator"} · <Timestamp at={p.proposedAt} timeZone={official.timezone} />
                    </p>
                    <p className="mt-2 border-l-2 border-rule pl-3 text-ui font-normal text-ink">{p.reason}</p>
                  </div>
                  <div className="lg:col-span-5">
                    {mine ? (
                      <p className="text-meta text-ink-2">You proposed this. Another administrator must decide it.</p>
                    ) : decidable ? (
                      <div className="grid gap-3">
                        <ActionForm action={decideAction} submit="Confirm the change" variant="primary" size="sm">
                          <input type="hidden" name="change" value={p.id} />
                          <input type="hidden" name="decision" value="confirm" />
                        </ActionForm>
                        <details>
                          <summary className="cursor-pointer text-meta font-semibold text-status-danger">Reject it instead</summary>
                          <ActionForm action={decideAction} submit="Reject the change" variant="danger" size="sm" className="mt-3">
                            <input type="hidden" name="change" value={p.id} />
                            <input type="hidden" name="decision" value="reject" />
                            <Field id={`reason-${p.id}`} label="Reason, shown to the proposer">
                              <TextInput id={`reason-${p.id}`} name="reason" required />
                            </Field>
                          </ActionForm>
                        </details>
                      </div>
                    ) : (
                      <p className="text-meta text-ink-2">You cannot decide changes for this institution.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {decided.length ? (
        <section aria-labelledby="decided">
          <h2 id="decided" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
            Decided in the last seven days
          </h2>
          <ul className="grid">
            {decided.map((p) => (
              <li key={p.id} className="grid gap-1 border-b border-rule py-3">
                <p className="text-ui text-ink">
                  <span className={cx("font-semibold", p.status === "confirmed" ? "text-status-approved" : "text-status-danger")}>{p.status === "confirmed" ? "Confirmed" : "Rejected"}</span>
                  {": "}
                  {p.change.kind === "workflow_policy" ? `workflow policy for ${p.change.register}` : `${p.change.kind === "grant" ? "grant" : "removal"} of ${grantLabel(p.change.grant)} for ${names.get(p.change.target) ?? "an official"}`}
                </p>
                <p className="text-meta text-ink-2">
                  {p.status === "confirmed" ? "Confirmed" : "Rejected"} by {names.get(p.decidedBy ?? "") ?? "an administrator"}
                  {p.decidedAt ? (
                    <>
                      {" "}
                      · <Timestamp at={p.decidedAt} timeZone={official.timezone} />
                    </>
                  ) : null}
                  {" "}· proposed by {names.get(p.proposedBy) ?? "an administrator"}
                  {p.decisionReason ? ` · “${p.decisionReason}”` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="list">
        <h2 id="list" className="sr-only">
          Officials
        </h2>
        <table className="hidden w-full table-fixed border-collapse text-ui md:table">
          <caption className="sr-only">Officials you may see</caption>
          <thead>
            <tr className="border-b border-rule-strong">
              <th scope="col" className="caps h-10 w-1/4 pr-3 text-left text-ink-2">
                Official
              </th>
              <th scope="col" className="caps h-10 px-3 text-left text-ink-2">
                Roles
              </th>
              <th scope="col" className="caps h-10 w-28 px-3 text-left text-ink-2">
                Account
              </th>
              <th scope="col" className="caps hidden h-10 w-36 pl-3 text-right text-ink-2 lg:table-cell">
                Last sign-in
              </th>
            </tr>
          </thead>
          <tbody>
            {officials.map((o) => (
              <tr key={o.id} className="group relative border-b border-rule hover:bg-sheet">
                <td className="py-3 pr-3 align-top">
                  <Link href={`/officials/${o.id}`} className="font-semibold text-ink after:absolute after:inset-0 group-hover:text-authority">
                    {o.name}
                  </Link>
                  {o.id === official.id ? <span className="ml-2 text-meta text-ink-3">(you)</span> : null}
                  <p className="truncate text-meta text-ink-2">{o.email}</p>
                </td>
                <td className="px-3 py-3 align-top">
                  <ul className="grid gap-0.5">
                    {o.grants.map((g) => (
                      <li key={`${g.role}${g.institution}`} className="text-meta text-ink">
                        <span className="font-semibold">{ROLE_INFO[g.role].label}</span>
                        <span className="text-ink-2"> · {institutionName(g.institution)}</span>
                      </li>
                    ))}
                    {o.grants.length === 0 ? <li className="text-meta text-ink-3">No roles yet</li> : null}
                  </ul>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={cx("text-meta font-semibold", STATE_STYLE[o.state])}>{ACCOUNT_STATE[o.state].label}</span>
                  {o.state === "active" && !o.mfa ? <p className={cx("text-meta", mfaRequired ? "text-status-danger" : "text-ink-3")}>{mfaRequired ? "No authenticator" : "Two-step sign-in off"}</p> : null}
                </td>
                <td className="hidden py-3 pl-3 text-right align-top text-meta text-ink-2 lg:table-cell">
                  {o.lastSignInAt ? <Timestamp at={o.lastSignInAt} timeZone={official.timezone} /> : <span className="text-ink-3">Never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ol className="grid border-t border-rule-strong md:hidden">
          {officials.map((o) => (
            <li key={o.id} className="border-b border-rule py-4">
              <Link href={`/officials/${o.id}`} className="grid gap-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{o.name}</span>
                  <span className={cx("text-meta font-semibold", STATE_STYLE[o.state])}>{ACCOUNT_STATE[o.state].label}</span>
                </span>
                <span className="text-meta text-ink-2">{o.grants.map((g) => ROLE_INFO[g.role].label).join(", ") || "No roles yet"}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
