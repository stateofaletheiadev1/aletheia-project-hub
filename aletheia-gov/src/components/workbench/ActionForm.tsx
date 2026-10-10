"use client";

import { useActionState } from "react";

type State = { error?: string; done?: string };

/** A form bound to a server action, with an accessible result message. */
export function ActionForm({
  action,
  children,
  submit,
  className = "",
  tone = "primary",
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  children?: React.ReactNode;
  submit: string;
  className?: string;
  tone?: "primary" | "quiet" | "danger";
}) {
  const [state, run, pending] = useActionState(action, {});
  const button =
    tone === "primary"
      ? "bg-navy-800 text-parchment-50 hover:bg-navy-950"
      : tone === "danger"
        ? "border border-[#9b2c2c] text-[#9b2c2c] hover:bg-[#9b2c2c] hover:text-parchment-50"
        : "border border-[var(--rule-ledger)] text-navy-800 hover:border-navy-800";
  return (
    <form action={run} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`inline-flex min-h-10 items-center px-4 text-[0.875rem] font-semibold transition-colors disabled:opacity-60 ${button}`}>
          {pending ? "Working…" : submit}
        </button>
        <p role="status" aria-live="polite" className={`text-[0.875rem] ${state.error ? "font-medium text-[#9b2c2c]" : "text-green-700"}`}>
          {state.error ?? state.done ?? ""}
        </p>
      </div>
    </form>
  );
}
