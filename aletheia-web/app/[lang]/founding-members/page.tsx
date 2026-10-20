'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { CheckCircle2, Users, Compass, MessageSquare } from 'lucide-react';

type State = { phase: 'idle' | 'sending' | 'done' | 'error'; message?: string };

const FIELD = 'w-full px-4 py-2.5 text-sm bg-white border border-navy/20 rounded-sm text-navy placeholder:text-navy/35 focus:outline-none focus:border-navy focus:ring-2 focus:ring-gold/30';
const LABEL = 'block text-xs font-bold text-navy uppercase tracking-wider mb-1.5';

export default function FoundingMembersPage() {
  const { t, tx } = useI18n();
  const [state, setState] = useState<State>({ phase: 'idle' });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ phase: 'sending' });
    try {
      const res = await fetch('/api/founding-members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          country: form.get('country'),
          contribution: form.get('contribution'),
          consent: form.get('consent') === 'on',
          website: form.get('website'),
        }),
      });
      if (res.ok) {
        setState({ phase: 'done' });
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ phase: 'error', message: data?.error });
    } catch {
      setState({ phase: 'error' });
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="Founding Members"
        image="friendsSunset"
        title="Become a Founding Member"
        lead="Aletheia is forming its founding community: the people who will shape its institutions, help build its first platform, and, in time, live on it."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* What it means */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-3">
              <div className="eyebrow">{t("The Founding Community")}</div>
              <h2 className="text-3xl font-bold text-navy tracking-tight">{t("What registering means")}</h2>
              <p className="text-sm text-navy/70 leading-relaxed">{t("Registering interest tells us you would like to follow and support the founding of Aletheia. We will write to you with founding-phase news and, where it fits, ways to contribute.")}</p>
            </div>

            <ul className="space-y-4">
              {[
                { icon: Users, title: 'A founding community', desc: 'People with skills in law, engineering, finance, diplomacy, design and public service.' },
                { icon: Compass, title: 'Honest about where we are', desc: 'Aletheia holds no territory and exercises no legal authority. Registering confers no status, rights or citizenship.' },
                { icon: MessageSquare, title: 'Occasional, useful contact', desc: 'Founding-phase updates only. You can ask us to delete your details at any time.' },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-4">
                  <div className="p-2.5 bg-navy text-gold rounded-sm shrink-0">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-navy">{tx(title)}</h3>
                    <p className="text-xs text-navy/65 leading-relaxed">{tx(desc)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-sm font-semibold text-navy border-l-[3px] border-gold pl-4 py-1">{t("Registering interest is free. Aletheia does not sell citizenship, residency, passports or currency.")}</p>
          </div>

          {/* The form */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-navy/15 rounded-sm shadow-sm p-6 sm:p-8">
              {state.phase === 'done' ? (
                <div role="status" className="py-10 text-center space-y-4">
                  <CheckCircle2 className="w-10 h-10 text-laurel mx-auto" aria-hidden="true" />
                  <h2 className="text-2xl font-bold text-navy">{t("Thank you for registering your interest.")}</h2>
                  <p className="text-sm text-navy/70 max-w-md mx-auto leading-relaxed">{t("We have your details. We will write to you with founding-phase news. Nothing more is needed from you.")}</p>
                  <Link href="/roadmap" className="inline-block text-sm font-bold text-navy underline underline-offset-2 decoration-gold hover:text-gold-shadow">{t("Read the roadmap")}</Link>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5" noValidate={false}>
                  <h2 className="text-xl font-bold text-navy">{t("Register interest as a Founding Member")}</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="fm-name" className={LABEL}>{t("Name")}</label>
                      <input id="fm-name" name="name" type="text" required maxLength={120} autoComplete="name" className={FIELD} />
                    </div>
                    <div>
                      <label htmlFor="fm-email" className={LABEL}>{t("Email")}</label>
                      <input id="fm-email" name="email" type="email" required maxLength={254} autoComplete="email" className={FIELD} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fm-country" className={LABEL}>{t("Country")}</label>
                    <input id="fm-country" name="country" type="text" required maxLength={80} autoComplete="country-name" className={FIELD} />
                  </div>

                  <div>
                    <label htmlFor="fm-contribution" className={LABEL}>
                      {t("How you’d like to contribute")}{' '}<span className="normal-case font-normal tracking-normal text-navy/50">{t("(optional)")}</span>
                    </label>
                    <textarea id="fm-contribution" name="contribution" rows={4} maxLength={1000} className={FIELD} />
                  </div>

                  {/* Hidden from people; automated submissions tend to fill it. */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="fm-website">Website</label>
                    <input id="fm-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </div>

                  <div className="flex items-start gap-3">
                    <input id="fm-consent" name="consent" type="checkbox" required className="mt-1 w-4 h-4 accent-navy shrink-0" />
                    <label htmlFor="fm-consent" className="text-xs text-navy/75 leading-relaxed">
                      {t("I agree that Aletheia may store these details to contact me about the founding of Aletheia, as described in the")}{' '}
                      <Link href="/privacy" className="font-semibold text-navy underline underline-offset-2 decoration-gold">{t("Privacy Notice")}</Link>.{' '}
                      {t("I can withdraw at any time.")}
                    </label>
                  </div>

                  <p className="text-xs text-navy/60">{t("Registering interest is free. Aletheia does not sell citizenship, residency, passports or currency.")}</p>

                  {state.phase === 'error' && (
                    <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                      {state.message ? tx(state.message) : t("Something went wrong. Please try again, or write to us through the contact page.")}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={state.phase === 'sending'}
                    className="btn-sovereign-gold px-7 py-3 rounded-sm text-sm font-bold uppercase tracking-wider disabled:opacity-60"
                  >
                    {state.phase === 'sending' ? t("Sending…") : t("Register interest")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
