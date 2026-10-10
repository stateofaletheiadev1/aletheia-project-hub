"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "./actions";

const input =
  "mt-2 block w-full border-0 border-b border-[var(--rule-sea)] bg-transparent px-0 py-2.5 text-[1.0625rem] text-parchment-50 placeholder:text-navy-400 focus:border-gold-400 focus:outline-none focus:ring-0";
const label = "t-meta text-[0.6875rem] text-parchment-300";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-7">
      {state.error ? (
        <p role="alert" className="border-l-2 border-[#f3b4b4] bg-navy-900 px-4 py-3 text-[0.9375rem] text-parchment-50">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="signin-email" className={label}>
          Email
        </label>
        <input id="signin-email" name="email" type="email" autoComplete="username" required defaultValue={state.email ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor="signin-password" className={label}>
          Password
        </label>
        <input id="signin-password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center gap-3 bg-gold-500 px-6 text-[0.9375rem] font-semibold text-navy-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"} <span aria-hidden>→</span>
      </button>
    </form>
  );
}
