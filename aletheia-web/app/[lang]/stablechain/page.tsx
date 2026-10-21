'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AeyNotice } from '@/components/ui/AeyNotice';
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { LiveChainCard, LiveChainStrip } from '@/components/stablechain/LiveChain';
import { NetworkDetails } from '@/components/stablechain/NetworkDetails';
import { STABLECHAIN } from '@/lib/stablechain';

export default function StableChainPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden border-b border-gold/30" style={{ minHeight: '64vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <HeroBackdrop image="ledgerBlocks" />
        {/* Animated orbs */}
        <div className="orb-navy w-[600px] h-[600px] -top-32 -right-40 opacity-70 animate-orb-float-1" />
        <div className="orb-gold w-[380px] h-[380px] bottom-0 -left-16 opacity-40 animate-orb-float-2" />

        {/* Circuit/grid watermark */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(196,154,78,1) 0px, rgba(196,154,78,1) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(196,154,78,1) 0px, rgba(196,154,78,1) 1px, transparent 1px, transparent 40px)'
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-7 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Layer 1 · Testnet")}</span>
                </div>
                <StatusBadge asset="stablechain" size="sm" />
              </div>

              <h1 className="heading-hero">{t("Aletheia")}<br />
                <span className="text-gold-metallic">{t("StableChain")}</span>
              </h1>

              <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light max-w-2xl">{t("The ledger Aletheia is developing, now running as a testnet and reference implementation. It is designed for 500 ms slots with deterministic finality, a fixed fee schedule, and native registries for statutes, companies and public spending.")}</p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/documents#aps-01-spec"
                  className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm"
                >
                  <span>{t("APS-01 Technical Whitepaper")}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/transparency"
                  className="btn-sovereign-ghost px-6 py-3.5 rounded-sm text-sm"
                >{t("Status & Disclaimers")}</Link>
                {STABLECHAIN.explorerLive && (
                  <a
                    href={STABLECHAIN.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-sovereign-ghost px-6 py-3.5 rounded-sm text-sm"
                  >{t("Testnet Explorer")}</a>
                )}
              </div>
            </div>

            {/* Right: Live block counter card */}
            <div className="lg:col-span-5 animate-fade-in-up delay-200">
              <div className="border-flow rounded-sm p-7 space-y-5 relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                <div className="absolute inset-0 bg-grid-gold opacity-[0.015] pointer-events-none" />

                <LiveChainCard />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE LEDGER METRICS TICKER ── */}
      <section className="bg-[#060C14] border-b border-gold/25 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiveChainStrip />
        </div>
      </section>

      {/* ── TECHNICAL ADVANTAGES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Protocol Engineering")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Built for Constitutional Governance")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Unlike speculative public blockchains, StableChain is designed as a high-integrity public utility with no congestion pricing.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-3 hover:shadow-md transition-shadow">
            <Zap className="w-8 h-8 text-gold" />
            <h3 className="text-base font-bold text-navy">{t("Fixed Fee Schedule")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Fees are execution units at a fixed price per unit, in AEY or ALnT, set by governance and never auctioned. Citizens and enterprises never meet fee spikes in busy periods.")}</p>
          </div>

          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-3 hover:shadow-md transition-shadow">
            <Layers className="w-8 h-8 text-navy" />
            <h3 className="text-base font-bold text-navy">{t("State Validator Consensus")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Validators would be physically separated across several sites, with keys held in hardware security modules so that no single party can interfere.")}</p>
          </div>

          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-3 hover:shadow-md transition-shadow">
            <FileCheck2 className="w-8 h-8 text-laurel" />
            <h3 className="text-base font-bold text-navy">{t("Native Legal Smart Contracts")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Standard built-in primitives for commercial arbitration, company incorporation and public-key registration.")}</p>
          </div>
        </div>

        {/* -- TESTNET NOTICE -- */}
        <div className="mt-16 bg-navy text-parchment rounded-sm border border-gold/30 p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-parchment/10 pb-4">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-gold" />
              <h3 className="text-lg font-bold text-parchment">{t("Testnet — Reference Implementation")}</h3>
            </div>
            <span className="text-xs font-mono text-gold">{t("Protocol version {version}", { version: STABLECHAIN.protocolVersion })}</span>
          </div>

          <div className="bg-navy-deep border border-burgundy/30 rounded-sm px-5 py-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-parchment/80 leading-relaxed">
              <strong className="text-parchment">{t("StableChain runs today as a testnet and reference implementation.")}</strong>{' '}{t("It carries no real value. No AEY or other asset is issued, sold or offered to the public, and no mainnet has launched. Read-only access is provided for transparency and review.")}</p>
          </div>

          <AeyNotice tone="dark" />

          <NetworkDetails />

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-parchment/10">
            <Link href="/documents#aps-01-spec" className="text-sm font-semibold text-gold hover:text-gold-tint transition-colors flex items-center gap-1.5">
              <span>{t("APS-01 Technical Specification")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-parchment/20">·</span>
            {STABLECHAIN.explorerLive && (
              <>
                <a href={STABLECHAIN.explorer} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-parchment/60 hover:text-parchment transition-colors">{t("Block Explorer")}</a>
                <span className="text-parchment/20">·</span>
              </>
            )}
            <Link href="/transparency" className="text-sm font-semibold text-parchment/60 hover:text-parchment transition-colors">{t("Status & Disclaimers")}</Link>
            <span className="text-parchment/20">·</span>
            <Link href="/government" className="text-sm font-semibold text-parchment/60 hover:text-parchment transition-colors">{t("Digital State (proposed)")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
