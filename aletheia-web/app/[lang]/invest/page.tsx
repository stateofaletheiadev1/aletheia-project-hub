'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Building2,
  Anchor,
  Zap,
  Globe2,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { BOND_TRANCHES } from '@/lib/bonds';

export default function InvestPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="handshake" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Sovereign Investment Authority")}</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Invest in Sovereign Infrastructure")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("High-yield sovereign development bonds, green maritime logistics concessions, and tier-1 technology parks. Backed by English commercial law, zero capital gains tax, and the Covenant Endowment Fund.")}</p>
          </div>
        </div>
      </section>

      {/* ── KEY INVESTMENT METRICS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">0.0%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Capital Gains Tax")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">4.85% - 6.15%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Sovereign Bond Yields")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("AAA (p)")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Treasury Balance Sheet")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Foreign Capital Repatriation")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOVEREIGN DEVELOPMENT BONDS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Fixed Income Debt Instruments")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Sovereign Development Bond Schedule")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Issued directly by the Ministry of Treasury & Finance pursuant to the Sovereign Debt Act. All tranches are senior secured against dedicated infrastructure cash flows and the Covenant Endowment.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {BOND_TRANCHES.map((bond) => (
            <div
              key={bond.id}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-2xl font-bold font-mono text-gold">{tx(bond.yieldPct)}</span>
                  <StatusBadge status={bond.status} size="sm" />
                </div>
                <h3 className="text-base font-bold text-navy">{tx(bond.name)}</h3>
                <p className="text-xs text-navy/70 leading-relaxed">{tx(bond.purpose)}</p>

                <div className="pt-3 border-t border-navy/10 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-navy/50">{t("Maturity / Tenor:")}</span>
                    <strong className="text-navy">{tx(bond.tenor)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy/50">{t("Coupon Schedule:")}</span>
                    <strong className="text-navy">{tx(bond.coupon)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy/50">{t("Minimum Subscription:")}</span>
                    <strong className="text-navy">{tx(bond.minSub)}</strong>
                  </div>
                </div>
              </div>

              <a
                href={`/pdf/bonds/${bond.id}`}
                target="_blank"
                rel="noopener"
                className="w-full py-2.5 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors text-center block"
              >{t("Information Memorandum (PDF)")}</a>
            </div>
          ))}
        </div>

        {/* ── PRIORITY SECTORS ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-gold uppercase tracking-wider">{t("Direct Concessions")}</span>
            <h3 className="text-2xl font-bold text-navy">{t("Priority Direct Investment Concessions")}</h3>
            <p className="text-xs text-navy/70">{t("Long-term commercial operating leases and public-private partnerships (PPP) under statutory guarantees.")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            <div className="p-4 bg-parchment-light rounded-sm space-y-2">
              <Anchor className="w-5 h-5 text-gold" />
              <strong className="text-navy block font-bold">{t("Deepwater Port Logistics")}</strong>
              <p className="text-navy/70">{t("Container berths, cold-chain maritime storage, and bunkering facilities.")}</p>
            </div>

            <div className="p-4 bg-parchment-light rounded-sm space-y-2">
              <Zap className="w-5 h-5 text-laurel" />
              <strong className="text-navy block font-bold">{t("Renewable Energy Grid")}</strong>
              <p className="text-navy/70">{t("Offshore wind installations, subsea cables, and green hydrogen synthesis.")}</p>
            </div>

            <div className="p-4 bg-parchment-light rounded-sm space-y-2">
              <Building2 className="w-5 h-5 text-navy" />
              <strong className="text-navy block font-bold">{t("Antioch Urban Development")}</strong>
              <p className="text-navy/70">{t("Zero-emission residential quarters, university campuses, and commercial labs.")}</p>
            </div>

            <div className="p-4 bg-parchment-light rounded-sm space-y-2">
              <Globe2 className="w-5 h-5 text-gold" />
              <strong className="text-navy block font-bold">{t("Fiber & Subsea Telecom")}</strong>
              <p className="text-navy/70">{t("High-speed transatlantic submarine cable landing stations and edge data centers.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Engage with the Sovereign Investment Desk")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Institutional accredited investors and family offices may request private briefings with the Ministry of Treasury & Finance.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Contact Investment Desk")}</Link>
            <Link
              href="/treasury"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("View Public Treasury")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
