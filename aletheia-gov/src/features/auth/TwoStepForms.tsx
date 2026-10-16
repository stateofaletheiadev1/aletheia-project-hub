"use client";

import { useActionState } from "react";
import { confirmTwoStepSetup, turnOffTwoStep, verifySignInCode, type FormState } from "./actions";

// Optional two-step sign-in (off until the person turns it on, and they can turn it off again).

const lightInput =
  "mt-1.5 block w-full max-w-[12rem] border-0 border-b border-[var(--rule-ledger)] bg-transparent px-0 py-2 text-[1.125rem] tracking-[0.3em] focus:border-navy-800 focus:outline-none focus:ring-0";
const lightLabel = "block text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500";

function Message({ state }: { state: FormState }) {
  if (!state.error && !state.done) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`border-l-2 px-4 py-3 text-[0.9375rem] ${state.error ? "border-[#9b2c2c] bg-[#fbeaea] text-[#7a1f1f]" : "border-[#2f6b3f] bg-[#eaf4ec] text-[#1f4d2b]"}`}
    >
      {state.error ?? state.done}
    </p>
  );
}

/** Sign-in, second step: the code from the authenticator app. */
export function SignInCodeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(verifySignInCode, {});
  return (
    <form action={action} className="space-y-7">
      {state.error ? (
        <p role="alert" className="border-l-2 border-[#f3b4b4] bg-navy-900 px-4 py-3 text-[0.9375rem] text-parchment-50">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="signin-code" className="t-meta text-[0.6875rem] text-parchment-300">
          Six-digit code
        </label>
        <input
          id="signin-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
          className="mt-2 block w-full max-w-[14rem] border-0 border-b border-[var(--rule-sea)] bg-transparent px-0 py-2.5 text-[1.25rem] tracking-[0.3em] text-parchment-50 focus:border-gold-400 focus:outline-none focus:ring-0"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center gap-3 bg-gold-500 px-6 text-[0.9375rem] font-semibold text-navy-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"} <span aria-hidden>→</span>
      </button>
    </form>
  );
}

/** Account, setting up: confirm the app with its first code. */
export function ConfirmTwoStepForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmTwoStepSetup, {});
  return (
    <form action={action} className="mt-4 space-y-4">
      <Message state={state} />
      <label className={lightLabel}>
        Six-digit code
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className={lightInput} />
      </label>
      <button type="submit" disabled={pending} className="min-h-10 bg-navy-800 px-5 text-[0.875rem] font-semibold text-parchment-50 hover:bg-navy-900 disabled:opacity-60">
        {pending ? "Checking…" : "Turn on two-step sign-in"}
      </button>
    </form>
  );
}

/** Account: turn it off again, with the password. */
export function TurnOffTwoStepForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(turnOffTwoStep, {});
  return (
    <form action={action} className="mt-3 space-y-4">
      <Message state={state} />
      <label className={lightLabel}>
        Your password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 block w-full border-0 border-b border-[var(--rule-ledger)] bg-transparent px-0 py-2 text-[0.9375rem] focus:border-navy-800 focus:outline-none focus:ring-0"
        />
      </label>
      <button type="submit" disabled={pending} className="min-h-10 border border-[#9b2c2c] px-4 text-[0.875rem] font-semibold text-[#9b2c2c] hover:bg-[#9b2c2c] hover:text-parchment-50 disabled:opacity-60">
        {pending ? "Turning off…" : "Turn two-step sign-in off"}
      </button>
    </form>
  );
}
