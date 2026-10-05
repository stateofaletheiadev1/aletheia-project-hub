'use client';

import React from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Zap,
  Wind,
  Waves,
  Atom,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Droplets,
  Activity,
} from 'lucide-react';

export default function EnergyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Sovereign Energy Grid</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">
              Clean Energy Independence & Marine Grid
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              100% zero-emission power generation combining offshore floating wind, marine wave harvesting, and Small Modular Reactors (SMRs). Engineered for infinite energy resilience and green hydrogen export.
            </p>
          </div>
        </div>
      </section>

      {/* ── GRID STATS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Zero-Carbon Generation</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">1.2 GW</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Phase 1 Target Capacity</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">400 kV</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">European HVDC Subsea Link</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">0.04 AEY</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Wholesale Industrial kWh</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 GENERATION PILLARS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Energy Matrix</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">The Quad-Pillar Clean Generation Stack</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            By avoiding reliance on single-source renewables, Aletheia achieves guaranteed 99.999% baseload power availability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="icon-sovereign"><Wind className="w-5 h-5 text-gold" /></div>
            <h3 className="text-base font-bold text-navy">Offshore Wind</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Deepwater floating turbines moored in high-wind pelagic zones generating over 600 MW of primary electrical supply.
            </p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-4 group">
            <Atom className="w-8 h-8 text-navy" />
            <h3 className="text-base font-bold text-navy">Small Modular Reactors</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Walk-away safe Generation IV SMRs located in St. Barbara State providing non-intermittent baseline power.
            </p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <Waves className="w-8 h-8 text-laurel" />
            <h3 className="text-base font-bold text-navy">Wave Energy Converters</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Submerged oscillating water columns integrated into harbor breakwaters converting oceanic surge into grid power.
            </p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="icon-sovereign"><Droplets className="w-5 h-5 text-gold" /></div>
            <h3 className="text-base font-bold text-navy">Green Hydrogen</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Electrolyzer facilities consuming peak surplus generation to produce liquid hydrogen for industrial and maritime transport.
            </p>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            Sovereign Infrastructure Partnerships
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            International energy developers and marine contractors are invited to review project specifications for upcoming Phase 1 procurement tranches.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/invest"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Invest in Energy Bonds
            </Link>
            <Link
              href="/development"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Spatial Development Plan
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
