'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Cpu,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Server,
  Layers,
  CheckCircle2,
  Code,
  Terminal,
  Activity,
  FileCheck2,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export default function StableChainPage() {
  const [blockHeight, setBlockHeight] = useState(4829104);
  const [tps, setTps] = useState(1482);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlockHeight((h) => h + 1);
      setTps(1450 + Math.floor(Math.random() * 80));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

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
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Sovereign Layer 1</span>
                </div>
                <StatusBadge status="Under Development" size="sm" />
              </div>

              <h1 className="heading-hero">
                Aletheia
                <br />
                <span className="text-gold-metallic">StableChain</span>
              </h1>

              <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light max-w-2xl">
                The cryptographic ledger infrastructure of the state. Engineered for 500ms deterministic finality, zero gas volatility, and native execution of constitutional statutes, corporate registries, and public expenditures.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/documents#aps-01-spec"
                  className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm"
                >
                  <span>APS-01 Technical Whitepaper</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/transparency"
                  className="btn-sovereign-ghost px-6 py-3.5 rounded-sm text-sm"
                >
                  Live Ledger Proofs
                </Link>
              </div>
            </div>

            {/* Right: Live block counter card */}
            <div className="lg:col-span-5 animate-fade-in-up delay-200">
              <div className="border-flow rounded-sm p-7 space-y-5 relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                <div className="absolute inset-0 bg-grid-gold opacity-[0.015] pointer-events-none" />

                <div className="relative z-10 text-center space-y-1">
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold/80">Live Block Height</p>
                  <div className="metric-display">#{blockHeight.toLocaleString()}</div>
                  <p className="text-xs text-parchment/50 font-mono">500ms deterministic slot · Merkle-committed</p>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Throughput', value: `${tps} TPS`, mono: true },
                    { label: 'Slot Time', value: '500 ms', mono: true },
                    { label: 'Fixed Gas', value: '0.0001 AEY', mono: true },
                    { label: 'Validators', value: 'I1–I12', mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="stat-tile p-3 rounded-sm text-center space-y-1">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{label}</span>
                      <span className={`text-sm font-bold text-parchment ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE LEDGER METRICS TICKER ── */}
      <section className="bg-[#060C14] border-b border-gold/25 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gold/15">
            {[
              { value: `#${blockHeight.toLocaleString()}`, label: 'Block Height', sublabel: 'Live · Merkle-committed' },
              { value: '500ms', label: 'Slot Time', sublabel: 'Deterministic finality' },
              { value: `${tps} TPS`, label: 'Throughput', sublabel: 'Live network load' },
              { value: '0.0001 AEY', label: 'Fixed Gas', sublabel: 'Statutory invariant' },
            ].map(({ value, label, sublabel }) => (
              <div key={label} className="px-6 py-4 text-center first:pl-0 last:pr-0 space-y-0.5">
                <div className="text-2xl font-bold font-mono text-gold tracking-tight">{value}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-parchment/80">{label}</div>
                <div className="text-[10px] text-parchment/40 font-mono">{sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECHNICAL ADVANTAGES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Protocol Engineering</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">Built for Constitutional Governance</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            Unlike speculative public blockchains, StableChain is designed strictly as a high-integrity sovereign public utility with zero congestion pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-3 hover:shadow-md transition-shadow">
            <Zap className="w-8 h-8 text-gold" />
            <h3 className="text-base font-bold text-navy">Deterministic Zero Gas Volatility</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Gas fees are pegged to fixed statutory micro-cents in AEY. Enterprises and citizens never experience network fee spikes during high traffic.
            </p>
          </div>

          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-3 hover:shadow-md transition-shadow">
            <Layers className="w-8 h-8 text-navy" />
            <h3 className="text-base font-bold text-navy">State Validator Consensus</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Consensus validator clusters are physically partitioned across the five federal states, with air-gapped sovereign HSM keys preventing unilateral interference.
            </p>
          </div>

          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-3 hover:shadow-md transition-shadow">
            <FileCheck2 className="w-8 h-8 text-laurel" />
            <h3 className="text-base font-bold text-navy">Native Legal Smart Contracts</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Standardized pre-compiled primitives for English commercial arbitration, company incorporation, and biometric passport public key registration.
            </p>
          </div>
        </div>

        {/* -- MAINNET ARCHITECTURE NOTICE -- */}
        <div className="mt-16 bg-navy text-parchment rounded-sm border border-gold/30 p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-parchment/10 pb-4">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-gold" />
              <h3 className="text-lg font-bold text-parchment">Sovereign Mainnet — Closed State Infrastructure</h3>
            </div>
            <span className="text-xs font-mono text-gold">Protocol Version: APS-01 v1.2</span>
          </div>

          <div className="bg-navy-deep border border-burgundy/30 rounded-sm px-5 py-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-parchment/80 leading-relaxed">
              <strong className="text-parchment">The Aletheia StableChain operates exclusively as closed sovereign public utility infrastructure.</strong>{' '}
              There is no public testnet. External parties are not permitted to build directly on the national ledger.
              Access is provided only through constitutionally authorised read-only APIs for transparency and audit purposes.
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs bg-navy-deep p-4 rounded-sm border border-navy/50">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-parchment/10 pb-2">
              <span className="text-gold">Public Read API (Transparency):</span>
              <span className="text-parchment/80 break-all">https://api.stablechain.aletheia.gov/v1/public</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-parchment/10 pb-2 pt-1">
              <span className="text-gold">Live Block Explorer:</span>
              <span className="text-parchment/80 break-all">https://explorer.stablechain.aletheia.gov</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-gold">EVM Chain ID:</span>
              <span className="text-parchment/80">9104 — Aletheia StableChain Mainnet</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-parchment/10">
            <Link href="/documents#aps-01-spec" className="text-sm font-semibold text-gold hover:text-gold-tint transition-colors flex items-center gap-1.5">
              <span>APS-01 Technical Specification</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-parchment/20">·</span>
            <Link href="/transparency" className="text-sm font-semibold text-parchment/60 hover:text-parchment transition-colors">
              Public Audit Portal
            </Link>
            <span className="text-parchment/20">·</span>
            <Link href="/government" className="text-sm font-semibold text-parchment/60 hover:text-parchment transition-colors">
              Ministry of Digital State
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
