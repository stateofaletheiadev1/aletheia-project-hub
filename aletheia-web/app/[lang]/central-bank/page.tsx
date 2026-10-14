'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Scale } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export default function CentralBankPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="marketChart" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Banca Centralis Aletheiae")}</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Aletheian Reserve Bank & Monetary Authority")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Guarantor of monetary integrity, price stability, and reserve backing invariants. The Aletheian Reserve Bank, central bank of the Sovereign Covenant State of Aletheia, operates under constitutional limits that prohibit inflationary debasement and fractional reserve expansion.")}</p>
          </div>
        </div>
      </section>

      {/* ── MONETARY METRICS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">1 : 1</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("AEY Peg to Euro Target")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("≥ 100%")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Constitutional Reserve Floor")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">0.0%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Statutory Inflation Target")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">24 / 7 / 365</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Continuous RTGS Clearing")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MONETARY CONSTITUTION ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Constitutional Monetary Law")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Inviolable Reserve Invariant")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Pursuant to Constitution Article 14, the Aletheian Reserve Bank is legally prohibited from monetizing government deficits or creating unbacked liquidity. The monetary base is governed by mathematical algorithmic invariants published on the state ledger.")}</p>

            <div className="space-y-3 text-xs text-navy/75">
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1">
                <strong className="text-navy block font-bold">{t("Separation from Fiscal Politics:")}</strong>
                <span>{t("The Monetary Board is independent of the Chancellor and Cabinet. Governors serve staggered nine-year non-renewable terms.")}</span>
              </div>
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1">
                <strong className="text-navy block font-bold">{t("Cryptographic Proof of Reserves (PoR):")}</strong>
                <span>{t("Audited custodial keys and bank vault allocations are verified on-chain every 60 seconds with zero knowledge proofs.")}</span>
              </div>
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1">
                <strong className="text-navy block font-bold">{t("SEPA & Target2 Interoperability:")}</strong>
                <span>{t("Full compatibility with European payments infrastructure to enable frictionless trade for Aletheian enterprises.")}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-navy text-parchment p-8 rounded-sm border border-gold/30 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="icon-sovereign"><Scale className="w-5 h-5 text-gold" /></div>
              <h3 className="text-lg font-bold text-parchment">{t("Reserve Composition")}</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-parchment/80 font-mono mb-1">
                  <span>{t("Physical Gold (London Good Delivery)")}</span>
                  <span className="text-gold font-bold">40%</span>
                </div>
                <div className="w-full h-2 bg-navy-deep rounded-full overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: '40%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-parchment/80 font-mono mb-1">
                  <span>{t("Sovereign European Debt (AAA/AA)")}</span>
                  <span className="text-gold font-bold">35%</span>
                </div>
                <div className="w-full h-2 bg-navy-deep rounded-full overflow-hidden">
                  <div className="h-full bg-parchment" style={{ width: '35%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-parchment/80 font-mono mb-1">
                  <span>{t("Liquid Tier-1 Cash & SDR Claims")}</span>
                  <span className="text-gold font-bold">25%</span>
                </div>
                <div className="w-full h-2 bg-navy-deep rounded-full overflow-hidden">
                  <div className="h-full bg-laurel" style={{ width: '25%' }} />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-navy/40 flex items-center justify-between text-[11px] font-mono text-parchment/60">
              <span>{t("Auditor: Independent Big-4 Audit")}</span>
              <span className="text-gold">{t("Status: 100% Backed")}</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Discover the Sovereign Currency: The Aletheian Guilder (AEY)")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Learn more about the technical, monetary, and settlement characteristics of the Aletheian Guilder (AEY).")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/economy"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Economy & Monetary Policy")}</Link>
            <Link
              href="/treasury"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Public Treasury")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
