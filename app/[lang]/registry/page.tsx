'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { CountUp } from '@/components/ui/CountUp';
import { MonthlyColumns } from '@/components/ui/MonthlyColumns';
import {
  compactAey,
  getRegistrySnapshot,
  monthLabel,
  totalCitizens,
  totalRaised,
} from '@/lib/national-registry';
import { formatGazetteDate } from '@/lib/gazette';
import { ArrowRight, Building2, Coins, Info, Landmark, Users } from 'lucide-react';

/** Horizontal bar list: one navy series, every row labelled (few rows, ranked). */
function BarList({ rows, max, format }: { rows: { label: string; value: number; note?: string; href?: string }[]; max: number; format: (n: number) => string }) {
  const { tx, intl } = useI18n();
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const label = r.href ? (
          <Link href={r.href} className="hover:text-gold-shadow transition-colors">{tx(r.label)}</Link>
        ) : r.label;
        return (
          <li key={r.label} className="group" data-reveal>
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <span className="text-sm font-semibold text-navy">{tx(label)}</span>
              <span className="text-sm font-bold text-navy tabular-nums whitespace-nowrap">{format(r.value)}</span>
            </div>
            <div className="h-2.5 bg-navy/[0.06] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-navy group-hover:bg-gold-shadow rounded-r-[4px] transition-colors duration-300"
                style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }}
              />
            </div>
            {tx(r.note && <p className="text-[11px] text-navy/50 mt-1">{tx(r.note)}</p>)}
          </li>
        );
      })}
    </ul>
  );
}

export default function RegistryPage() {
  const { t, tx, intl } = useI18n();
  const s = getRegistrySnapshot();
  const citizens = totalCitizens(s);
  const raised = totalRaised(s);
  const progress = raised / s.phaseOneTarget;
  const c = s.registrations.citizens;

  const citizenRows = [
    { label: 'Covenant Investor route', value: c.investor, note: 'Qualifying investment, due diligence and the Covenant Oath' },
    { label: 'Founding citizens', value: c.founding, note: 'The founding cohort of the Covenant' },
    { label: 'Citizenship by covenant award', value: c.covenantAward, note: 'Outstanding service, ratified by the Covenant Assembly' },
    { label: 'Naturalisation by residence', value: c.naturalised, note: 'Opens once territorial residence has begun' },
  ];

  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow={t("National Registry & Revenue")}
        status="Under Development"
        image="marketChart"
        title={<>{t("Who has joined, and what")}{' '}<span className="text-gold-metallic">{t("we have raised.")}</span></>}
        lead={t("Every registration and every guilder raised to build the Sovereign Covenant State, published in one place. Proof is the default — the numbers the State relies on are the numbers the public can see.")}
      >
        <Link href="/citizenship/apply" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">{t("Apply for citizenship")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/e-residency" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("Become an e-resident")}</Link>
      </PageHero>

      {/* ── DATA NOTICE ── */}
      {tx(s.source === 'demonstration' && (
        <div className="bg-gold/10 border-b border-gold/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-3 text-xs text-navy/80">
            <Info className="w-4 h-4 text-gold-shadow shrink-0 mt-0.5" />
            <p>
              <strong className="text-navy">{t("Demonstration figures.")}</strong>{' '}{t("The live registry feed is under development; figures shown are illustrative as of")}{' '}{formatGazetteDate(s.asOf, intl)}{' '}{t("and will be replaced by ledger-attested data when the feed is connected.")}</p>
          </div>
        </div>
      ))}

      {/* ── HEADLINE TILES ── */}
      <section className="bg-navy-deep border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-gold/15 gap-y-2">
          {[
            { icon: Users, label: 'Registered e-residents', node: <CountUp value={s.registrations.eResidents} />, sub: t('{count} applications in review', { count: s.registrations.eResidencyApplicationsPending.toLocaleString(intl) }) },
            { icon: Landmark, label: 'Citizens of the Covenant', node: <CountUp value={citizens} />, sub: 'All routes, Oath sworn' },
            { icon: Building2, label: 'Registered companies', node: <CountUp value={s.registrations.companies} />, sub: 'Corporate registry' },
            { icon: Coins, label: 'Raised to date', node: <><CountUp value={raised} format="aey-compact" /> <span className="text-base">{t("AEY")}</span></>, sub: '1 AEY = 1 EUR' },
          ].map(({ icon: Icon, label, node, sub }) => (
            <div key={label} className="py-8 px-4 sm:px-6 text-center space-y-1.5">
              <Icon className="w-4 h-4 text-gold mx-auto mb-2" />
              <div className="big-stat-value">{tx(node)}</div>
              <div className="text-xs font-semibold text-parchment/90">{tx(label)}</div>
              <div className="text-[10px] text-parchment/45">{tx(sub)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FUNDING PROGRESS ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sovereign-card-premium rounded-sm p-8 lg:p-10 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2">
                <div className="eyebrow">{t("Building the Sovereign Covenant State")}</div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-navy">
                  {Math.round(progress * 100)}{t("% of the Phase 1 build-out is funded.")}</h2>
              </div>
              <p className="text-sm text-navy/60 max-w-md">
                {compactAey(raised, intl)}{' '}{t("raised against a Phase 1 target of")}{' '}{compactAey(s.phaseOneTarget, intl)}{' '}{t("for the port, the capital and the grid.")}</p>
            </div>
            <div
              className="relative h-5 bg-navy/[0.07] rounded-[4px] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={t("Phase 1 funding progress")}
            >
              <div className="progress-bar-sovereign-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-navy/50">
              <span>0</span>
              <span>{t("Target")}{' '}{compactAey(s.phaseOneTarget, intl)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVENUE & ALLOCATION ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white border border-navy/10 rounded-sm shadow-institutional p-8 space-y-6">
            <div className="space-y-1">
              <div className="eyebrow">{t("Where it comes from")}</div>
              <h2 className="text-2xl font-bold text-navy">{t("Funds raised by source")}</h2>
              <p className="text-xs text-navy/55">{t("No personal income tax: the Sovereign Covenant State is funded by capital, fees and concessions.")}</p>
            </div>
            <BarList
              rows={s.revenue.map((r) => ({ label: r.label, value: r.amount, note: r.note }))}
              max={Math.max(...s.revenue.map((r) => r.amount))}
              format={(n) => compactAey(n, intl)}
            />
            <div className="pt-4 border-t border-navy/10 flex justify-between text-sm font-bold text-navy">
              <span>{t("Total raised")}</span>
              <span className="tabular-nums">{raised.toLocaleString(intl)}{' '}{t("AEY")}</span>
            </div>
          </div>

          <div className="bg-white border border-navy/10 rounded-sm shadow-institutional p-8 space-y-6">
            <div className="space-y-1">
              <div className="eyebrow">{t("Where it goes")}</div>
              <h2 className="text-2xl font-bold text-navy">{t("Committed allocation")}</h2>
              <p className="text-xs text-navy/55">{t("Share of raised capital committed to each programme. Every disbursement is receipted on the ledger.")}</p>
            </div>
            <BarList
              rows={s.allocation.map((a) => ({ label: a.label, value: a.share, href: a.href, note: compactAey(a.share * raised, intl) }))}
              max={1}
              format={(n) => `${Math.round(n * 100)}%`}
            />
            <Link href="/transparency" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy hover:text-gold-shadow transition-colors group">{t("Audit the receipts")}{' '}<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── MEMBERSHIP ── */}
      <section className="section-lg bg-parchment-light border-y border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-5">
            <div className="eyebrow">{t("Citizenship by route")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">
              {t('{count} citizens have sworn the Covenant Oath.', { count: citizens.toLocaleString(intl) })}</h2>
            <p className="text-navy/65 leading-[1.85] font-light">{t('A further {count} people have registered interest in lawful residence, which opens with territorial establishment and starts the five-year path to naturalisation.', { count: s.registrations.residencyInterest.toLocaleString(intl) })}</p>
            <Link href="/citizenship/apply" className="btn-sovereign-navy inline-flex items-center gap-2 px-6 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider">{t("Check your eligibility")}{' '}<ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="lg:col-span-7 bg-white border border-navy/10 rounded-sm shadow-institutional p-8">
            <BarList rows={citizenRows} max={Math.max(...citizenRows.map((r) => r.value))} format={(n) => n.toLocaleString(intl)} />
          </div>
        </div>
      </section>

      {/* ── TRENDS ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="space-y-2">
            <div className="eyebrow">{t("Last twelve months")}</div>
            <h2 className="text-3xl font-bold tracking-tight text-navy">{t("New registrations")}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-navy/10 rounded-sm shadow-institutional p-6 sm:p-8">
              <MonthlyColumns title={t("New e-residents")} unit={t("e-residents")} data={s.monthly.map((m) => ({ label: monthLabel(m.month, intl), value: m.eResidents }))} />
            </div>
            <div className="bg-white border border-navy/10 rounded-sm shadow-institutional p-6 sm:p-8">
              <MonthlyColumns title={t("New citizens")} unit={t("citizens")} data={s.monthly.map((m) => ({ label: monthLabel(m.month, intl), value: m.citizens }))} />
            </div>
          </div>
        </div>
      </section>

      <section className="cta-banner py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-3xl font-bold text-parchment">{t("Add your name to the register.")}</h2>
            <p className="text-parchment/60 text-sm font-light">{t("Join as an e-resident today, or become a citizen through naturalisation or the Covenant Investor route.")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/citizenship/apply" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm">{t("Apply for citizenship")}</Link>
            <Link href="/portal/apply" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("Apply for e-residency")}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
