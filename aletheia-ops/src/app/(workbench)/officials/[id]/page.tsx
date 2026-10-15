import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/patterns/ActionForm";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { Field, Select, TextInput } from "@/components/ui/form";
import { Timestamp } from "@/components/ui/Timestamp";
import { ACCOUNT_STATE, CLASSIFICATION, CLASSIFICATIONS } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { institutionName } from "@/domain/labels";
import { PRIVILEGED_ROLES, ROLE_INFO, ROLES } from "@/policy/roles";
import { getOfficial, listSessions } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { requirePermission } from "@/server/session";
import { proposeGrantAction, revokeSessionAction, stateAction } from "../actions";

export const metadata: Metadata = { title: "Official" };

export default async function OfficialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const signedIn = await requirePermission("official.read");
  const d = await requireDeps();
  const o = await getOfficial(d, signedIn.actor, id);
  if (!o) notFound();
  const self = o.id === signedIn.official.id;
  const sessions = o.manageable ? await listSessions(d, o.id) : [];
  const tz = signedIn.official.timezone;

  return (
    <div className="mx-auto grid max-w-7xl gap-10">
      <PageHeader
        overline={<SectionMark n="I2">Officials and access</SectionMark>}
        title={o.name}
        lede={o.email}
        meta={
          <p className="text-meta text-ink-2">
            {ACCOUNT_STATE[o.state].label} · {o.mfa ? "Authenticator set up" : "No authenticator yet"} · Invited <Timestamp at={o.createdAt} mode="date" timeZone={tz} />
            {o.lastSignInAt ? (
              <>
                {" "}
                · Last signed in <Timestamp at={o.lastSignInAt} timeZone={tz} />
              </>
            ) : null}
          </p>
        }
      />

      <div className="grid gap-10 xl:grid-cols-12">
        <section aria-labelledby="roles" className="xl:col-span-7">
          <h2 id="roles" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
            Roles
          </h2>
          {o.grants.length === 0 ? <p className="py-3 text-ui text-ink-2">No roles yet. Privileged roles may be waiting for a second administrator.</p> : null}
          <ul className="grid">
            {o.grants.map((g) => (
              <li key={`${g.role}-${g.institution}-${g.clearance}`} className="flex flex-wrap items-start justify-between gap-4 border-b border-rule py-3">
                <div>
                  <p className="text-ui font-semibold text-ink">
                    {ROLE_INFO[g.role].label}
                    {PRIVILEGED_ROLES.includes(g.role) ? <span className="text-ink-3"> †</span> : null}
                  </p>
                  <p className="text-meta text-ink-2">
                    {institutionName(g.institution)} · {CLASSIFICATION[g.clearance].label} clearance
                  </p>
                </div>
                {o.manageable && !self ? (
                  <details className="min-w-56">
                    <summary className="cursor-pointer text-meta font-semibold text-status-danger">Remove this role</summary>
                    <ActionForm action={proposeGrantAction} submit="Remove the role" variant="danger" size="sm" className="mt-3">
                      <input type="hidden" name="kind" value="revoke_grant" />
                      <input type="hidden" name="target" value={o.id} />
                      <input type="hidden" name="role" value={g.role} />
                      <input type="hidden" name="institution" value={g.institution} />
                      <input type="hidden" name="clearance" value={g.clearance} />
                      <Field id={`rm-${g.role}-${g.institution}`} label="Reason">
                        <TextInput id={`rm-${g.role}-${g.institution}`} name="reason" required />
                      </Field>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>

          {o.manageable && !self && o.state !== "revoked" ? (
            <div className="mt-8 border border-rule bg-sheet p-5">
              <h3 className="text-h3 text-ink">Add a role</h3>
              <p className="mt-1 text-meta text-ink-2">Roles marked † wait for a second administrator. The official signs in again before a change applies.</p>
              <ActionForm action={proposeGrantAction} submit="Add the role" className="mt-4">
                <input type="hidden" name="kind" value="grant" />
                <input type="hidden" name="target" value={o.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <Field id="add-role" label="Role">
                    <Select id="add-role" name="role" defaultValue="">
                      <option value="">Choose a role</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_INFO[r].label}
                          {PRIVILEGED_ROLES.includes(r) ? " †" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="add-institution" label="Institution">
                    <Select id="add-institution" name="institution" defaultValue={INSTITUTION_SEED[0]!.slug}>
                      <option value="*">All institutions</option>
                      {INSTITUTION_SEED.map((i) => (
                        <option key={i.slug} value={i.slug}>
                          {i.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="add-clearance" label="Clearance">
                    <Select id="add-clearance" name="clearance" defaultValue="internal">
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c}>
                          {CLASSIFICATION[c].label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field id="add-reason" label="Reason">
                  <TextInput id="add-reason" name="reason" required />
                </Field>
              </ActionForm>
            </div>
          ) : null}
        </section>

        <aside className="grid content-start gap-8 xl:col-span-5">
          {o.manageable && !self ? (
            <section aria-labelledby="account">
              <h2 id="account" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
                Account
              </h2>
              <ActionForm action={stateAction} submit={o.state === "active" ? "Suspend this official" : o.state === "suspended" ? "Reinstate this official" : "Revoke the invitation"} variant={o.state === "suspended" ? "secondary" : "danger"}>
                <input type="hidden" name="target" value={o.id} />
                <input type="hidden" name="state" value={o.state === "active" ? "suspended" : o.state === "suspended" ? "active" : "revoked"} />
                <Field
                  id="state-reason"
                  label="Reason"
                  hint={o.state === "active" ? "Suspension ends every session at once. It can be reversed." : o.state === "suspended" ? "They can sign in again with their own password and authenticator." : "The invitation stops working."}
                >
                  <TextInput id="state-reason" name="reason" required />
                </Field>
              </ActionForm>
              {o.state !== "revoked" && o.state !== "invited" ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-meta font-semibold text-status-danger">Revoke access permanently</summary>
                  <ActionForm action={stateAction} submit="Revoke access permanently" variant="danger" size="sm" className="mt-3">
                    <input type="hidden" name="target" value={o.id} />
                    <input type="hidden" name="state" value="revoked" />
                    <Field id="revoke-reason" label="Reason" hint="Cannot be undone. The account stays in the record for audit.">
                      <TextInput id="revoke-reason" name="reason" required />
                    </Field>
                  </ActionForm>
                </details>
              ) : null}
            </section>
          ) : null}

          {o.manageable ? (
            <section aria-labelledby="sessions">
              <h2 id="sessions" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
                Signed in on
              </h2>
              {sessions.length === 0 ? <p className="text-ui text-ink-2">No active sessions.</p> : null}
              <ul className="grid">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 border-b border-rule py-3">
                    <div>
                      <p className="text-ui font-semibold text-ink">{s.device}</p>
                      <p className="text-meta text-ink-2">
                        Last active <Timestamp at={s.lastSeenAt} timeZone={tz} />
                      </p>
                    </div>
                    <ActionForm action={revokeSessionAction} submit="End session" size="sm" variant="quiet">
                      <input type="hidden" name="session" value={s.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
