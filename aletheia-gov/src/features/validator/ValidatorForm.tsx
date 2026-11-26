"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { submitValidatorApplication } from "./actions";
import { HOSTING, type ValidatorState } from "./schema";

const field =
  "mt-2 block w-full border-0 border-b border-[var(--rule-ledger)] bg-transparent px-0 py-2.5 text-[1.0625rem] text-ink-900 placeholder:text-ink-500 focus:border-navy-800 focus:outline-none focus:ring-0 aria-[invalid=true]:border-[#9b2c2c]";
const label = "t-meta text-[0.6875rem] text-ink-600";
const hint = "mt-1.5 text-[0.8125rem] text-ink-500";

export function ValidatorForm() {
  const [state, action, pending] = useActionState<ValidatorState, FormData>(submitValidatorApplication, { status: "idle" });
  const startedAt = useRef<HTMLInputElement>(null);
  const token = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);

  // Set once in the browser: when the form was opened (spam check) and a token that makes a
  // double submit save only once. Without JavaScript both stay empty and are optional.
  useEffect(() => {
    if (startedAt.current && !startedAt.current.value) startedAt.current.value = String(Date.now());
    if (token.current && !token.current.value) token.current.value = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (state.status === "error") summary.current?.focus();
    if (state.status === "saved") done.current?.focus();
  }, [state]);

  if (state.status === "saved") {
    return (
      <div ref={done} tabIndex={-1} role="status" className="border-t-2 border-navy-800 pt-6 outline-none">
        <p className="t-h3">Thank you. Your application is recorded.</p>
        {state.reference ? (
          <>
            <p className="mt-3 text-[1rem] text-ink-700">
              Your reference: <span className="t-ref text-gold-700">{state.reference}</span>
            </p>
            <p className="mt-5 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-600">
              Keep this reference. When you register your node on AletheiaChain, give it with{" "}
              <code className="t-ref whitespace-nowrap">--licence {state.reference}</code>; only a fingerprint of it is written to the chain, and the Council uses it to match
              your node to this application.
            </p>
          </>
        ) : null}
        {state.profile ? <p className="mt-4 text-[0.9375rem] text-ink-700">Your organisation profile was received and stored encrypted.</p> : null}
        <p className="mt-5 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-600">
          The founding team reviews every application and writes to you as it progresses. If you applied before with the same email, this application is added to your earlier
          record under the same reference.
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : {};
  // After a failed submit React resets the form; refill it with what was typed.
  const v = state.status === "error" ? state.values : undefined;
  const err = (name: keyof typeof errors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="mt-1.5 text-[0.875rem] font-medium text-[#9b2c2c]">
        {errors[name]}
      </p>
    ) : null;
  const a11y = (name: keyof typeof errors) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `${name}-error` : undefined });
  const input = (name: keyof typeof errors & string, title: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, note?: string) => (
    <div>
      <label htmlFor={`validator-${name}`} className={label}>
        {title}
      </label>
      <input id={`validator-${name}`} name={name} defaultValue={v?.[name as keyof typeof v] as string | undefined} className={field} {...props} {...a11y(name)} />
      {note ? <p className={hint}>{note}</p> : null}
      {err(name)}
    </div>
  );

  return (
    <form action={action} noValidate className="space-y-9">
      {state.status === "error" ? (
        <div ref={summary} tabIndex={-1} role="alert" className="border-l-2 border-[#9b2c2c] bg-parchment-50 px-5 py-4 outline-none">
          <p className="font-semibold text-[#9b2c2c]">{state.message}</p>
          {Object.keys(errors).length ? (
            <ul className="mt-2 list-disc pl-5 text-[0.9375rem] text-ink-700">
              {Object.entries(errors).map(([k, message]) => (
                <li key={k}>
                  <a className="link-ledger" href={`#validator-${k}`}>
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <fieldset className="space-y-8">
        <legend className="text-[1.125rem] font-semibold">The applicant</legend>
        <div className="grid gap-8 md:grid-cols-2">
          {input("fullName", "Full name", { autoComplete: "name", required: true })}
          {input("email", "Email", { type: "email", autoComplete: "email", required: true })}
          {input("organisation", "Organisation (optional)", { autoComplete: "organization" }, "The company or body that will operate the validator, if any.")}
          {input("country", "Country you operate from", { autoComplete: "country-name", required: true })}
        </div>
        {input(
          "operatorAddress",
          "AletheiaChain operator account",
          { required: true, spellCheck: false, placeholder: "alt:…", className: `${field} font-mono` },
          "The account that registers the node, locks the bond and receives the rewards. Make it with aletheia-cli keys new or Aletheia Wallet.",
        )}
      </fieldset>

      <fieldset className="space-y-8">
        <legend className="text-[1.125rem] font-semibold">The server</legend>
        <div className="grid gap-8 md:grid-cols-2">
          {input("serverLocation", "Where the server is", { required: true, placeholder: "City, country" })}
          <div>
            <label htmlFor="validator-hosting" className={label}>
              How it is hosted
            </label>
            <select id="validator-hosting" name="hosting" defaultValue={v?.hosting ?? ""} required className={field} {...a11y("hosting")}>
              <option value="" disabled>
                Choose one
              </option>
              {HOSTING.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            {err("hosting")}
          </div>
        </div>
        {input(
          "specs",
          "CPUs, memory and storage",
          { required: true, placeholder: "e.g. 8 vCPU, 16 GB RAM, 500 GB NVMe" },
          "At least 4 virtual CPUs, 8 to 16 GB of memory and 200 GB of fast SSD storage.",
        )}
        <div>
          <label htmlFor="validator-experience" className={label}>
            Your experience running servers or nodes
          </label>
          <textarea id="validator-experience" name="experience" rows={5} maxLength={1500} required defaultValue={v?.experience} className={`${field} resize-y`} {...a11y("experience")} />
          <p className={hint}>Which systems you have run, for how long, and how you keep them online.</p>
          {err("experience")}
        </div>
        <div>
          <label htmlFor="validator-profile" className={label}>
            Organisation profile <span className="normal-case tracking-normal text-ink-500">(optional · PDF · up to 2 MB)</span>
          </label>
          <input
            id="validator-profile"
            name="profile"
            type="file"
            accept="application/pdf,.pdf"
            className="mt-2 block w-full text-[0.9375rem] text-ink-700 file:mr-4 file:border file:border-[var(--rule-ledger)] file:bg-parchment-50 file:px-4 file:py-2 file:text-[0.875rem] file:font-semibold file:text-navy-800 hover:file:border-navy-800"
            {...a11y("profile")}
          />
          {err("profile")}
          {v && !errors.profile ? <p className={hint}>If you attached a profile, please choose it again.</p> : null}
        </div>
      </fieldset>

      {/* Honeypot: hidden from people and assistive technology; bots fill it in. */}
      <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label htmlFor="validator-website">Website</label>
        <input id="validator-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAt} type="hidden" name="startedAt" defaultValue="" />
      <input ref={token} type="hidden" name="token" defaultValue="" />

      <div>
        <label className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ink-700">
          <input id="validator-consent" name="consent" type="checkbox" defaultChecked={v?.consent} className="mt-1 h-4 w-4 shrink-0 accent-[#15294A]" {...a11y("consent")} />
          <span>
            I agree that the founding government keeps these details, encrypted, for up to 12 months to assess this application and contact me about it. Nothing personal is
            written to the chain. See the{" "}
            <Link className="link-ledger" href="/privacy">
              privacy notice
            </Link>
            .
          </span>
        </label>
        {err("consent")}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center gap-3 bg-navy-800 px-6 text-[0.9375rem] font-semibold text-parchment-50 transition-colors hover:bg-navy-950 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send application"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
