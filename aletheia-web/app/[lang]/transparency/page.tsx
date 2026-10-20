'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge, StatusLegend } from '@/components/ui/StatusBadge';
import { MontevideoTable, StatusRegisterTable } from '@/components/ui/StatusTables';
import { AeyNotice } from '@/components/ui/AeyNotice';
import { FOUNDING_PHASE_STATEMENT } from '@/components/layout/FoundingPhaseNotice';
import { Coins, Building, Lock, ArrowRight } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { STATUS_CONFIG, STATUS_ORDER } from '@/lib/status';

export default function TransparencyPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO: THE STATEMENT ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="analytics" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Status & Disclaimers")}</span>
              </div>
              <StatusBadge asset="platform" size="sm" />
            </div>

            <h1 className="heading-hero">{t("What Aletheia is, and is not, today")}</h1>

            <p className="text-base sm:text-lg text-parchment/85 leading-[1.85] font-light">{t(FOUNDING_PHASE_STATEMENT)}</p>
          </div>
        </div>
      </section>

      {/* ── STATUS REGISTER ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
        <div className="max-w-3xl space-y-3">
          <div className="eyebrow">{t("The Status Register")}</div>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("The status of every national asset")}</h2>
          <p className="text-sm text-navy/70 leading-relaxed">{t("One register sets the status shown for each asset everywhere on this site. Only the digital platform and its public record are operational.")}</p>
        </div>

        <StatusRegisterTable />

        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-navy">{t("What each status means")}</h3>
          <StatusLegend />
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {STATUS_ORDER.map((s) => (
              <div key={s} className="bg-white border border-navy/10 rounded-sm p-4 space-y-1">
                <dt className="text-xs font-bold text-navy">{tx(s)}</dt>
                <dd className="text-xs text-navy/65 leading-relaxed">{tx(STATUS_CONFIG[s].description)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── MONTEVIDEO ── */}
      <section className="py-16 lg:py-20 bg-parchment-light border-y border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-3">
            <div className="eyebrow">{t("The path to statehood")}</div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Measured against Montevideo")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Aletheia measures itself honestly against the four Montevideo criteria:")}</p>
            <Link href="/development#treaty" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
              <span>{t("Territory by Treaty")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="lg:col-span-7">
            <MontevideoTable />
          </div>
        </div>
      </section>

      {/* ── CURRENCY & MEMBERSHIP ── */}
      <section className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-6">
        <div className="max-w-3xl space-y-3">
          <div className="eyebrow">{t("Currency, Documents & Membership")}</div>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Nothing is sold")}</h2>
          <p className="text-sm text-navy/70 leading-relaxed">{t("Aletheia does not sell citizenship, residency, passports or currency, and accepts no applications. Registering interest as a Founding Member is free.")}</p>
        </div>
        <AeyNotice />
        <Link href="/founding-members" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
          <span>{t("Register interest as a Founding Member")}</span>
          <ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-1 transition-transform" />
        </Link>
      </section>

      {/* ── TRANSPARENCY BY DESIGN ── */}
      <section className="py-16 lg:py-24 bg-parchment-light border-t border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-3">
            <div className="eyebrow">{t("Transparency by Design")}</div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("How a future Aletheia would stay open")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Article 12 of the draft Covenant proposes that public spending, reserves and procurement contracts may never be kept secret. These are design commitments for a future state, not current operations.")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Coins, title: 'Open Treasury Ledger', desc: 'Every disbursement by a ministry or agency would be signed and visible to the public.' },
              { icon: Building, title: 'Competitive Procurement', desc: 'Contracts above a published threshold would be awarded through sealed bids on a public procurement register.' },
              { icon: Lock, title: 'Whistleblower Protection', desc: 'Constitutional protection and anonymous reporting channels would be open to any official reporting wrongdoing.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card rounded-sm p-6 space-y-3 group">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                <p className="text-xs text-navy/70 leading-relaxed">{tx(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
