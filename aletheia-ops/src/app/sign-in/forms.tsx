"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/form";
import { enrolAction, signInAction, verifyAction, type FormState } from "./actions";

function Problem({ text }: { text?: string }) {
  return (
    <p role="alert" aria-live="assertive" className="min-h-0 text-ui font-semibold text-status-danger empty:hidden">
      {text}
    </p>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Problem text={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email address">
        <TextInput id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} autoFocus spellCheck={false} />
      </Field>
      <Field id="password" label="Password">
        <TextInput id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Checking…">
        Continue
      </Button>
    </form>
  );
}

export function CodeForm({ next, enrol = false }: { next: string; enrol?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrol ? enrolAction : verifyAction, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Problem text={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field id="code" label="Six-digit code" hint={enrol ? "The code the app shows now for Aletheia Operations." : "From the authenticator app you set up for two-step sign-in."}>
        <TextInput id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus className="tnum tracking-widest" />
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Checking…">
        Sign in
      </Button>
    </form>
  );
}
