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
      <section className="relative bg-navy text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/20">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/95 via-navy/90 to-navy-deep" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Sovereign Layer 1</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-parchment leading-[1.08]">
              Aletheia StableChain
            </h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light">
              The cryptographic ledger infrastructure of the state. Engineered for 500-millisecond deterministic finality, zero gas volatility, and native execution of constitutional statutes, corporate registries, and public expenditures.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => alert('Developer Testnet RPC: https://rpc.testnet.aletheia.gov')}
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2"
              >
                Connect to Testnet <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <Link
                href="/documents"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                APS-01 Technical Whitepaper
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE LEDGER METRICS TICKER ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">#{blockHeight.toLocaleString()}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide flex items-center justify-center gap-1">
                <Activity className="w-3 h-3 text-laurel" /> Current Block Height
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">500 ms</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Deterministic Slot Time</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">{tps} TPS</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Live Network Throughput</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">0.0001 AEY</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Fixed Gas Invariant</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TECHNICAL ADVANTAGES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

        {/* ── DEVELOPER INTEGRATION BOX ── */}
        <div className="mt-16 bg-navy text-parchment rounded-sm border border-gold/30 p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/40 pb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-gold" />
              <h3 className="text-lg font-bold text-parchment">Developer Quickstart & Endpoints</h3>
            </div>
            <span className="text-xs font-mono text-gold">Protocol Version: APS-01 v1.2</span>
          </div>

          <div className="space-y-3 font-mono text-xs bg-navy-deep p-4 rounded-sm border border-navy/50">
            <div className="flex justify-between border-b border-navy/40 pb-2">
              <span className="text-gold">JSON-RPC Endpoint:</span>
              <span className="text-parchment/80">https://rpc.stablechain.aletheia.gov</span>
            </div>
            <div className="flex justify-between border-b border-navy/40 pb-2 pt-1">
              <span className="text-gold">WebSocket Feed:</span>
              <span className="text-parchment/80">wss://ws.stablechain.aletheia.gov</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-gold">EVM Chain ID:</span>
              <span className="text-parchment/80">9104 (Aletheia Mainnet) / 9105 (Testnet)</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
