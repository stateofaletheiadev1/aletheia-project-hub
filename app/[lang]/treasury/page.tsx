'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Coins,
  TrendingUp,
  ShieldCheck,
  Building2,
  PieChart,
  ArrowRight,
  CheckCircle2,
  Lock,
  LineChart,
  Landmark,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export default function TreasuryPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="financeDocs" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Ministry of Treasury & Finance")}</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">{t("The Sovereign Treasury & Endowment")}</h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light">{t("Governance without coercion: Aletheia finances the Sovereign Covenant State entirely through sovereign asset yields, maritime logistics concessions, and institutional registry services — with personal income tax constitutionally banned.")}</p>
          </div>
        </div>
      </section>

      {/* ── KEY BALANCE SHEET METRICS ── */}
      <section className="bg-[#060C14] border-b border-gold/25 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-gold/15 gap-y-2">
            {[
              { value: '2.45B AEY', label: 'Endowment Fund', sublabel: 'Covenant capital base' },
              { value: '0.0%', label: 'Income Tax', sublabel: 'Constitutionally banned' },
              { value: '142%', label: 'Reserve Ratio', sublabel: 'Above statutory floor' },
              { value: 'AAA (p)', label: 'Public Rating', sublabel: 'Planning instrument basis' },
            ].map(({ value, label, sublabel }) => (
              <div key={label} className="px-6 py-4 text-center first:pl-0 last:pr-0 space-y-0.5">
                <div className="text-2xl font-bold font-mono text-gold tracking-tight">{tx(value)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-parchment/80">{tx(label)}</div>
                <div className="text-[10px] text-parchment/40 font-mono">{tx(sublabel)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVENUE ARCHITECTURE ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Sustainable Fiscal Design")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("The Four Pillars of Sovereign Revenue")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Aletheia rejects redistributive personal taxation in favor of productive institutional enterprise and sovereign capital management.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="feature-card rounded-sm p-6 space-y-3">
            <div className="icon-sovereign"><Landmark className="w-5 h-5 text-gold" /></div>
            <h3 className="text-base font-bold text-navy">{t("1. Sovereign Endowment")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Permanent multi-asset capital fund invested in European government bonds, precious metals, and tier-1 infrastructure yielding baseline state operating budget.")}</p>
          </div>

          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <Coins className="w-6 h-6 text-navy" />
            <h3 className="text-base font-bold text-navy">{t("2. Digital Registry Fees")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("E-residency enrollments, 15-minute corporate filings, maritime vessel registrations, and API validator settlement fees.")}</p>
          </div>

          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <TrendingUp className="w-6 h-6 text-laurel" />
            <h3 className="text-base font-bold text-navy">{t("3. Maritime Concessions")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Long-term lease concessions for St. Brendan deepwater container port terminals, bonded transshipment warehouses, and fiber landing stations.")}</p>
          </div>

          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <Lock className="w-6 h-6 text-gold" />
            <h3 className="text-base font-bold text-navy">{t("4. Renewable Grid Exports")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Surplus offshore wind, marine wave energy, and green hydrogen exported directly to the Continental European HVDC grid.")}</p>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Participate in Sovereign Development")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Institutional investors, sovereign funds, and accredited e-residents may subscribe to Aletheian Sovereign Development Bonds (SDB).")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/economy"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Explore Monetary Architecture")}</Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Contact Treasury Desk")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
