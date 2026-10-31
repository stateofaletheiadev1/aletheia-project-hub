'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth } from '@/components/brand/Logo';
import {
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
import { AeyNotice } from '@/components/ui/AeyNotice';

const INVARIANTS = [
  { id: '1', label: 'Published Rules', rule: 'New AEY is issued only under rules adopted and published by the Reserve Bank of Aletheia.' },
  { id: '2', label: 'Single Issuer', rule: 'Only the Reserve Bank of Aletheia may issue the Guilder, in banknotes or in digital form.' },
  { id: '3', label: 'Public Register', rule: 'Every issue and withdrawal is entered in a public register with its date and source document.' },
  { id: '4', label: 'No Budget Financing', rule: 'The Reserve Bank does not create money to finance the State’s budget.' },
  { id: '5', label: 'Ledger Record', rule: 'Digital issuance is recorded on the AletheiaChain, where anyone can verify it.' },
  { id: '6', label: 'Independent Audit', rule: 'The register and the Bank’s accounts are examined by an independent auditor.' },
  { id: '7', label: 'Regular Reporting', rule: 'The Reserve Bank reports on a fixed calendar and publishes its statistics.' },
  { id: '8', label: 'Decided in Public', rule: 'Monetary policy is consulted on, adopted and published with its reasons.' },
];

const REVENUE_STREAMS = [
  {
    id: 'tx',
    title: 'Transaction Settlement Fees',
    desc: 'Small fixed fees on AletheiaChain settlement, under a published schedule.',
    amount: 'Proposed',
    icon: <Zap className="w-4 h-4 text-gold" />,
  },
  {
    id: 'corp',
    title: 'Corporate Registry Fees',
    desc: 'Incorporation and annual licence fees for registered businesses.',
    amount: 'Proposed',
    icon: <Building2 className="w-4 h-4 text-gold" />,
  },
  {
    id: 'eresidency',
    title: 'E-Residency Programme',
    desc: 'Annual fees for digital residency, should the programme ever be offered.',
    amount: 'Proposed',
    icon: <Globe className="w-4 h-4 text-gold" />,
  },
  {
    id: 'leasehold',
    title: 'Land Leasehold Dividends',
    desc: 'Ground rents on platform space held in covenant trust.',
    amount: 'Proposed',
    icon: <FileText className="w-4 h-4 text-gold" />,
  },
  {
    id: 'endowment',
    title: 'Covenant Endowment Fund',
    desc: 'Long-term returns of a proposed endowment fund.',
    amount: 'Proposed',
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
              <span>{t("The Proposed Economy")}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.04] text-parchment">{t("An economy designed for")}{' '}
              <span className="text-gold-metallic">{t("provable truth.")}</span>
            </h1>

            <p className="text-base sm:text-xl text-parchment/70 leading-relaxed font-light max-w-2xl">{t("The Aletheian Guilder (AEY) is the proposed national currency, to be issued by the Reserve Bank of Aletheia under published rules and recorded on a 500 ms sovereign ledger.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/aey" className="btn-sovereign-gold px-8 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm">
                <span>{t("Explore the Aletheian Guilder (AEY)")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/aletheiachain" className="btn-sovereign-ghost px-8 py-3.5 rounded-sm text-sm flex items-center gap-2">
                <span>{t("AletheiaChain Protocol")}</span>
                <Cpu className="w-4 h-4 text-gold" />
              </Link>
            </div>
            <AeyNotice tone="dark" className="max-w-2xl" />
          </div>

          {/* Design metrics strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Monetary Model', value: 'Fiat', sub: 'Published rules', asset: 'aey' as const },
              { label: 'Proposed Issuer', value: 'RBA', sub: 'Reserve Bank of Aletheia', asset: 'reserveBank' as const },
              { label: 'Target: Ledger Finality', value: '≈ 1 s', sub: 'Two 500 ms slots, on Mainnet Beta', asset: 'finality' as const },
              { label: 'Proposed: Personal Tax', value: 'None', sub: 'A constitutional proposal', asset: 'incomeTax' as const },
            ].map((m) => (
              <div key={m.label} className="stat-card rounded-sm p-5 space-y-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-gold/65 font-semibold block">{tx(m.label)}</span>
                <span className="text-3xl font-extrabold text-parchment tabular-nums">{tx(m.value)}</span>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-parchment/45">{tx(m.sub)}</span>
                  <StatusBadge asset={m.asset} size="sm" />
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
              <p className="text-navy/70 leading-relaxed">{t("The Aletheian Guilder (AEY) is the proposed national currency of Aletheia: a state currency in banknotes and digital form, intended as a fiat currency issued by the Reserve Bank of Aletheia. It is not a cryptocurrency speculation vehicle.")}</p>
              <p className="text-navy/70 leading-relaxed">{t("Its credibility rests on rules, governance and openness: issuance under published rules, a public register anyone can read, and an independent audit.")}</p>
              <div className="pt-2 space-y-2">
                {[
                  'Issuance under published rules',
                  'A single issuer: the Reserve Bank',
                  'A public register of all issuance',
                  'No financing of the State budget',
                ].map((point) => (
                  <div key={point} className="flex items-center gap-2.5 text-[13px] text-navy/80">
                    <CheckCircle className="w-4 h-4 text-laurel shrink-0" />
                    {tx(point)}
                  </div>
                ))}
              </div>
              <Link href="/aey" className="inline-flex items-center gap-2 text-[12px] font-bold text-navy hover:text-gold uppercase tracking-wider transition-colors mt-2">{t("About the Aletheian Guilder (AEY)")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold" />
              </Link>
            </div>

            {/* 12 Invariants Grid */}
            <div className="lg:col-span-7">
              <div className="mb-4">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold/80 block mb-1">{t("Eight Principles of Issuance")}</span>
                <p className="text-[12px] text-navy/50">{t("Set by the Reserve Bank of Aletheia. Digital issuance is recorded on the AletheiaChain.")}</p>
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
              <span className="label-parchment block">{t("Ledger Infrastructure · Mainnet Beta")}</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-parchment leading-tight">{t("Aletheia")}{' '}
                <span className="text-gold-metallic">{t("AletheiaChain")}</span>
              </h2>
              <div className="rule-gold max-w-xs" />
              <p className="text-parchment/65 leading-relaxed">{t("A Byzantine-fault-tolerant ledger designed for state operations, now running as Mainnet Beta: 500 ms slots, deterministic finality, a fixed fee schedule and published validator governance. Not a fork: its own protocol.")}</p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Slot Time', value: '500 ms', icon: <Zap className="w-4 h-4" /> },
                  { label: 'Fee Model', value: 'Fixed Schedule', icon: <Shield className="w-4 h-4" /> },
                  { label: 'Architecture', value: 'BFT Chain', icon: <Database className="w-4 h-4" /> },
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
                <StatusBadge asset="stablechain" size="sm" />
                <span className="text-[11px] text-parchment/50">{t("Mainnet Beta · reference implementation")}</span>
              </div>

              <Link href="/aletheiachain" className="inline-flex items-center gap-2 px-5 py-2.5 border border-gold/30 text-parchment font-semibold text-[12px] uppercase tracking-wider rounded-[3px] hover:border-gold/60 transition-colors group">{t("AletheiaChain Technical Docs")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="relative">
              <div className="bg-navy-deep/60 border border-gold/20 rounded-[4px] p-6 font-mono text-[11px] leading-6 text-parchment/70 space-y-1">
                <span className="text-gold/60 block mb-3">{t("# AletheiaChain Epoch Report — Slot #1,847,392")}</span>
                <span className="text-parchment/40 block">{t("ledger_snapshot:")}</span>
                <span className="pl-4 text-laurel block">{' '}{t("finality: 2 slots (≈ 1 s)")}</span>
                <span className="pl-4 text-laurel block">{' '}{t("validators_signing: 4 of 4")}</span>
                <span className="text-parchment/40 block mt-2">{t("ledger_checks:")}</span>
                {['SIGNATURES_VALID', 'FINALITY_2_CHAIN', 'ISSUANCE_RECORDED', 'STATE_ROOT_MATCH'].map((inv) => (
                  <span key={inv} className="pl-4 block">
                    <span className="text-parchment/40">{tx(inv)}: </span>
                    <span className="text-laurel font-bold">{t("PASS ✓")}</span>
                  </span>
                ))}
                <span className="text-parchment/40 block mt-2">{t("merkle_root:")}</span>
                <span className="pl-4 text-gold/70 block break-all">60847173…7c48</span>
                <span className="text-parchment/40 block">{t("epoch_timestamp: 2026-10-01T20:00:00Z")}</span>
              </div>
              <div className="absolute -top-2 -right-2 px-2.5 py-0.5 bg-laurel text-white text-[9px] font-bold uppercase tracking-wider rounded-[2px]">{t("Example Report")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: REVENUE MODEL ── */}
      <section className="py-20 lg:py-28 bg-parchment-canvas border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("Fiscal Architecture")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight mb-4">{t("No personal income tax: a proposed revenue model.")}</h2>
            <p className="text-navy/60 leading-relaxed">{t("As proposed, a future Aletheia would fund itself through fees, leasehold and endowment returns, not individual taxation. None of these revenues exists today.")}</p>
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
            <div className="relative">
              <Image
                src="/images/architecture_antioch.jpg"
                alt={t("Design study of Antioch")}
                width={640}
                height={440}
                className="w-full object-cover rounded-[4px]"
              />
            </div>
            <div className="space-y-6">
              <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block">{t("Business Platform · Proposed")}</span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">{t("Company formation, designed to take minutes.")}</h2>
              <p className="text-navy/65 leading-relaxed">{t("A proposed digital company registry, anchored to AletheiaChain: no paper filing, with each company record verifiable by anyone. It is not open; no company can be registered today.")}</p>
              <div className="space-y-3">
                {[
                  { step: '01', label: 'Digital application', desc: 'A formation form completed online.' },
                  { step: '02', label: 'Compliance check', desc: 'Statutory screening, with reasons for any refusal.' },
                  { step: '03', label: 'Published fee', desc: 'A fee set by law and published in advance.' },
                  { step: '04', label: 'Company charter', desc: 'The registration recorded on AletheiaChain.' },
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
                <Link href="/business" className="px-5 py-2.5 bg-navy text-parchment font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-navy-deep transition-colors flex items-center gap-2 border border-gold/20 group">{t("Business Platform")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="/development#seastead" className="px-5 py-2.5 border border-navy/15 text-navy font-semibold text-[12px] uppercase tracking-wider rounded-[3px] hover:border-navy/30 hover:bg-navy/[0.03] transition-all">{t("The Seastead")}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
