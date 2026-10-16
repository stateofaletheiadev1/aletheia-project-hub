import type { Metadata } from "next";
import { ActionForm } from "@/components/patterns/ActionForm";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { Field, Select, TextInput } from "@/components/ui/form";
import { Timestamp } from "@/components/ui/Timestamp";
import { grantLabel } from "@/domain/labels";
import { listSessions } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";
import { beginTwoStepAction, disableTwoStepAction, endSessionAction, passwordAction, preferencesAction } from "./actions";
import { InlineAlert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Your account" };

const TIMEZONES = [
  ["Africa/Lagos", "West Africa (WAT)"],
  ["Africa/Accra", "Ghana (GMT)"],
  ["Africa/Nairobi", "East Africa (EAT)"],
  ["Africa/Johannesburg", "South Africa (SAST)"],
  ["Europe/London", "United Kingdom (GMT/BST)"],
  ["Europe/Berlin", "Central Europe (CET/CEST)"],
  ["America/New_York", "US Eastern"],
  ["UTC", "Coordinated Universal Time"],
] as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ "two-step"?: string }> }) {
  const signedIn = await requireOfficial();
  const { official, session } = signedIn;
  const sessions = await listSessions(await requireDeps(), official.id);
  const justOn = (await searchParams)["two-step"] === "on";
  const optional = env().AUTH_MFA === "optional";
  return (
    <div className="mx-auto grid max-w-5xl gap-12">
      <PageHeader overline={<SectionMark n="A1">Account</SectionMark>} title={official.name} lede="Your access, your preferences and where you are signed in." />

      <section aria-labelledby="access">
        <h2 id="access" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
          Your access
        </h2>
        <ul className="grid gap-1.5">
          {official.grants.map((g) => (
            <li key={`${g.role}-${g.institution}`} className="text-ui text-ink">
              {grantLabel(g)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-meta text-ink-2">Roles are granted by administrators. Nobody can change their own access.</p>
      </section>

      <section aria-labelledby="prefs">
        <h2 id="prefs" className="mb-4 border-b border-rule-strong pb-2 text-h3 text-ink">
          Preferences
        </h2>
        <ActionForm action={preferencesAction} submit="Save preferences">
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="timezone" label="Show times in" hint="Times are stored in UTC and shown in this zone.">
              <Select id="timezone" name="timezone" defaultValue={official.timezone}>
                {TIMEZONES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="density" label="Register density">
              <Select id="density" name="density" defaultValue={official.density}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </Select>
            </Field>
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="two-step-heading" id="two-step">
        <h2 id="two-step-heading" className="mb-4 border-b border-rule-strong pb-2 text-h3 text-ink">
          Two-step sign-in
        </h2>
        {justOn ? (
          <InlineAlert tone="success" title="Two-step sign-in is on" className="mb-4">
            From now on you sign in with your password and the code from your authenticator app. You have been signed out everywhere else.
          </InlineAlert>
        ) : null}
        {official.totpSealed ? (
          <div className="grid gap-4">
            <p className="text-ui text-ink">
              <span className="font-semibold text-status-approved">On.</span> Every sign-in asks for your password and a six-digit code from your authenticator app. You can turn it off at any time.
            </p>
            {optional ? (
              <details>
                <summary className="cursor-pointer text-meta font-semibold text-status-danger">Turn two-step sign-in off</summary>
                <ActionForm action={disableTwoStepAction} submit="Turn it off" variant="danger" size="sm" className="mt-3 max-w-md">
                  <Field id="mfa-password" label="Your password" hint="To confirm it is you.">
                    <TextInput id="mfa-password" name="password" type="password" autoComplete="current-password" required />
                  </Field>
                </ActionForm>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-ui text-ink measure">
              <span className="font-semibold">Off.</span> You sign in with your password only. It is your choice: you can turn on two-step sign-in at any time, so that a code from an
              authenticator app on your phone (Microsoft Authenticator, Google Authenticator, 1Password or Bitwarden) is also needed and a stolen password is not enough. You can turn
              it off again whenever you wish.
            </p>
            <form action={beginTwoStepAction}>
              <Button type="submit" variant="primary">
                Turn on two-step sign-in
              </Button>
            </form>
          </div>
        )}
      </section>

      <section aria-labelledby="password">
        <h2 id="password" className="mb-4 border-b border-rule-strong pb-2 text-h3 text-ink">
          Change your password
        </h2>
        <ActionForm action={passwordAction} submit="Change password" pendingLabel="Changing…">
          <input type="hidden" name="username" autoComplete="username" />
          <div className="grid max-w-md gap-4">
            <Field id="current" label="Current password">
              <TextInput id="current" name="current" type="password" autoComplete="current-password" required />
            </Field>
            <Field id="next" label="New password" hint="At least 12 characters, not your name or email address.">
              <TextInput id="next" name="next" type="password" autoComplete="new-password" required />
            </Field>
            <Field id="confirm" label="New password again">
              <TextInput id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </Field>
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="where">
        <h2 id="where" className="mb-3 border-b border-rule-strong pb-2 text-h3 text-ink">
          Signed in on
        </h2>
        <ul className="grid">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-3">
              <div>
                <p className="text-ui font-semibold text-ink">
                  {s.device}
                  {s.id === session.id ? <span className="ml-2 font-medium text-status-approved">This device</span> : null}
                </p>
                <p className="text-meta text-ink-2">
                  Signed in <Timestamp at={s.createdAt} mode="datetime" timeZone={official.timezone} /> · last active <Timestamp at={s.lastSeenAt} timeZone={official.timezone} />
                </p>
              </div>
              {s.id !== session.id ? (
                <ActionForm action={endSessionAction} submit="End session" size="sm" variant="quiet">
                  <input type="hidden" name="session" value={s.id} />
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-meta text-ink-2">Sessions end after 30 minutes without activity and 12 hours after sign-in.</p>
      </section>
    </div>
  );
}
