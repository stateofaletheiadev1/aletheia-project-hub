'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Coins,
  Building,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { EXAMPLE, shortId } from '@/lib/stablechain';

export default function TransparencyPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="analytics" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Public Transparency")}</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Radical Institutional Transparency")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Under Article 12 of the Covenant, state secrecy regarding public expenditures, sovereign reserves, and procurement contracts is constitutionally prohibited. Every Guilder is auditable on the Aletheia StableChain.")}</p>
          </div>
        </div>
      </section>

      {/* ── LIVE AUDIT METRICS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Public Contract Inscription")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("2.45B AEY")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Audited Sovereign Reserves")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("500 ms")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Ledger Reconciliation")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("Quarterly")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Independent Big-4 Audit")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRANSPARENCY PILLARS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">{t("Open Treasury Ledger")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Every disbursement made by any ministry or government agency is signed with verifiable cryptographic keys and viewable by any citizen or e-resident in real time.")}</p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">{t("Competitive Procurement")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("All infrastructure, defense, and maritime contracts above 50,000 AEY must be awarded through blind cryptographic auctions on the public procurement registry.")}</p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">{t("Whistleblower Protection")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Constitutional immunity and anonymous cryptographic submission channels are provided to any official reporting administrative malfeasance.")}</p>
          </div>
        </div>

        {/* RECENT PUBLIC EXPENDITURES TABLE */}
        <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/10 pb-4">
            <div>
              <h3 className="text-lg font-bold text-navy">{t("Latest Reconciled Public Expenditures")}</h3>
              <p className="text-xs text-navy/60">{t("Live feed from the Sovereign Treasury settlement contract.")}</p>
            </div>
            <Link
              href="/treasury"
              className="text-xs text-gold font-bold hover:underline flex items-center gap-1"
            >{t("Full Balance Sheet")}{' '}<ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-parchment-light text-navy/70 font-mono uppercase text-[10px] border-b border-navy/10">
                  <th className="p-3">{t("Reference")}</th>
                  <th className="p-3">{t("Disbursing Body")}</th>
                  <th className="p-3">{t("Purpose")}</th>
                  <th className="p-3">{t("Amount (AEY)")}</th>
                  <th className="p-3">{t("Verification Hash")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10 font-mono">
                <tr>
                  <td className="p-3 font-bold text-navy">{t("EXP-2026-891")}</td>
                  <td className="p-3 text-navy/80">{t("Ministry of Territorial Dev.")}</td>
                  <td className="p-3 font-sans text-navy/80">{t("St. Brendan Deepwater Seabed Core Analysis")}</td>
                  <td className="p-3 font-bold text-navy">{t("145,000 AEY")}</td>
                  <td className="p-3 text-[10px] text-navy/50" translate="no" data-i18n-skip="" title={EXAMPLE.tx[1]}>{shortId(EXAMPLE.tx[1])}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-navy">{t("EXP-2026-890")}</td>
                  <td className="p-3 text-navy/80">{t("ADSS Coast Guard")}</td>
                  <td className="p-3 font-sans text-navy/80">{t("Autonomous Navigational Buoy Array Maintenance")}</td>
                  <td className="p-3 font-bold text-navy">{t("42,500 AEY")}</td>
                  <td className="p-3 text-[10px] text-navy/50" translate="no" data-i18n-skip="" title={EXAMPLE.tx[2]}>{shortId(EXAMPLE.tx[2])}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-navy">{t("EXP-2026-889")}</td>
                  <td className="p-3 text-navy/80">{t("National Registry Dept.")}</td>
                  <td className="p-3 font-sans text-navy/80">{t("Polycarbonate e-Passport Blank Stock Procurement")}</td>
                  <td className="p-3 font-bold text-navy">{t("88,200 AEY")}</td>
                  <td className="p-3 text-[10px] text-navy/50" translate="no" data-i18n-skip="" title={EXAMPLE.tx[3]}>{shortId(EXAMPLE.tx[3])}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}
