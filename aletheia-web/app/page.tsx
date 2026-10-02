'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import { NationalFlag, StateEnsign } from '@/components/brand/Flags';
import {
  Shield,
  FileText,
  Anchor,
  Cpu,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Compass,
  Building2,
  CheckCircle,
  Database,
  Lock,
  Landmark,
  Scale,
  Users,
  Search,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION: MARITIME & ARCHITECTURAL IMMERSION
      ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden guilloche-bg text-parchment pt-16 pb-24 lg:pt-28 lg:pb-36 border-b border-gold/40">
        {/* Curated Maritime Photographic Backdrop (Subtle Editorial Blend) */}
        <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-luminosity">
          <Image
            src="/images/hero_maritime.jpg"
            alt="North Sea Maritime Horizon"
            fill
            className="object-cover object-center"
            priority
          />
        </div>

        {/* Ambient Dark Navy Gradient Overlay to Ensure AAA Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy/95 to-navy/85 pointer-events-none" />

        {/* Geometric Hexagonal Watermark Overlay */}
        <div className="absolute inset-0 opacity-[0.045] pointer-events-none flex items-center justify-center">
          <svg width="1200" height="1200" viewBox="0 0 100 100" fill="none">
            <polygon points="50,0 95,27 95,85 50,112 5,85 5,27" stroke="#C49A4E" strokeWidth="0.5" />
            <polygon points="50,10 85,32 85,78 50,100 15,78 15,32" stroke="#C49A4E" strokeWidth="0.3" />
            <circle cx="50" cy="50" r="45" stroke="#C49A4E" strokeWidth="0.2" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Headline & Directives (Col 7) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1 bg-navy-deep/90 border border-gold/40 rounded-sm gold-glow">
                <StarOfTruth size={16} />
                <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                  SOVEREIGN MARITIME REPUBLIC
                </span>
                <span className="text-parchment/40">|</span>
                <span className="text-xs text-parchment/90 font-serif italic">Veritas in Foedere</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-parchment leading-[1.12]">
                Building a new standard for life, technology <span className="text-gold-metallic">&amp; civic infrastructure.</span>
              </h1>

              <p className="text-base sm:text-lg text-parchment/80 leading-relaxed max-w-2xl font-light">
                Aletheia is a compact, high-efficiency European-oriented maritime republic. Its founding principle is simple: proof is the default, not the exception. Public records are immutable, currency backing is provable in real-time, and government spending leaves an auditable receipt.
              </p>

              {/* Status Indicator Bar */}
              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-parchment/70">
                <span className="font-semibold text-gold uppercase tracking-wider text-[11px]">
                  Platform Status:
                </span>
                <StatusBadge status="Under Development" size="sm" />
                <span className="text-parchment/40">•</span>
                <span className="text-parchment/80">Edition 2026.3 National Blueprint</span>
                <span className="text-parchment/40">•</span>
                <span className="font-mono text-gold-tint">stateofaletheia.org</span>
              </div>

              {/* Primary Calls to Action */}
              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/constitution"
                  className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group"
                >
                  <span>Explore the Constitution</span>
                  <ArrowRight className="w-4 h-4 text-navy group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/e-residency"
                  className="btn-sovereign-navy px-6 py-3.5 rounded-sm flex items-center gap-2"
                >
                  <span>Apply for E-Residency</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gold" />
                </Link>

                <Link
                  href="/design-system"
                  className="px-4 py-3.5 text-xs text-parchment/70 hover:text-gold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <span>Design System Specimen</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold/70" />
                </Link>
              </div>
            </div>

            {/* Right Emblem & Sovereign Achievement Card (Col 5) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-md bg-navy-deep/95 border border-gold/40 rounded-sm p-8 shadow-elevated relative overflow-hidden backdrop-blur-md space-y-6 gold-glow-intense crest-spotlight">
                {/* Gold Keyline Accents */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-gold/10 rounded-full blur-2xl pointer-events-none" />

                <div className="text-center space-y-3 relative z-10">
                  <div className="relative inline-block p-4 bg-navy/60 border border-gold/30 rounded-sm shadow-inner">
                    <Image
                      src="/coat_of_arms_transparent.png"
                      alt="Coat of Arms of the Sovereign Covenant State of Aletheia"
                      width={170}
                      height={200}
                      className="object-contain mx-auto drop-shadow-xl"
                      priority
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold tracking-[0.18em] uppercase text-parchment">
                      The Sovereign Covenant State
                    </h2>
                    <p className="text-xs text-gold tracking-widest uppercase font-medium mt-1">
                      Veritas in Foedere • Truth in Covenant
                    </p>
                  </div>
                </div>

                {/* State Micro-Metrics */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-parchment/15 text-xs relative z-10">
                  <div className="p-2.5 bg-navy/50 border border-gold/15 rounded-sm space-y-0.5 hover:border-gold/35 transition-colors">
                    <span className="text-[10px] text-gold uppercase tracking-wider block font-semibold">
                      Territorial Entity
                    </span>
                    <span className="font-semibold text-parchment">Antioch & 4 States</span>
                  </div>
                  <div className="p-2.5 bg-navy/50 border border-gold/15 rounded-sm space-y-0.5 hover:border-gold/35 transition-colors">
                    <span className="text-[10px] text-gold uppercase tracking-wider block font-semibold">
                      Constitutional Law
                    </span>
                    <span className="font-semibold text-parchment">67 Articles Capped</span>
                  </div>
                  <div className="p-2.5 bg-navy/50 border border-gold/15 rounded-sm space-y-0.5 hover:border-gold/35 transition-colors">
                    <span className="text-[10px] text-gold uppercase tracking-wider block font-semibold">
                      Executive Cabinet
                    </span>
                    <span className="font-semibold text-parchment">Nine Ministries Max</span>
                  </div>
                  <div className="p-2.5 bg-navy/50 border border-gold/15 rounded-sm space-y-0.5 hover:border-gold/35 transition-colors">
                    <span className="text-[10px] text-gold uppercase tracking-wider block font-semibold">
                      Sovereign Ledger
                    </span>
                    <span className="font-semibold text-parchment font-mono">500ms Finality</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. TRUTHFULNESS & STATUS OVERVIEW (MANDATORY §3)
      ────────────────────────────────────────────────────────────── */}
      <section className="bg-parchment-canvas border-b border-navy/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                CIVIC LEGITIMACY &amp; TRUTH IN REPRESENTATION
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">
                National Architecture Status at a Glance
              </h2>
              <p className="text-xs sm:text-sm text-navy/70 max-w-2xl leading-relaxed">
                Aletheia never presents future aspiration as established physical fact. Every national asset carries an explicit, binding status certified by sovereign covenant.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Operational" size="sm" />
              <StatusBadge status="Under Development" size="sm" />
              <StatusBadge status="Planned" size="sm" />
              <StatusBadge status="Proposed" size="sm" />
              <StatusBadge status="Vision" size="sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="sovereign-card p-6 rounded-sm space-y-3 bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-laurel/40 group-hover:bg-laurel transition-colors" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-navy">
                  1. Digital Platform &amp; Registry
                </span>
                <StatusBadge status="Operational" size="sm" />
              </div>
              <p className="text-xs text-navy/70 leading-relaxed font-light">
                The constitutional architecture, design tokens, identity schema, and open-questions decision records are formalized, cryptographic, and public.
              </p>
            </div>

            <div className="sovereign-card p-6 rounded-sm space-y-3 bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gold/40 group-hover:bg-gold transition-colors" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-navy">
                  2. StableChain Protocol &amp; APN
                </span>
                <StatusBadge status="Under Development" size="sm" />
              </div>
              <p className="text-xs text-navy/70 leading-relaxed font-light">
                Deterministic DAG ledger engine, AEY reserve backing invariants, and zero-gas fee settlement rails currently in active testnet deployment.
              </p>
            </div>

            <div className="sovereign-card p-6 rounded-sm space-y-3 bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-navy/30 group-hover:bg-navy transition-colors" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-navy">
                  3. Territorial Antioch Build
                </span>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <p className="text-xs text-navy/70 leading-relaxed font-light">
                Antioch hexagonal master plan, maritime port engineering at Port Nicholas, and offshore energy platform construction scheduled in 2026–2030 roadmap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. EDITORIAL NARRATIVE: THE COVENANT WITH ASSEMBLY IMAGE
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-parchment-light border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative Text */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                  PART I: THE COVENANT
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">
                  Truth unhidden: why Aletheia builds upon a provable ledger.
                </h2>
              </div>

              <p className="text-base text-navy/80 leading-relaxed font-light">
                Most friction in modern governance — bureaucratic queues, lost deeds, delayed payments, opaque ministerial budgets, and disputed elections — stems from systems that cannot prove what they say.
              </p>

              <p className="text-base text-navy/80 leading-relaxed font-light">
                Aletheia replaces bureaucratic friction with deterministic cryptography. Land titles, business registrations, identity credentials, and public finance receipts are settled once onto the sovereign ledger with cryptographic Merkle proofs against finalized blocks. Proof is the baseline guarantee.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="sovereign-card p-4 rounded-sm space-y-1 bg-white">
                  <div className="flex items-center gap-2 text-gold-shadow font-bold text-xs uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4 text-laurel" />
                    <span>Provable Accounts</span>
                  </div>
                  <p className="text-xs text-navy/70 leading-relaxed font-light">
                    Every government disbursement produces an immutable public receipt checked by the Auditor-General each epoch.
                  </p>
                </div>

                <div className="sovereign-card p-4 rounded-sm space-y-1 bg-white">
                  <div className="flex items-center gap-2 text-gold-shadow font-bold text-xs uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4 text-laurel" />
                    <span>Honest Reserves</span>
                  </div>
                  <p className="text-xs text-navy/70 leading-relaxed font-light">
                    The Aletheian Guilder (AEY) is redeemable and mathematically guarded by twelve supply invariants. The state node halts rather than print unbacked currency.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/constitution"
                  className="inline-flex items-center gap-2 text-navy hover:text-gold font-bold text-xs uppercase tracking-wider transition-colors group"
                >
                  <span>Read The Constitutional Covenant</span>
                  <ChevronRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Right Architectural Assembly Image Box */}
            <div className="lg:col-span-5 space-y-4">
              <div className="relative h-64 sm:h-72 w-full rounded-sm overflow-hidden border border-gold/30 shadow-institutional gold-glow">
                <Image
                  src="/images/civic_assembly.jpg"
                  alt="Modern European Parliamentary Assembly Hall"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/95 via-navy/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-parchment space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gold">
                    <span className="font-bold tracking-wider">COVENANT ASSEMBLY HALL</span>
                    <span>61 SEATS</span>
                  </div>
                  <p className="text-xs text-parchment/90 font-light">
                    Representation elected by open-list PR across Antioch and the four constituent states.
                  </p>
                </div>
              </div>

              <div className="bg-navy-deep p-6 text-parchment rounded-sm border border-gold/30 shadow-elevated space-y-4 gold-glow">
                <div className="flex items-center justify-between border-b border-parchment/15 pb-3">
                  <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">
                    FOUR CONSTITUTIONAL PILLARS
                  </span>
                  <HexagonCross size={20} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-navy/80 border border-gold/15 rounded-sm hover:border-gold/40 transition-colors">
                    <span className="text-gold font-bold block mb-0.5">I. Legislature</span>
                    <span className="text-parchment/80 text-[11px]">Covenant Assembly</span>
                  </div>
                  <div className="p-3 bg-navy/80 border border-gold/15 rounded-sm hover:border-gold/40 transition-colors">
                    <span className="text-gold font-bold block mb-0.5">II. States</span>
                    <span className="text-parchment/80 text-[11px]">Council of 15</span>
                  </div>
                  <div className="p-3 bg-navy/80 border border-gold/15 rounded-sm hover:border-gold/40 transition-colors">
                    <span className="text-gold font-bold block mb-0.5">III. Executive</span>
                    <span className="text-parchment/80 text-[11px]">9 Capped Ministries</span>
                  </div>
                  <div className="p-3 bg-navy/80 border border-gold/15 rounded-sm hover:border-gold/40 transition-colors">
                    <span className="text-gold font-bold block mb-0.5">IV. Verification</span>
                    <span className="text-parchment/80 text-[11px]">Auditor-General</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. THE FIVE TERRITORIES & MASTERPLAN OF ANTIOCH
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-24 bg-parchment-canvas border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-navy/15 pb-6">
            <div className="lg:col-span-8 space-y-2">
              <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                PART II: THE TERRITORY
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-navy">
                Antioch & The Four Founding States
              </h2>
              <p className="text-sm text-navy/70 max-w-2xl leading-relaxed">
                A geometric urban master plan radiating outward across concentric rings and six grand avenues, flanked by four specialized coastal and maritime states.
              </p>
            </div>
            <div className="lg:col-span-4 flex justify-start lg:justify-end">
              <Link
                href="/development"
                className="text-xs font-semibold uppercase tracking-wider text-navy hover:text-gold flex items-center gap-1.5 transition-colors"
              >
                <span>Explore Urban Masterplan</span>
                <ArrowRight className="w-4 h-4 text-gold" />
              </Link>
            </div>
          </div>

          {/* Featured Antioch Architecture Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white border border-navy/15 rounded-sm p-6 lg:p-8 shadow-subtle items-center">
            <div className="lg:col-span-7 relative h-72 lg:h-96 rounded-sm overflow-hidden border border-navy/10">
              <Image
                src="/images/architecture_antioch.jpg"
                alt="Antioch European Civic Architecture"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 text-parchment">
                <span className="text-[10px] font-mono text-gold uppercase tracking-wider block">
                  CAPITAL PRECINCT
                </span>
                <h4 className="text-lg font-bold text-parchment">
                  Antioch Central Ledger & Diplomatic District
                </h4>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <HexagonCross size={24} />
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-2xl font-bold text-navy">
                The Concentric Capital City
              </h3>
              <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
                Antioch is engineered as the civic heart of Aletheia: six radial avenues connecting three concentric rings to a central hexagonal plaza housing the Assembly, the High Court, and state validator vaults.
              </p>
              <div className="space-y-2 pt-2 border-t border-navy/10 text-xs text-navy/80">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Radial Avenues:</span>
                  <span className="font-mono text-gold-shadow">6 Continental Axes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Circumferential Rings:</span>
                  <span className="font-mono text-gold-shadow">Ring I, II & III</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Geocoding Postal Standard:</span>
                  <span className="font-mono text-gold-shadow">APS-44 Hex Grid</span>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/development#antioch"
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-shadow hover:text-navy transition-colors"
                >
                  <span>Antioch Architectural Specs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Four States Showcase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* St. Barbara State */}
            <div className="sovereign-card rounded-sm p-6 space-y-4 flex flex-col justify-between bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-navy" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-sm bg-navy/10 flex items-center justify-center text-navy group-hover:scale-110 transition-transform">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-navy text-base">St. Barbara State</h3>
                  <span className="text-[11px] text-gold font-mono font-semibold uppercase tracking-wider block mt-0.5">Capital: Port Michael</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed font-light">
                  Aerospace engineering, sovereign defence installations, and national cybersecurity operations.
                </p>
              </div>
              <div className="pt-3 border-t border-navy/10 text-[10px] font-mono text-gold font-bold uppercase tracking-wider">
                Quarter I: Tower (Navy)
              </div>
            </div>

            {/* Augustine State */}
            <div className="sovereign-card rounded-sm p-6 space-y-4 flex flex-col justify-between bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-burgundy" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-sm bg-burgundy/10 flex items-center justify-center text-burgundy group-hover:scale-110 transition-transform">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-navy text-base">Augustine State</h3>
                  <span className="text-[11px] text-gold font-mono font-semibold uppercase tracking-wider block mt-0.5">Capital: Port Luke</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed font-light">
                  National University, medical faculties, biotechnology research, and family health center.
                </p>
              </div>
              <div className="pt-3 border-t border-navy/10 text-[10px] font-mono text-gold font-bold uppercase tracking-wider">
                Quarter II: Book &amp; Heart
              </div>
            </div>

            {/* Benedict State */}
            <div className="sovereign-card rounded-sm p-6 space-y-4 flex flex-col justify-between bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gold" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-sm bg-gold/15 flex items-center justify-center text-gold-shadow group-hover:scale-110 transition-transform">
                    <Zap className="w-4 h-4" />
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-navy text-base">Benedict State</h3>
                  <span className="text-[11px] text-gold font-mono font-semibold uppercase tracking-wider block mt-0.5">Capital: San José</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed font-light">
                  Offshore clean wind, small modular nuclear reactors, desalination, agriculture, and manufacturing.
                </p>
              </div>
              <div className="pt-3 border-t border-navy/10 text-[10px] font-mono text-gold font-bold uppercase tracking-wider">
                Quarter III: Wheat &amp; Sun
              </div>
            </div>

            {/* St. Brendan State */}
            <div className="sovereign-card rounded-sm p-6 space-y-4 flex flex-col justify-between bg-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-laurel" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-sm bg-laurel/15 flex items-center justify-center text-laurel group-hover:scale-110 transition-transform">
                    <Anchor className="w-4 h-4" />
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-navy text-base">St. Brendan State</h3>
                  <span className="text-[11px] text-gold font-mono font-semibold uppercase tracking-wider block mt-0.5">Capital: Port Nicholas</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed font-light">
                  Deepwater commercial container port, naval docks, maritime freight logistics, and North Sea ferry link.
                </p>
              </div>
              <div className="pt-3 border-t border-navy/10 text-[10px] font-mono text-gold font-bold uppercase tracking-wider">
                Quarter IV: Caravel on Waves
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. CIVIC ACCESS: CITIZENSHIP, E-RESIDENCY & PASSPORTS
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-24 bg-parchment-light border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 flex justify-center">
              {/* Aletheian ICAO eMRTD Passport — Covenant Burgundy, transparent background */}
              <div className="relative flex justify-center">
                <Image
                  src="/passport_cover.png"
                  alt="Aletheian ICAO TD3 eMRTD Passport — Covenant Burgundy cover with gold coat of arms"
                  width={310}
                  height={433}
                  className="object-contain"
                  style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.35)) drop-shadow(0 4px 10px rgba(112,24,36,0.3))' }}
                  priority
                />
              </div>
            </div>

            {/* Right: Membership Comparison Hierarchy */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                  PART IV: CITIZENS & SOCIETY
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy">
                  Membership by Covenant: transparent standards for all.
                </h2>
                <p className="text-base text-navy/70 leading-relaxed">
                  Citizenship is not a commercial product. Aletheia maintains an unambiguous distinction between digital e-residency, physical residency, and full sovereign citizenship.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-white border border-navy/15 rounded-sm flex items-start gap-4">
                  <div className="p-2 bg-navy text-gold rounded-sm shrink-0 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-navy">E-Residency</h4>
                      <StatusBadge status="Under Development" size="sm" />
                    </div>
                    <p className="text-xs text-navy/70">
                      Digital identity, 15-minute company formation, APN settlement account, remote contract execution. Conveys <strong>no physical residence or voting rights</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border border-navy/15 rounded-sm flex items-start gap-4">
                  <div className="p-2 bg-navy text-gold rounded-sm shrink-0 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-navy">Lawful Residence</h4>
                      <StatusBadge status="Planned" size="sm" />
                    </div>
                    <p className="text-xs text-navy/70">
                      5-year renewable permit to live, work, and study in Aletheia with access to healthcare and education. Local municipal voting rights after 2 years.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border border-navy/15 rounded-sm flex items-start gap-4">
                  <div className="p-2 bg-navy text-gold rounded-sm shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-navy">Citizenship & Passport</h4>
                      <StatusBadge status="Planned" size="sm" />
                    </div>
                    <p className="text-xs text-navy/70">
                      Conferred by birth or naturalisation after 5 years PR, civic proficiency in English and one other official language, and the public Covenant Oath.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <Link
                  href="/citizenship"
                  className="px-5 py-2.5 bg-navy text-parchment text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors"
                >
                  Citizenship Standards
                </Link>
                <Link
                  href="/passport"
                  className="px-5 py-2.5 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-parchment-canvas transition-colors"
                >
                  ICAO Passport Specification
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FINANCIAL OPERATING SYSTEM: STABLECHAIN & AEY
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-24 bg-navy text-parchment border-b border-gold/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
              PART V: THE FINANCIAL OPERATING SYSTEM
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">
              Critical national payment infrastructure, not a crypto experiment.
            </h2>
            <p className="text-sm sm:text-base text-parchment/80 font-light leading-relaxed">
              Aletheia rejects volatile token speculation. The state operates StableChain: an enterprise-grade DAG ledger delivering 500 ms slot finality, real-time public reserve verification, and fixed micro-cent settlement fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-navy-deep border border-gold/25 rounded-sm space-y-3">
              <div className="text-gold font-mono text-2xl font-bold">500 ms</div>
              <h3 className="text-sm font-semibold text-parchment">Block Slot Finality</h3>
              <p className="text-xs text-parchment/70 leading-relaxed">
                Transactions settle deterministically every 500 milliseconds across state-authorized validator clusters.
              </p>
            </div>

            <div className="p-6 bg-navy-deep border border-gold/25 rounded-sm space-y-3">
              <div className="text-gold font-mono text-2xl font-bold">100% Backed</div>
              <h3 className="text-sm font-semibold text-parchment">Provable AEY Reserve</h3>
              <p className="text-xs text-parchment/70 leading-relaxed">
                The Aletheian Guilder (AEY) is pegged 1:1 with EUR. Cryptographic balance sheet proofs published every epoch.
              </p>
            </div>

            <div className="p-6 bg-navy-deep border border-gold/25 rounded-sm space-y-3">
              <div className="text-gold font-mono text-2xl font-bold">0% Income Tax</div>
              <h3 className="text-sm font-semibold text-parchment">National Funding Model</h3>
              <p className="text-xs text-parchment/70 leading-relaxed">
                Zero personal income and capital gains tax. State revenue funded by land leasehold dividends, APN fees, and the Covenant Endowment.
              </p>
            </div>

            <div className="p-6 bg-navy-deep border border-gold/25 rounded-sm space-y-3">
              <div className="text-gold font-mono text-2xl font-bold">APN Rail</div>
              <h3 className="text-sm font-semibold text-parchment">Aletheia Payment Network</h3>
              <p className="text-xs text-parchment/70 leading-relaxed">
                Instant merchant settlement connecting retail point-of-sale directly to SEPA and SWIFT cross-border gateways.
              </p>
            </div>
          </div>

          <div className="p-6 bg-navy-subtle/40 border border-parchment/15 rounded-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-gold" />
              <span className="text-xs text-parchment/80">
                StableChain Core Specification v2.5 available for engineering audit.
              </span>
            </div>
            <Link
              href="/stablechain"
              className="text-xs font-semibold uppercase tracking-wider text-gold hover:text-gold-tint flex items-center gap-1.5 transition-colors"
            >
              <span>Explore StableChain Architecture</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. ADSS & MANDATORY CYBERSECURITY WITH PHOTO
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-24 bg-parchment-canvas border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-navy/15 pb-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                PART III: SECURITY & RESILIENCE
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-navy">
                Aletheian Defence & Security Service (ADSS)
              </h2>
              <p className="text-sm text-navy/70 max-w-xl">
                A unified defence and civilian security institution operating under strict civilian command, with a mandatory sovereign Cybersecurity Department.
              </p>
            </div>
            <Link
              href="/adss"
              className="text-xs font-semibold uppercase tracking-wider text-navy hover:text-gold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span>View All Directorates</span>
              <ArrowRight className="w-4 h-4 text-gold" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Directorate 1: Cybersecurity Dept (Mandatory §15) */}
            <div className="p-6 bg-white border-2 border-gold/50 rounded-sm space-y-4 shadow-subtle hover:shadow-institutional transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="relative h-40 w-full rounded-sm overflow-hidden border border-navy/10">
                  <Image
                    src="/images/cyber_defence.jpg"
                    alt="High-Assurance Cyber Defence Operations"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-navy/40" />
                  <div className="absolute top-2 right-2">
                    <StatusBadge status="Operational" size="sm" />
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-navy text-base">Aletheian Cybersecurity Department</h3>
                  <span className="text-xs text-gold font-medium">National Cyber Defence & Threat Ops</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Mandatory core national security agency protecting government networks, digital identity registries, StableChain validators, and critical maritime infrastructure.
                </p>
              </div>

              <div className="pt-2 border-t border-navy/10">
                <Link
                  href="/adss/cybersecurity"
                  className="text-xs font-semibold text-navy hover:text-gold flex items-center gap-1 transition-colors"
                >
                  <span>Department Mandate & Disclosure</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold" />
                </Link>
              </div>
            </div>

            {/* Directorate 2: Police Directorate */}
            <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-4 shadow-subtle hover:shadow-institutional transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Shield className="w-6 h-6 text-navy" />
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <div>
                  <h3 className="font-bold text-navy text-base">Police Directorate</h3>
                  <span className="text-xs text-gold font-medium">Civilian Policing & Public Safety</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Civilian community law enforcement, criminal investigations, and municipal safety. Institutionally separate from military command structures.
                </p>
              </div>

              <div className="pt-2 border-t border-navy/10">
                <Link
                  href="/adss#police"
                  className="text-xs font-semibold text-navy hover:text-gold flex items-center gap-1 transition-colors"
                >
                  <span>Civilian Policing Charter</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold" />
                </Link>
              </div>
            </div>

            {/* Directorate 3: Immigration Directorate */}
            <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-4 shadow-subtle hover:shadow-institutional transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FileText className="w-6 h-6 text-navy" />
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <div>
                  <h3 className="font-bold text-navy text-base">Immigration Directorate</h3>
                  <span className="text-xs text-gold font-medium">Border Administration & Permits</span>
                </div>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Biometric entry/exit, residence card issuance, compliance verification, and integration with the secure Immigration Officer Workbench.
                </p>
              </div>

              <div className="pt-2 border-t border-navy/10">
                <Link
                  href="/admin/immigration"
                  className="text-xs font-semibold text-gold-shadow hover:text-navy flex items-center gap-1 transition-colors"
                >
                  <span>Immigration Officer Workbench</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. OFFICIAL DECREES & PUBLIC TRANSPARENCY NOTICE
      ────────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-parchment-light border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 bg-white border border-navy/15 rounded-sm shadow-subtle flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StarOfTruth size={18} />
                <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                  PUBLIC RECORD & OFFICIAL GAZETTE
                </span>
              </div>
              <h3 className="text-2xl font-bold text-navy">
                Every public decree, statute, and audit is openly published.
              </h3>
              <p className="text-xs sm:text-sm text-navy/70 max-w-2xl leading-relaxed">
                Explore the latest publications in the Official Gazette, read the full text of enacted protocols, or inspect the cryptographic integrity logs of the public ledger.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/documents"
                className="px-5 py-2.5 bg-navy text-parchment text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors"
              >
                Official Gazette
              </Link>
              <Link
                href="/transparency"
                className="px-5 py-2.5 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-parchment-canvas transition-colors"
              >
                Ledger Transparency
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
