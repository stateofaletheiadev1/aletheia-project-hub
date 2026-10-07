'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { useState } from 'react';
import Link from '@/components/i18n/Link';
import {
  INVESTMENT_OPTIONS,
  MINIMUM_AGE,
  NATURALISATION_RESIDENCE_YEARS,
  formatAey,
  investmentTotal,
  type InvestmentOption,
} from '@/lib/citizenship';
import { ArrowRight, CheckCircle2, Circle, Coins, Landmark, ShieldCheck, XCircle } from 'lucide-react';

type Route = 'naturalisation' | 'investor';

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

export function EligibilityChecker() {
  const { t, tx, intl } = useI18n();
  const [route, setRoute] = useState<Route>('naturalisation');

  // Shared answers
  const [adult, setAdult] = useState<boolean | null>(null);
  const [cleanRecord, setCleanRecord] = useState<boolean | null>(null);
  const [oath, setOath] = useState<boolean | null>(null);

  // Naturalisation
  const [years, setYears] = useState(0);
  const [languages, setLanguages] = useState<boolean | null>(null);
  const [integration, setIntegration] = useState<boolean | null>(null);

  // Investor
  const [optionId, setOptionId] = useState<InvestmentOption['id']>('contribution');
  const [dependants, setDependants] = useState(0);
  const [diligence, setDiligence] = useState<boolean | null>(null);

  const option = INVESTMENT_OPTIONS.find((o) => o.id === optionId)!;
  const total = investmentTotal(option, dependants);

  const checks: Check[] = (() => {
    const shared: Check[] = [
      { label: t('Aged {age} or over', { age: MINIMUM_AGE }), met: adult === true, hint: 'Applicants under 18 are included through a parent’s application.' },
      { label: 'No serious criminal conviction in 10 years', met: cleanRecord === true, hint: 'Serious convictions bar every route to citizenship.' },
      { label: 'Willing to swear the Covenant Oath', met: oath === true, hint: 'No route circumvents the public Covenant Oath.' },
    ];
    if (route === 'naturalisation') {
      return [
        shared[0],
        {
          label: t('{years} years of lawful residence', { years: NATURALISATION_RESIDENCE_YEARS }),
          met: years >= NATURALISATION_RESIDENCE_YEARS,
          hint: t('You have {years} of {required} years. Lawful residence opens with territorial establishment — register interest via Immigration.', { years, required: NATURALISATION_RESIDENCE_YEARS }),
        },
        { label: 'English plus one more official language', met: languages === true, hint: 'Free language courses are provided to all lawful residents.' },
        { label: 'Civic Integration Programme completed', met: integration === true, hint: 'The programme and Covenant knowledge test are free and available online.' },
        shared[1],
        shared[2],
      ];
    }
    return [
      shared[0],
      { label: t('Qualifying investment of {amount}', { amount: formatAey(total, intl) }), met: true, hint: '' },
      { label: 'Consent to enhanced due diligence', met: diligence === true, hint: 'Source-of-funds, sanctions and anti-money-laundering screening is mandatory.' },
      shared[1],
      shared[2],
    ];
  })();

  const answered = route === 'naturalisation'
    ? [adult, languages, integration, cleanRecord, oath].every((v) => v !== null)
    : [adult, diligence, cleanRecord, oath].every((v) => v !== null);
  const eligible = checks.every((c) => c.met);
  const applyHref = route === 'investor' ? `/portal/apply?route=investor&option=${optionId}` : '/portal/apply?route=naturalisation';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* ── QUESTIONS ── */}
      <div className="lg:col-span-7 bg-white border border-navy/10 rounded-sm shadow-institutional">
        <div className="grid grid-cols-2 border-b border-navy/10" role="tablist" aria-label={t("Citizenship route")}>
          {([
            { id: 'naturalisation', icon: Landmark, title: 'Naturalisation', sub: t('{years} years’ residence', { years: NATURALISATION_RESIDENCE_YEARS }) },
            { id: 'investor', icon: Coins, title: 'Covenant Investor', sub: t('From {amount}', { amount: formatAey(INVESTMENT_OPTIONS[0].amount, intl) }) },
          ] as const).map(({ id, icon: Icon, title, sub }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={route === id}
              onClick={() => setRoute(id)}
              className={`p-5 text-left flex items-center gap-3 transition-colors border-b-2 ${
                route === id ? 'border-gold bg-parchment-light' : 'border-transparent hover:bg-parchment-light/60'
              }`}
            >
              <span className={`p-2 rounded-sm ${route === id ? 'bg-navy text-gold' : 'bg-navy/5 text-navy/50'}`}><Icon className="w-4 h-4" /></span>
              <span>
                <span className="block text-sm font-bold text-navy">{tx(title)}</span>
                <span className="block text-[11px] text-navy/50">{tx(sub)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-8" role="tabpanel">
          <YesNo id="adult" label={t('Are you aged {age} or over?', { age: MINIMUM_AGE })} value={adult} onChange={setAdult} />

          {tx(route === 'naturalisation' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="py-4 border-b border-navy/[0.07] space-y-3">
                <span className="text-sm font-medium text-navy block">{t("Choose your investment")}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {INVESTMENT_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOptionId(o.id)}
                      aria-pressed={optionId === o.id}
                      className={`text-left p-4 rounded-sm border transition-all ${
                        optionId === o.id ? 'border-navy bg-navy text-parchment shadow-elevated' : 'border-navy/15 hover:border-gold/60'
                      }`}
                    >
                      <span className={`block text-[10px] font-bold uppercase tracking-wider ${optionId === o.id ? 'text-gold' : 'text-gold-shadow'}`}>
                        {o.refundable ? t('Held {years} years · returned', { years: o.holdYears ?? 0 }) : t('One-time contribution')}
                      </span>
                      <span className="block text-sm font-bold mt-1">{tx(o.title)}</span>
                      <span className={`block text-lg font-extrabold mt-1 tabular-nums ${optionId === o.id ? 'text-gold-tint' : 'text-navy'}`}>{formatAey(o.amount, intl)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-navy/60 leading-relaxed">{tx(option.desc)}</p>
              </div>
              <div className="py-4 border-b border-navy/[0.07] flex items-center justify-between gap-4">
                <label htmlFor="deps" className="text-sm font-medium text-navy">{t("Spouse and dependent children to include")}<span className="block text-[11px] text-navy/50">+{formatAey(option.perDependant, intl)}{' '}{t("each")}</span>
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={t("Fewer family members")} onClick={() => setDependants((d) => Math.max(0, d - 1))} className="w-8 h-8 rounded-sm border border-navy/15 text-navy font-bold hover:border-gold">−</button>
                  <output id="deps" className="w-8 text-center font-bold text-navy tabular-nums">{tx(dependants)}</output>
                  <button type="button" aria-label={t("More family members")} onClick={() => setDependants((d) => Math.min(8, d + 1))} className="w-8 h-8 rounded-sm border border-navy/15 text-navy font-bold hover:border-gold">+</button>
                </div>
              </div>
              <YesNo id="dd" label={t("Will you consent to enhanced due diligence and source-of-funds checks?")} value={diligence} onChange={setDiligence} />
            </>
          ))}

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
              <span className={`block text-[10px] font-bold uppercase tracking-[0.2em] ${answered && eligible ? 'text-gold' : 'text-gold-shadow'}`}>
                {tx(route === 'investor' ? 'Covenant Investor route' : 'Naturalisation route')}
              </span>
              <span className={`block text-lg font-bold ${answered && eligible ? 'text-parchment' : 'text-navy'}`}>
                {tx(!answered ? 'Answer every question' : eligible ? 'You appear eligible' : 'Not yet eligible')}
              </span>
            </div>
          </div>

          {tx(route === 'investor' && (
            <div className={`mb-5 p-4 rounded-sm ${answered && eligible ? 'bg-navy/60 border border-gold/20' : 'bg-parchment-light border border-navy/10'}`}>
              <span className={`block text-[10px] uppercase tracking-wider ${answered && eligible ? 'text-parchment/55' : 'text-navy/50'}`}>{t("Total qualifying investment")}</span>
              <span className={`block text-2xl font-extrabold tabular-nums ${answered && eligible ? 'text-gold-tint' : 'text-navy'}`}>{formatAey(total, intl)}</span>
              <span className={`block text-[11px] ${answered && eligible ? 'text-parchment/55' : 'text-navy/50'}`}>
                {tx(option.title)}{tx(dependants > 0 ? ` · you + ${dependants} family member${dependants > 1 ? 's' : ''}` : '')}
              </span>
            </div>
          ))}

          <ul className="space-y-3">
            {checks.map((c) => {
              const Icon = c.met ? CheckCircle2 : answered ? XCircle : Circle;
              const tone = c.met ? 'text-laurel-light' : answered ? 'text-burgundy' : 'text-navy/25';
              return (
                <li key={c.label} className="flex gap-3">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${tone}`} />
                  <div>
                    <span className={`text-sm ${answered && eligible ? 'text-parchment/90' : 'text-navy'}`}>{tx(c.label)}</span>
                    {tx(answered && !c.met && c.hint && <p className="text-[11px] text-navy/55 mt-0.5">{tx(c.hint)}</p>)}
                  </div>
                </li>
              );
            })}
          </ul>

          {tx(answered && eligible && (
            <Link href={applyHref} className="btn-sovereign-gold mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-sm text-sm animate-pop-in">{t("Start your application")}{' '}<ArrowRight className="w-4 h-4" />
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-navy/50 leading-relaxed px-1">{t("This checker is guidance only. Citizenship is conferred by the Immigration Directorate after verification, and becomes effective when the Covenant Oath is sworn.")}</p>
      </aside>
    </div>
  );
}
