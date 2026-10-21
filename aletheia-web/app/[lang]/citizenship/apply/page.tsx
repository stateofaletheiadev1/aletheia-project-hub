'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { NATURALISATION_CRITERIA, NATURALISATION_RESIDENCE_YEARS } from '@/lib/citizenship';
import { EligibilityChecker } from './EligibilityChecker';
import { ArrowRight, CheckCircle2, Clock, FileCheck2, Fingerprint, ScrollText } from 'lucide-react';

const PROCESS = [
  { icon: FileCheck2, title: 'Apply online', desc: 'Submit identity documents through the citizen portal.' },
  { icon: Fingerprint, title: 'Verification', desc: 'Biometric enrolment and background checks.' },
  { icon: Clock, title: 'Decision', desc: 'A reasoned decision within 90 days of complete documentation, appealable to the High Court.' },
  { icon: ScrollText, title: 'The Covenant Oath', desc: 'Citizenship takes effect when the Oath is sworn in public.' },
];

export default function CitizenshipApplyPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow={t("Apply for Citizenship")}
        status="Proposed"
        image="lawLibrary"
        title={<>{t("Two routes to the")}{' '}<span className="text-gold-metallic">{t("Covenant.")}</span></>}
        lead={t('Citizenship by birth, or through {years} years of lawful residence. Check your eligibility in under a minute.', { years: NATURALISATION_RESIDENCE_YEARS })}
      >
        <Link href="#checker" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">{t("Check eligibility")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/registry" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("See the national register")}</Link>
      </PageHero>

      {/* ── ROUTES ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="feature-card rounded-sm p-8 space-y-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-shadow">{t("Route 01")}</span>
            <h2 className="text-2xl font-bold text-navy">{t("Naturalisation by residence")}</h2>
            <p className="text-sm text-navy/65 leading-relaxed">{t("For those who make their life in Aletheia. Earned through residence, language and civic integration.")}</p>
            <ul className="space-y-2.5">
              {NATURALISATION_CRITERIA.map((c) => (
                <li key={c} className="flex gap-2.5 text-sm text-navy"><CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" /> {tx(c)}</li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-sm p-8 space-y-5 bg-navy-deep text-parchment border border-gold/35 gold-glow">
            <div className="orb-gold w-[320px] h-[320px] -top-32 -right-24 opacity-40" />
            <div className="relative space-y-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{t("Route 02")}</span>
              <h2 className="text-2xl font-bold">{t("Citizenship by birth")}</h2>
              <p className="text-sm text-parchment/70 leading-relaxed">{t("A child of an Aletheian citizen is a citizen by birth. Citizenship is never granted in return for investment or payment.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHECKER ── */}
      <section id="checker" className="section-lg bg-parchment-light border-y border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">{t("Eligibility Checker")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy">{t("Are you ready to join?")}</h2>
          </div>
          <EligibilityChecker />
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">{t("What happens next")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy">{t("From application to Oath.")}</h2>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {PROCESS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="sovereign-card-premium rounded-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="icon-sovereign"><Icon className="w-5 h-5 text-gold" /></div>
                  <span className="font-mono text-xs font-bold text-gold-shadow">0{tx(i + 1)}</span>
                </div>
                <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                <p className="text-sm text-navy/62 leading-relaxed">{tx(desc)}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-navy/50 max-w-3xl">{t("Governed by Part IV of the draft Constitution and the Aletheian Nationality & Citizenship Act. Citizenship is never granted for investment or payment.")}</p>
        </div>
      </section>
    </div>
  );
}
