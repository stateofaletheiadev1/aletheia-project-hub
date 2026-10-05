'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  Coins,
  TrendingUp,
  Lock,
  Database,
  ArrowRight,
  BarChart3,
  Zap,
  Shield,
  CheckCircle,
  Globe,
  Cpu,
  Building2,
  FileText,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const INVARIANTS = [
  { id: '1', label: 'Supply Cap', rule: 'Total AEY in circulation ≤ 125% of reserve value at any epoch.' },
  { id: '2', label: 'Reserve Floor', rule: 'Reserve backing must remain ≥ 80% in Tier-1 assets at all times.' },
  { id: '3', label: 'Peg Band', rule: 'AEY/EUR exchange rate maintained within ±0.5% via automated stabiliser.' },
  { id: '4', label: 'Mint Gate', rule: 'New AEY may only be minted against verified reserve inflow on-chain.' },
  { id: '5', label: 'Halt Trigger', rule: 'State validator halts all minting if any invariant is violated — no exceptions.' },
  { id: '6', label: 'Burn Invariant', rule: 'Redemptions burn AEY supply atomically; no fractional reserve expansion.' },
  { id: '7', label: 'Epoch Audit', rule: 'Monetary Board produces a Merkle-attested reserve report every 12-hour epoch.' },
  { id: '8', label: 'Transparency Mandate', rule: 'Full reserve ledger published in real-time via Public Ledger Audit portal.' },
];

const REVENUE_STREAMS = [
  {
    id: 'tx',
    title: 'Transaction Settlement Fees',
    desc: 'Micro-fees on StableChain validator settlement. No personal income tax required.',
    amount: '~0.001% per settlement',
    icon: <Zap className="w-4 h-4 text-gold" />,
  },
  {
    id: 'corp',
    title: 'Corporate Registry Fees',
    desc: 'One-time incorporation and annual licence renewals for registered businesses.',
    amount: '2,500 — 25,000 AEY',
    icon: <Building2 className="w-4 h-4 text-gold" />,
  },
  {
    id: 'eresidency',
    title: 'E-Residency Programme',
    desc: 'Annual digital residency permits for global entrepreneurs and remote entities.',
    amount: '500 AEY / year',
    icon: <Globe className="w-4 h-4 text-gold" />,
  },
  {
    id: 'bonds',
    title: 'Sovereign Development Bonds',
    desc: 'Infrastructure and capital development bonds issued to institutional investors.',
    amount: 'Variable, rated issuances',
    icon: <FileText className="w-4 h-4 text-gold" />,
  },
  {
    id: 'endowment',
    title: 'Covenant Endowment Fund',
    desc: 'Sovereign wealth fund returns from diversified reserve and infrastructure portfolio.',
    amount: 'Long-term capital returns',
    icon: <TrendingUp className="w-4 h-4 text-gold" />,
  },
];

export default function EconomyPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="relative guilloche-bg text-parchment overflow-hidden pt-24 pb-32 lg:pt-36 lg:pb-44">
        <HeroBackdrop image="towers" />
        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gold/8 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-laurel/10 rounded-full blur-[100px]" />
        </div>

        {/* Hex pattern watermark */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" aria-hidden>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hex-ec" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
                <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="#C49A4E" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex-ec)"/>
          </svg>
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-8">
            <div className="pill-sovereign gold-glow-sm">
              <StarOfTruth size={12} />
              <span>{t("Ministry of Finance & Economic Architecture")}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.04] text-parchment">{t("A sovereign economy built on")}{' '}
              <span className="text-gold-metallic">{t("provable truth.")}</span>
            </h1>

            <p className="text-base sm:text-xl text-parchment/70 leading-relaxed font-light max-w-2xl">{t("Aletheia's monetary system runs on twelve cryptographic invariants. The Aletheian Guilder (AEY) is not a promise — it is a mathematically bounded claim on verified reserves, settled on a 500ms sovereign ledger with no discretionary override.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/aey" className="btn-sovereign-gold px-8 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm">
                <span>{t("Explore the Aletheian Guilder (AEY)")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/stablechain" className="btn-sovereign-ghost px-8 py-3.5 rounded-sm text-sm flex items-center gap-2">
                <span>{t("StableChain Protocol")}</span>
                <Cpu className="w-4 h-4 text-gold" />
              </Link>
            </div>
          </div>

          {/* Live metrics strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Reserve Backing', value: '100%', sub: 'Tier-1 Assets', status: 'Operational' as const },
              { label: 'AEY/EUR Peg', value: '1 : 1', sub: '± 0.5% band', status: 'Operational' as const },
              { label: 'Ledger Finality', value: '500ms', sub: 'StableChain slots', status: 'Under Development' as const },
              { label: 'Personal Tax', value: 'None', sub: 'Zero income tax', status: 'Operational' as const },
            ].map((m) => (
              <div key={m.label} className="stat-card rounded-sm p-5 space-y-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-gold/65 font-semibold block">{tx(m.label)}</span>
                <span className="text-3xl font-extrabold text-parchment tabular-nums">{tx(m.value)}</span>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-parchment/45">{tx(m.sub)}</span>
                  <StatusBadge status={m.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 1: AEY CURRENCY OVERVIEW ── */}
      <section className="py-24 lg:py-32 guilloche-parchment border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="label-sovereign block mb-3">{t("Monetary Architecture")}</span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-navy leading-tight">{t("AEY — The Aletheian")}{' '}
                  <span className="text-gold-metallic">{t("Guilder")}</span>
                </h2>
                <div className="rule-gold mt-4 max-w-xs" />
              </div>
              <p className="text-navy/70 leading-relaxed">{t("The Aletheian Guilder (AEY) is the sovereign currency of Aletheia, pegged 1:1 to the Euro. It is not a cryptocurrency speculation vehicle — it is a state-issued digital and physical unit of account backed 100% by Tier-1 reserve assets held in the Covenant Endowment Fund.")}</p>
              <p className="text-navy/70 leading-relaxed">{t("Unlike central bank fiat systems, AEY's reserve status is not a political statement — it is a cryptographic proof. Every epoch, the Monetary Board produces a Merkle-attested reserve report readable by any citizen, auditor, or foreign central bank.")}</p>
              <div className="pt-2 space-y-2">
                {[
                  'No discretionary money printing',
                  'Automated algorithmic stabiliser',
                  'State validator halt on invariant breach',
                  'Public reserve ledger in real-time',
                ].map((point) => (
                  <div key={point} className="flex items-center gap-2.5 text-[13px] text-navy/80">
                    <CheckCircle className="w-4 h-4 text-laurel shrink-0" />
                    {tx(point)}
                  </div>
                ))}
              </div>
              <Link href="/aey" className="inline-flex items-center gap-2 text-[12px] font-bold text-navy hover:text-gold uppercase tracking-wider transition-colors mt-2">{t("Aletheian Guilder (AEY) Whitepaper")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold" />
              </Link>
            </div>

            {/* 12 Invariants Grid */}
            <div className="lg:col-span-7">
              <div className="mb-4">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold/80 block mb-1">{t("The 8 Core Supply Invariants")}</span>
                <p className="text-[12px] text-navy/50">{t("Encoded into StableChain state machine — unoverrideable by any ministry or executive order.")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INVARIANTS.map((inv) => (
                  <div
                    key={inv.id}
                    className="feature-card rounded-sm p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-sm bg-navy text-gold text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-gold/20">
                        {tx(inv.id)}
                      </span>
                      <div>
                        <span className="text-[11px] font-bold text-navy uppercase tracking-wider block mb-1">
                          {tx(inv.label)}
                        </span>
                        <p className="text-[11px] text-navy/60 leading-snug">{tx(inv.rule)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: STABLECHAIN ── */}
      <section id="infrastructure" className="py-24 lg:py-32 bg-navy text-parchment border-b border-gold/20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="label-parchment block">{t("Sovereign Ledger Infrastructure")}</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-parchment leading-tight">{t("Aletheia")}{' '}
                <span className="text-gold-metallic">{t("StableChain")}</span>
              </h2>
              <div className="rule-gold max-w-xs" />
              <p className="text-parchment/65 leading-relaxed">{t("A deterministic DAG-based ledger purpose-built for state operations. 500ms slot finality, zero gas fee volatility, and constitutional-grade validator governance. Not a fork. A sovereign protocol.")}</p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Slot Finality', value: '500ms', icon: <Zap className="w-4 h-4" /> },
                  { label: 'Gas Model', value: 'Zero Volatility', icon: <Shield className="w-4 h-4" /> },
                  { label: 'Architecture', value: 'DAG Ledger', icon: <Database className="w-4 h-4" /> },
                  { label: 'Validators', value: 'State-Governed', icon: <Lock className="w-4 h-4" /> },
                ].map((stat) => (
                  <div key={stat.label} className="sovereign-card-dark rounded-sm p-4">
                    <div className="flex items-center gap-2 text-gold mb-2">{tx(stat.icon)}</div>
                    <span className="text-xl font-extrabold text-parchment block">{tx(stat.value)}</span>
                    <span className="text-[10px] text-parchment/45 uppercase tracking-wider">{tx(stat.label)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <StatusBadge status="Under Development" size="sm" />
                <span className="text-[11px] text-parchment/50">{t("Mainnet — Sovereign Protocol · Q4 2026")}</span>
              </div>

              <Link href="/stablechain" className="inline-flex items-center gap-2 px-5 py-2.5 border border-gold/30 text-parchment font-semibold text-[12px] uppercase tracking-wider rounded-[3px] hover:border-gold/60 transition-colors group">{t("StableChain Technical Docs")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="relative">
              <div className="bg-navy-deep/60 border border-gold/20 rounded-[4px] p-6 font-mono text-[11px] leading-6 text-parchment/70 space-y-1">
                <span className="text-gold/60 block mb-3">{t("# StableChain Epoch Report — Slot #1,847,392")}</span>
                <span className="text-parchment/40 block">{t("reserve_snapshot:")}</span>
                <span className="pl-4 text-laurel block">{' '}{t("total_aey_supply: 48,291,004.00")}</span>
                <span className="pl-4 text-laurel block">{' '}{t("tier1_reserve_eur: 51,734,882.40")}</span>
                <span className="pl-4 text-laurel block">{' '}{t("backing_ratio: 107.13%")}</span>
                <span className="pl-4 text-laurel block">{' '}{t("peg_deviation: +0.003%")}</span>
                <span className="text-parchment/40 block mt-2">{t("invariant_checks:")}</span>
                {['SUPPLY_CAP', 'RESERVE_FLOOR', 'PEG_BAND', 'MINT_GATE', 'HALT_TRIGGER'].map((inv) => (
                  <span key={inv} className="pl-4 block">
                    <span className="text-parchment/40">{tx(inv)}: </span>
                    <span className="text-laurel font-bold">{t("PASS ✓")}</span>
                  </span>
                ))}
                <span className="text-parchment/40 block mt-2">{t("merkle_root:")}</span>
                <span className="pl-4 text-gold/70 block break-all">{t("0xa3f9…c841")}</span>
                <span className="text-parchment/40 block">{t("epoch_timestamp: 2026-10-01T20:00:00Z")}</span>
              </div>
              <div className="absolute -top-2 -right-2 px-2.5 py-0.5 bg-laurel text-white text-[9px] font-bold uppercase tracking-wider rounded-[2px]">{t("Live Epoch")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: REVENUE MODEL ── */}
      <section className="py-20 lg:py-28 bg-parchment-canvas border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("Fiscal Architecture")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight mb-4">{t("Zero personal income tax. A sovereign revenue model that works.")}</h2>
            <p className="text-navy/60 leading-relaxed">{t("Aletheia funds its operations through institutional efficiency, not individual taxation. Every revenue stream is codified in the Public Finance Act and auditable on-chain.")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {REVENUE_STREAMS.map((stream) => (
              <div
                key={stream.id}
                id={stream.id}
                className="bg-white border border-navy/[0.07] rounded-[4px] p-5 hover:shadow-[0_4px_24px_-4px_rgba(21,41,74,0.08)] hover:border-gold/20 transition-all group"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 bg-navy/[0.04] rounded-[3px] flex items-center justify-center group-hover:bg-gold/10 transition-colors">
                    {tx(stream.icon)}
                  </div>
                  <h3 className="text-[13px] font-bold text-navy">{tx(stream.title)}</h3>
                </div>
                <p className="text-[12px] text-navy/60 leading-relaxed mb-3">{tx(stream.desc)}</p>
                <div className="flex items-center justify-between pt-3 border-t border-navy/[0.06]">
                  <span className="text-[10px] font-mono text-gold font-semibold">{tx(stream.amount)}</span>
                  <BarChart3 className="w-3.5 h-3.5 text-navy/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: BUSINESS PLATFORM ── */}
      <section className="py-20 lg:py-28 bg-parchment-light">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Image
                src="/images/architecture_antioch.jpg"
                alt={t("Antioch Business District")}
                width={640}
                height={440}
                className="w-full object-cover rounded-[4px]"
              />
            </div>
            <div className="space-y-6">
              <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block">{t("Business Platform")}</span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">{t("Incorporate in Aletheia in 15 minutes.")}</h2>
              <p className="text-navy/65 leading-relaxed">{t("The Aletheian Business Registry is a fully digital, blockchain-anchored company formation and licensing platform. No lawyers, no notaries, no paper filing. Your company record is a sovereign NFT on the StableChain — immutable, transferable, and globally verifiable.")}</p>
              <div className="space-y-3">
                {[
                  { step: '01', label: 'Submit digital application', desc: 'Fill out the formation form with your identity credentials.' },
                  { step: '02', label: 'Automated compliance check', desc: 'AI-assisted statutory compliance screening — instant results.' },
                  { step: '03', label: 'Pay incorporation fee', desc: 'Pay via AEY or major currency. Fee anchored in reserve-backed value.' },
                  { step: '04', label: 'Receive your Sovereign Charter', desc: 'A StableChain NFT is minted as your company registration — permanently on-ledger.' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4">
                    <span className="text-[10px] font-bold text-gold/70 font-mono pt-0.5 w-5 shrink-0">{tx(s.step)}</span>
                    <div>
                      <span className="text-[13px] font-semibold text-navy block">{tx(s.label)}</span>
                      <span className="text-[12px] text-navy/55">{tx(s.desc)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Link href="/business" className="px-5 py-2.5 bg-navy text-parchment font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-navy-deep transition-colors flex items-center gap-2 border border-gold/20 group">{t("Start Your Application")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="/invest" className="px-5 py-2.5 border border-navy/15 text-navy font-semibold text-[12px] uppercase tracking-wider rounded-[3px] hover:border-navy/30 hover:bg-navy/[0.03] transition-all">{t("Investor Relations")}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
