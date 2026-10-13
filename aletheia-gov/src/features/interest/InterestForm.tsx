"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { submitInterest } from "./actions";
import { POSITION_TYPES, positionName } from "@/content/positions";
import { ANY_INSTITUTION, EXPERTISE, institutionName, type InterestState } from "./schema";

type Group = { title: string; options: { slug: string; name: string }[] };

const field =
  "mt-2 block w-full border-0 border-b border-[var(--rule-ledger)] bg-transparent px-0 py-2.5 text-[1.0625rem] text-ink-900 placeholder:text-ink-500 focus:border-navy-800 focus:outline-none focus:ring-0 aria-[invalid=true]:border-[#9b2c2c]";
const label = "t-meta text-[0.6875rem] text-ink-600";

export function InterestForm({ groups, preselected }: { groups: Group[]; preselected?: string }) {
  const [state, action, pending] = useActionState<InterestState, FormData>(submitInterest, { status: "idle" });
  const startedAt = useRef<HTMLInputElement>(null);
  const token = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);

  // Set once in the browser: when the form was opened (spam check) and a token that makes
  // a double submit save only once. Without JavaScript both stay empty and are optional.
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
        <p className="t-h3">Thank you. Your interest is recorded.</p>
        {state.reference ? (
          <p className="mt-3 text-[1rem] text-ink-700">
            Your reference: <span className="t-ref text-gold-700">{state.reference}</span>
          </p>
        ) : null}
        {state.positionTypes.length ? (
          <>
            <p className="t-meta mt-6 text-[0.6875rem] text-ink-500">Kinds of position</p>
            <ul className="mt-2 space-y-1 text-[0.9375rem] text-ink-800">
              {state.positionTypes.map((s) => (
                <li key={s}>— {positionName(s)}</li>
              ))}
            </ul>
          </>
        ) : null}
        {state.institutions.length ? (
          <>
            <p className="t-meta mt-6 text-[0.6875rem] text-ink-500">Registered just now for</p>
            <ul className="mt-2 space-y-1 text-[0.9375rem] text-ink-800">
              {state.institutions.map((s) => (
                <li key={s}>— {institutionName(s)}</li>
              ))}
            </ul>
          </>
        ) : null}
        {state.cv ? <p className="mt-4 text-[0.9375rem] text-ink-700">Your CV was received and stored encrypted.</p> : null}
        <p className="mt-5 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ink-600">
          If you registered before with the same email, these are added to your earlier registration under the same reference. No email was sent: confirmation emails
          are not set up yet. Open positions are published on the{" "}
          <Link className="link-ledger" href="/opportunities">
            register of opportunities
          </Link>
          .
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : {};
  // After a failed submit React resets the form; refill it with what was typed.
  const v = state.status === "error" ? state.values : undefined;
  const ticked = (slug: string) => (v ? v.institutions.includes(slug) : slug === preselected);
  const typeTicked = (slug: string) => (v ? v.positionTypes.includes(slug) : false);
  const err = (name: keyof typeof errors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="mt-1.5 text-[0.875rem] font-medium text-[#9b2c2c]">
        {errors[name]}
      </p>
    ) : null;
  const a11y = (name: keyof typeof errors) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `${name}-error` : undefined });

  return (
    <form action={action} noValidate className="space-y-9">
      {state.status === "error" ? (
        <div ref={summary} tabIndex={-1} role="alert" className="border-l-2 border-[#9b2c2c] bg-parchment-50 px-5 py-4 outline-none">
          <p className="font-semibold text-[#9b2c2c]">{state.message}</p>
          {Object.keys(errors).length ? (
            <ul className="mt-2 list-disc pl-5 text-[0.9375rem] text-ink-700">
              {Object.entries(errors).map(([k, v]) => (
                <li key={k}>
                  <a className="link-ledger" href={`#interest-${k}`}>
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <label htmlFor="interest-fullName" className={label}>
            Full name
          </label>
          <input id="interest-fullName" name="fullName" autoComplete="name" required defaultValue={v?.fullName} className={field} {...a11y("fullName")} />
          {err("fullName")}
        </div>
        <div>
          <label htmlFor="interest-email" className={label}>
            Email
          </label>
          <input id="interest-email" name="email" type="email" autoComplete="email" required defaultValue={v?.email} className={field} {...a11y("email")} />
          {err("email")}
        </div>
      </div>

      <fieldset id="interest-positionTypes" {...a11y("positionTypes")}>
        <legend className={label}>Kinds of position you are interested in</legend>
        <p className="mt-1.5 text-[0.875rem] text-ink-500">Choose as many as you like.</p>
        <ul className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
          {POSITION_TYPES.map((p) => (
            <li key={p.slug}>
              <label className="flex items-start gap-3 text-[0.9375rem] leading-snug text-ink-800">
                <input type="checkbox" name="positionTypes" value={p.slug} defaultChecked={typeTicked(p.slug)} className="mt-[3px] h-4 w-4 shrink-0 accent-[#15294A]" />
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-[0.8125rem] text-ink-500">{p.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {err("positionTypes")}
      </fieldset>

      <fieldset id="interest-institutions" {...a11y("institutions")}>
        <legend className={label}>Institutions you would like to work in</legend>
        <p className="mt-1.5 text-[0.875rem] text-ink-500">Choose as many as you like.</p>
        <label className="mt-4 flex items-center gap-3 border-y border-[var(--rule-ledger)] py-3 text-[1rem] font-medium">
          <input type="checkbox" name="institutions" value={ANY_INSTITUTION} defaultChecked={ticked(ANY_INSTITUTION)} className="h-4 w-4 accent-[#15294A]" />
          {institutionName(ANY_INSTITUTION)}
        </label>
        <div className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="t-meta text-[0.625rem] text-gold-700">{g.title}</p>
              <ul className="mt-2 space-y-1.5">
                {g.options.map((o) => (
                  <li key={o.slug}>
                    <label className="flex items-start gap-3 text-[0.9375rem] leading-snug text-ink-800">
                      <input type="checkbox" name="institutions" value={o.slug} defaultChecked={ticked(o.slug)} className="mt-[3px] h-4 w-4 shrink-0 accent-[#15294A]" />
                      {o.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {err("institutions")}
      </fieldset>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <label htmlFor="interest-expertise" className={label}>
            Main area of expertise
          </label>
          <select id="interest-expertise" name="expertise" defaultValue={v?.expertise ?? ""} required className={field} {...a11y("expertise")}>
            <option value="" disabled>
              Choose one
            </option>
            {EXPERTISE.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          {err("expertise")}
        </div>
        <div>
          <label htmlFor="interest-cv" className={label}>
            CV <span className="normal-case tracking-normal text-ink-500">(PDF · up to 2 MB)</span>
          </label>
          <input
            id="interest-cv"
            name="cv"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="mt-2 block w-full text-[0.9375rem] text-ink-700 file:mr-4 file:border file:border-[var(--rule-ledger)] file:bg-parchment-50 file:px-4 file:py-2 file:text-[0.875rem] file:font-semibold file:text-navy-800 hover:file:border-navy-800"
            {...a11y("cv")}
          />
          {err("cv")}
          {v && !errors.cv ? <p className="mt-1.5 text-[0.8125rem] text-ink-500">Please choose your CV again.</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="interest-note" className={label}>
          What would you bring? <span className="normal-case tracking-normal text-ink-500">(optional)</span>
        </label>
        <textarea id="interest-note" name="note" rows={4} maxLength={1000} defaultValue={v?.note} className={`${field} resize-y`} {...a11y("note")} />
        {err("note")}
      </div>

      {/* Honeypot: hidden from people and assistive technology; bots fill it in. */}
      <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label htmlFor="interest-website">Website</label>
        <input id="interest-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAt} type="hidden" name="startedAt" defaultValue="" />
      <input ref={token} type="hidden" name="token" defaultValue="" />

      <div>
        <label className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ink-700">
          <input id="interest-consent" name="consent" type="checkbox" defaultChecked={v?.consent} className="mt-1 h-4 w-4 shrink-0 accent-[#15294A]" {...a11y("consent")} />
          <span>
            I agree that the founding government keeps these details and my CV, encrypted, for up to 12 months to contact me about positions of the kinds I chose. See the{" "}
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
        {pending ? "Saving…" : "Register interest"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
