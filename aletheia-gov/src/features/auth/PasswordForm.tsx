"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { changePassword, type FormState } from "./actions";

const input =
  "mt-1.5 block w-full border-0 border-b border-[var(--rule-ledger)] bg-transparent px-0 py-2 text-[0.9375rem] focus:border-navy-800 focus:outline-none focus:ring-0";
const lbl = "block text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-500";

/** Change password, with the rules shown and ticked as you type. The server checks them again. */
export function PasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [seen, setSeen] = useState(state);
  const message = useRef<HTMLDivElement>(null);

  // After a successful change, empty the fields (adjusting state during render, not in an effect).
  if (seen !== state) {
    setSeen(state);
    if (state.done) {
      setNext("");
      setConfirm("");
    }
  }

  useEffect(() => {
    if (state.error || state.done) message.current?.focus();
  }, [state]);

  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const rules = [
    { ok: next.length >= 12, text: `At least 12 characters (${next.length} so far)` },
    { ok: next.length > 0 && !(local.length >= 3 && next.toLowerCase().includes(local)), text: `Does not contain “${local}”` },
    { ok: new Set(next).size >= 5, text: "A mix of at least 5 different characters" },
    { ok: next.length > 0 && next === confirm, text: "Both new passwords match" },
  ];
  const type = show ? "text" : "password";

  return (
    <form action={action} noValidate className="mt-5 space-y-5">
      {state.error || state.done ? (
        <div
          ref={message}
          tabIndex={-1}
          role={state.error ? "alert" : "status"}
          className={`border-l-2 px-4 py-3 text-[0.9375rem] outline-none ${state.error ? "border-[#9b2c2c] bg-[#fbeaea] text-[#7a1f1f]" : "border-[#2f6b3f] bg-[#eaf4ec] text-[#1f4d2b]"}`}
        >
          <strong className="font-semibold">{state.error ? "Password not changed. " : ""}</strong>
          {state.error ?? state.done}
        </div>
      ) : null}

      <label className={lbl}>
        Current password
        <input name="current" type={type} autoComplete="current-password" className={input} />
      </label>
      <span className="-mt-3 block text-[0.8125rem] text-ink-500">The temporary one you signed in with, if this is your first sign-in.</span>
      <label className={lbl}>
        New password
        <input name="next" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
      </label>
      <label className={lbl}>
        Repeat new password
        <input name="confirm" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </label>

      <label className="flex items-center gap-2.5 text-[0.875rem] text-ink-700">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-[#15294A]" />
        Show passwords
      </label>

      <ul aria-label="Password rules" className="space-y-1.5 text-[0.875rem]">
        {rules.map((r) => (
          <li key={r.text} className={`flex items-center gap-2.5 ${r.ok ? "text-[#1f4d2b]" : "text-ink-500"}`}>
            <span aria-hidden className={`flex h-4 w-4 items-center justify-center border text-[0.625rem] ${r.ok ? "border-[#2f6b3f] bg-[#2f6b3f] text-parchment-50" : "border-ink-400"}`}>
              {r.ok ? "✓" : ""}
            </span>
            <span>
              <span className="sr-only">{r.ok ? "Met: " : "Not met yet: "}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center bg-navy-800 px-4 text-[0.875rem] font-semibold text-parchment-50 transition-colors hover:bg-navy-950 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
