'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { useState } from 'react';
import Link from '@/components/i18n/Link';
import { MINIMUM_AGE, NATURALISATION_RESIDENCE_YEARS } from '@/lib/citizenship';
import { ArrowRight, CheckCircle2, Circle, Landmark, ShieldCheck, XCircle } from 'lucide-react';

interface Check {
  label: string;
  met: boolean;
  hint: string;
}

function YesNo({ id, label, value, onChange }: { id: string; label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  const { tx } = useI18n();
  return (
    <fieldset className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-navy/[0.07]">
      <legend className="sr-only">{tx(label)}</legend>
      <span className="text-sm font-medium text-navy" id={`${id}-label`}>{tx(label)}</span>
      <div className="flex gap-2 shrink-0" role="radiogroup" aria-labelledby={`${id}-label`}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm border transition-all ${
              value === v ? 'bg-navy text-gold border-navy' : 'bg-white text-navy/60 border-navy/15 hover:border-gold/60'
            }`}
          >
            {tx(v ? 'Yes' : 'No')}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Naturalisation eligibility (the only route besides birth). Behind FEATURE_APPLICATIONS. */
export function EligibilityChecker() {
  const { t, tx } = useI18n();

  const [adult, setAdult] = useState<boolean | null>(null);
  const [cleanRecord, setCleanRecord] = useState<boolean | null>(null);
  const [oath, setOath] = useState<boolean | null>(null);
  const [years, setYears] = useState(0);
  const [languages, setLanguages] = useState<boolean | null>(null);
  const [integration, setIntegration] = useState<boolean | null>(null);

  const checks: Check[] = [
    { label: t('Aged {age} or over', { age: MINIMUM_AGE }), met: adult === true, hint: 'Applicants under 18 are included through a parent’s application.' },
    {
      label: t('{years} years of lawful residence', { years: NATURALISATION_RESIDENCE_YEARS }),
      met: years >= NATURALISATION_RESIDENCE_YEARS,
      hint: t('You have {years} of {required} years. Lawful residence opens with territorial establishment — register interest via Immigration.', { years, required: NATURALISATION_RESIDENCE_YEARS }),
    },
    { label: 'English plus one more official language', met: languages === true, hint: 'Free language courses are provided to all lawful residents.' },
    { label: 'Civic Integration Programme completed', met: integration === true, hint: 'The programme and Covenant knowledge test are free and available online.' },
    { label: 'No serious criminal conviction in 10 years', met: cleanRecord === true, hint: 'Serious convictions bar every route to citizenship.' },
    { label: 'Willing to swear the Covenant Oath', met: oath === true, hint: 'No route circumvents the public Covenant Oath.' },
  ];

  const answered = [adult, languages, integration, cleanRecord, oath].every((v) => v !== null);
  const eligible = checks.every((c) => c.met);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* ── QUESTIONS ── */}
      <div className="lg:col-span-7 bg-white border border-navy/10 rounded-sm shadow-institutional">
        <div className="p-5 flex items-center gap-3 border-b border-navy/10 bg-parchment-light">
          <span className="p-2 rounded-sm bg-navy text-gold"><Landmark className="w-4 h-4" /></span>
          <span>
            <span className="block text-sm font-bold text-navy">{t("Naturalisation")}</span>
            <span className="block text-[11px] text-navy/50">{t('{years} years’ residence', { years: NATURALISATION_RESIDENCE_YEARS })}</span>
          </span>
        </div>

        <div className="p-6 sm:p-8">
          <YesNo id="adult" label={t('Are you aged {age} or over?', { age: MINIMUM_AGE })} value={adult} onChange={setAdult} />
          <div className="py-4 border-b border-navy/[0.07] space-y-3">
            <label htmlFor="years" className="flex justify-between text-sm font-medium text-navy">
              <span>{t("Years of lawful residence in Aletheia")}</span>
              <span className="font-bold tabular-nums">{tx(years)}{tx(years >= 10 ? '+' : '')}</span>
            </label>
            <input
              id="years"
              type="range"
              min={0}
              max={10}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full accent-[#15294A]"
            />
          </div>
          <YesNo id="lang" label={t("Civic proficiency in English and one more official language?")} value={languages} onChange={setLanguages} />
          <YesNo id="integ" label={t("Completed the Civic Integration Programme?")} value={integration} onChange={setIntegration} />
          <YesNo id="record" label={t("Free of serious criminal convictions in the past 10 years?")} value={cleanRecord} onChange={setCleanRecord} />
          <YesNo id="oath" label={t("Will you swear the public Covenant Oath?")} value={oath} onChange={setOath} />
        </div>
      </div>

      {/* ── RESULT ── */}
      <aside className="lg:col-span-5 lg:sticky lg:top-28 h-fit space-y-4" aria-live="polite">
        <div className={`rounded-sm p-7 border shadow-elevated transition-colors duration-500 ${
          answered && eligible ? 'bg-navy-deep text-parchment border-gold/50 gold-glow' : 'bg-white border-navy/10'
        }`}>
          <div className="flex items-center gap-3 mb-5">
            <ShieldCheck className={`w-6 h-6 ${answered && eligible ? 'text-gold' : 'text-navy/40'}`} />
            <div>
              <span className={`block text-[10px] font-bold uppercase tracking-[0.2em] ${answered && eligible ? 'text-gold' : 'text-gold-shadow'}`}>{t("Naturalisation route")}</span>
              <span className={`block text-lg font-bold ${answered && eligible ? 'text-parchment' : 'text-navy'}`}>
                {tx(!answered ? 'Answer every question' : eligible ? 'You appear eligible' : 'Not yet eligible')}
              </span>
            </div>
          </div>

          <ul className="space-y-3">
            {checks.map((c) => {
              const Icon = c.met ? CheckCircle2 : answered ? XCircle : Circle;
              const tone = c.met ? 'text-laurel-light' : answered ? 'text-burgundy' : 'text-navy/25';
              return (
                <li key={c.label} className="flex gap-3">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${tone}`} />
                  <div>
                    <span className={`text-sm ${answered && eligible ? 'text-parchment/90' : 'text-navy'}`}>{tx(c.label)}</span>
                    {answered && !c.met && c.hint && <p className="text-[11px] text-navy/55 mt-0.5">{tx(c.hint)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>

          {answered && eligible && (
            <Link href="/portal/apply?route=naturalisation" className="btn-sovereign-gold mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-sm text-sm animate-pop-in">{t("Start your application")}{' '}<ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <p className="text-[11px] text-navy/50 leading-relaxed px-1">{t("This checker is guidance only. Citizenship is conferred by the Immigration Directorate after verification, and becomes effective when the Covenant Oath is sworn.")}</p>
      </aside>
    </div>
  );
}
