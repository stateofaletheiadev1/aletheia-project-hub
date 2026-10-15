"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/form";
import { choosePasswordAction, confirmAuthenticatorAction, finishAction, type AcceptState } from "./actions";

function Problem({ text }: { text?: string }) {
  return text ? (
    <p role="alert" className="text-ui font-semibold text-status-danger">
      {text}
    </p>
  ) : null;
}

/** The rules, ticked as the official types, so nobody has to guess (brief §34). */
function Rules({ password, email, name }: { password: string; email: string; name: string }) {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const lower = password.toLowerCase();
  const nameParts = name.toLowerCase().split(/[\s'’-]+/).filter((p) => p.length >= 3);
  const rules = [
    { ok: password.length >= 12, text: "At least 12 characters" },
    { ok: password.length > 0 && !(local.length >= 3 && lower.includes(local)), text: "Not your email address" },
    { ok: password.length > 0 && !nameParts.some((p) => lower.includes(p)), text: "Not your name" },
  ];
  return (
    <ul className="grid gap-1" aria-label="Password rules">
      {rules.map((r) => (
        <li key={r.text} className={r.ok ? "text-meta font-semibold text-status-approved" : "text-meta text-ink-2"}>
          <span aria-hidden>{r.ok ? "✓ " : "· "}</span>
          <span className="sr-only">{r.ok ? "Met: " : "Not yet met: "}</span>
          {r.text}
        </li>
      ))}
    </ul>
  );
}

export function PasswordStep({ token, email, name }: { token: string; email: string; name: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(choosePasswordAction, {});
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Problem text={state.error} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="username" value={email} autoComplete="username" />
      <Field id="password" label="Choose a password" hint="A phrase of several words is easier to remember and harder to guess.">
        <TextInput id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
      </Field>
      <Rules password={password} email={email} name={name} />
      <Field id="confirm" label="Enter it again">
        <TextInput id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…">
        Save password and continue
      </Button>
    </form>
  );
}

export function AuthenticatorStep({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(confirmAuthenticatorAction, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Problem text={state.error} />
      <input type="hidden" name="token" value={token} />
      <Field id="code" label="Six-digit code from the app">
        <TextInput id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="tnum tracking-widest" />
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Checking…">
        Confirm and sign in
      </Button>
    </form>
  );
}

export function FinishStep({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(finishAction, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Problem text={state.error} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Finishing…">
        Finish joining
      </Button>
    </form>
  );
}
