"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Select, TextInput, Textarea } from "@/components/ui/form";
import { Reference } from "@/components/ui/Reference";
import { inviteAction, type InviteResult } from "../actions";

type Option = { value: string; label: string };

export function InviteForm({ roles, institutions, clearances }: { roles: (Option & { privileged: boolean })[]; institutions: Option[]; clearances: Option[] }) {
  const [state, action, pending] = useActionState<InviteResult, FormData>(inviteAction, {});
  const [rows, setRows] = useState(1);

  if (state.link) {
    return (
      <div className="grid max-w-2xl gap-5">
        <InlineAlert tone="success" title={`${state.name} has been invited`}>
          {state.done}
        </InlineAlert>
        <div className="border border-rule bg-sheet p-5">
          <p className="caps text-ink-2">Invitation link, shown once</p>
          <p className="mt-2 text-ui font-normal text-ink">
            Email is not configured, so send this link to {state.name} yourself, privately. It works once and expires in 72 hours. It is not stored and cannot be shown again.
          </p>
          <div className="mt-3 overflow-x-auto bg-sunken p-3">
            <Reference value={state.link} className="break-all" />
          </div>
        </div>
        <Link href="/officials" className="link text-ui font-semibold">
          Back to officials and access
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid max-w-3xl gap-6" noValidate>
      {state.error ? (
        <p role="alert" className="text-ui font-semibold text-status-danger">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="name" label="Full name" hint="As it will appear on records they sign.">
          <TextInput id="name" name="name" autoComplete="off" required />
        </Field>
        <Field id="email" label="Email address" hint="They sign in with this address.">
          <TextInput id="email" name="email" type="email" autoComplete="off" spellCheck={false} required />
        </Field>
      </div>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-ui font-semibold text-ink">Roles</legend>
        <p className="-mt-2 text-meta text-ink-2">Roles marked † wait for a second administrator before they take effect.</p>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid gap-3 border-t border-rule pt-4 md:grid-cols-3">
            <Field id={`role-${i}`} label={`Role ${i + 1}`}>
              <Select id={`role-${i}`} name={`role-${i}`} defaultValue="">
                <option value="">Choose a role</option>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                    {r.privileged ? " †" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`institution-${i}`} label="Institution">
              <Select id={`institution-${i}`} name={`institution-${i}`} defaultValue={institutions[0]?.value}>
                {institutions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`clearance-${i}`} label="Clearance" hint="The most sensitive records they may see.">
              <Select id={`clearance-${i}`} name={`clearance-${i}`} defaultValue="internal">
                {clearances.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ))}
        {rows < 4 ? (
          <div>
            <Button size="sm" variant="quiet" onClick={() => setRows((n) => n + 1)}>
              Add another role
            </Button>
          </div>
        ) : null}
      </fieldset>

      <Field id="reason" label="Reason" hint="Why this official needs this access. Recorded, and shown to the administrator who confirms any privileged role.">
        <Textarea id="reason" name="reason" rows={3} required />
      </Field>

      <div>
        <Button type="submit" variant="primary" pending={pending} pendingLabel="Creating invitation…">
          Create the invitation
        </Button>
      </div>
    </form>
  );
}
