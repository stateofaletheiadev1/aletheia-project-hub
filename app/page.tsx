'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import { NationalFlag } from '@/components/brand/Flags';
import {
  Shield,
  FileText,
  Anchor,
  Cpu,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Building2,
  CheckCircle,
  Database,
  Lock,
  Landmark,
  Users,
  Zap,
  Globe,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. CINEMATIC HERO — FULL-BLEED IMMERSIVE OPENING
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="guilloche-hero relative overflow-hidden text-parchment border-b border-gold/30"
        style={{ minHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Photographic maritime backdrop */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/hero_maritime.jpg"
            alt="North Sea Maritime Horizon — Aletheia"
            fill
            className="object-cover object-center opacity-15 mix-blend-luminosity"
            priority
          />
        </div>

        {/* Deep gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#060C14]/90 via-[#0E1B31]/80 to-[#090F1A]/90 pointer-events-none" />

        {/* Floating ambient orbs */}
        <div className="orb-gold w-[580px] h-[580px] -top-40 -left-48 opacity-60 animate-orb-float-1" />
        <div className="orb-burgundy w-[440px] h-[440px] -bottom-32 right-10 opacity-50 animate-orb-float-2" />
        <div className="orb-navy w-[520px] h-[520px] top-1/4 right-1/3 opacity-40 animate-orb-float-3" />

        {/* Fine geometric hexagonal watermark */}
        <div className="absolute inset-0 opacity-[0.038] pointer-events-none flex items-center justify-end pr-4 lg:pr-12">
          <svg width="720" height="720" viewBox="0 0 100 100" fill="none" className="flex-shrink-0">
            <polygon points="50,2 95,27 95,73 50,98 5,73 5,27" stroke="#C49A4E" strokeWidth="0.6" />
            <polygon points="50,12 85,32 85,68 50,88 15,68 15,32" stroke="#C49A4E" strokeWidth="0.4" />
            <polygon points="50,22 75,37 75,63 50,78 25,63 25,37" stroke="#C49A4E" strokeWidth="0.3" />
            <circle cx="50" cy="50" r="46" stroke="#C49A4E" strokeWidth="0.25" />
            <circle cx="50" cy="50" r="36" stroke="#C49A4E" strokeWidth="0.18" />
            <circle cx="50" cy="50" r="5" stroke="#C49A4E" strokeWidth="0.5" />
            <line x1="50" y1="5" x2="50" y2="45" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="90" y1="28" x2="54.3" y2="52.5" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="90" y1="72" x2="54.3" y2="47.5" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="50" y1="95" x2="50" y2="55" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="10" y1="72" x2="45.7" y2="47.5" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="10" y1="28" x2="45.7" y2="52.5" stroke="#C49A4E" strokeWidth="0.15" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex-1 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-20 w-full">

            {/* ─── LEFT: HEADLINE + CTA ─── */}
            <div className="lg:col-span-7 space-y-7">

              {/* Sovereign badge */}
              <div className="animate-fade-in-up">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-[#0E1B31]/80 border border-gold/40 rounded-sm backdrop-blur-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-gold">
                    Sovereign Maritime Republic
                  </span>
                  <span className="text-parchment/25">│</span>
                  <span className="text-[11px] text-parchment/70 font-serif italic">Veritas in Foedere</span>
                </div>
              </div>

              {/* Hero headline */}
              <h1 className="heading-hero animate-fade-in-up delay-100">
                Building a new standard
                <br />
                for life, technology{' '}
                <span className="text-gold-metallic">&amp; civic</span>
                <br />
                <span className="text-gold-metallic">infrastructure.</span>
              </h1>

              {/* Sub-headline */}
              <p className="text-lg text-parchment/72 leading-[1.85] max-w-xl font-light animate-fade-in-up delay-200">
                Aletheia is a compact, high-efficiency European-oriented maritime republic. Proof
                is the default, not the exception — public records are immutable, currency backing
                is provable in real-time, and government spending leaves an auditable receipt.
              </p>

              {/* Status row */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] animate-fade-in-up delay-300">
                <span className="font-bold tracking-[0.14em] uppercase text-gold/80">Platform Status:</span>
                <StatusBadge status="Under Development" size="sm" />
                <span className="text-parchment/25">•</span>
                <span className="text-parchment/60">Edition 2026.3 National Blueprint</span>
                <span className="text-parchment/25">•</span>
                <span className="font-mono text-gold-tint/80">stateofaletheia.org</span>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-4 animate-fade-in-up delay-400">
                <Link
                  href="/constitution"
                  className="btn-sovereign-gold px-8 py-4 rounded-sm flex items-center gap-3 group text-sm"
                >
                  <span>Explore the Constitution</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
                <Link
                  href="/e-residency"
                  className="btn-sovereign-navy px-7 py-4 rounded-sm flex items-center gap-2.5 text-sm"
                >
                  <span>Apply for E-Residency</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gold/70" />
                </Link>
              </div>

              {/* Quick nav pills */}
              <div className="flex flex-wrap gap-2 animate-fade-in-up delay-500">
                {[
                  { label: 'Constitution', href: '/constitution' },
                  { label: 'Economy & AEY', href: '/economy' },
                  { label: 'Citizenship', href: '/citizenship' },
                  { label: 'E-Residency', href: '/e-residency' },
                  { label: 'StableChain', href: '/stablechain' },
                ].map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-parchment/50 border border-parchment/12 rounded-sm hover:text-gold hover:border-gold/40 transition-all duration-200 backdrop-blur-sm"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* ─── RIGHT: SOVEREIGN ACHIEVEMENT CARD ─── */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-end animate-fade-in-up delay-200">
              <div className="w-full max-w-sm bg-[#0A1420]/85 border border-gold/35 rounded-sm p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl gold-glow-intense">
                {/* Top gold hairline */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                {/* Ambient glow center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gold/8 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 text-center space-y-5">
                  <div className="relative inline-block p-5 bg-navy/50 border border-gold/20 rounded-sm">
                    <Image
                      src="/coat_of_arms_transparent.png"
                      alt="Coat of Arms of the Sovereign Covenant State of Aletheia"
                      width={148}
                      height={175}
                      className="object-contain mx-auto drop-shadow-2xl"
                      priority
                    />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-parchment/95">
                      The Sovereign Covenant State
                    </h2>
                    <p className="text-[11px] text-gold tracking-[0.18em] uppercase font-semibold mt-1.5">
                      Veritas in Foedere · Truth in Covenant
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-parchment/10">
                    {[
                      { label: 'Territorial Entity', value: 'Antioch & 4 States' },
                      { label: 'Constitutional Law', value: '67 Articles Capped' },
                      { label: 'Executive Cabinet', value: 'Nine Ministries Max' },
                      { label: 'Sovereign Ledger', value: '500ms Finality' },
                    ].map(({ label, value }) => (
                      <div key={label} className="stat-tile p-3 rounded-sm text-left space-y-1">
                        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{label}</span>
                        <span className="text-xs font-semibold text-parchment leading-tight block">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <NationalFlag width={42} height={28} />
                    <div className="h-4 w-px bg-gold/20" />
                    <span className="text-[10px] text-gold/60 tracking-widest uppercase font-medium">
                      Maritime Republic
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gold bridge divider */}
      <div className="section-bridge-gold" />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          2. LIVE METRICS BANNER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-navy-deep border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gold/15">
            {[
              { value: '100%', label: 'Reserve Backing', sub: 'AEY · EUR Parity', status: 'Operational' as const },
              { value: '1:1', label: 'AEY / EUR Peg', sub: 'Fixed, on-chain', status: 'Operational' as const },
              { value: '500ms', label: 'Ledger Finality', sub: 'StableChain slots', status: 'Under Development' as const },
              { value: '0%', label: 'Personal Income Tax', sub: 'By constitutional decree', status: 'Operational' as const },
            ].map(({ value, label, sub, status }) => (
              <div key={label} className="py-6 px-6 text-center space-y-1.5">
                <div className="big-stat-value">{value}</div>
                <div className="text-xs font-semibold text-parchment/90">{label}</div>
                <div className="text-[10px] text-parchment/40 tracking-wide">{sub}</div>
                <div className="pt-1">
                  <StatusBadge status={status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3. PLATFORM STATUS — CIVIC TRUTHFULNESS MANDATE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-canvas section-lg border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="eyebrow mb-4">Civic Legitimacy &amp; Truth in Representation</div>
            <h2 className="text-4xl font-bold text-navy tracking-tight leading-[1.15] mb-4">
              National Architecture
              <br />Status at a Glance
            </h2>
            <p className="text-navy/60 text-base leading-relaxed font-light">
              Aletheia never presents future aspiration as established physical fact. Every national
              asset carries an explicit, binding status certified by sovereign covenant.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-10">
            <StatusBadge status="Operational" size="sm" />
            <StatusBadge status="Under Development" size="sm" />
            <StatusBadge status="Planned" size="sm" />
            <StatusBadge status="Proposed" size="sm" />
            <StatusBadge status="Vision" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: '01', title: 'Digital Platform & Registry', status: 'Operational' as const,
                color: 'bg-laurel',
                desc: 'Constitutional architecture, design tokens, identity schema, and open-questions decision records are formalized, cryptographic, and publicly auditable.',
              },
              {
                num: '02', title: 'StableChain Protocol & APN', status: 'Under Development' as const,
                color: 'bg-gold',
                desc: 'Deterministic DAG ledger engine, AEY reserve backing invariants, and zero-gas fee settlement rails currently in active testnet deployment.',
              },
              {
                num: '03', title: 'Territorial Antioch Build', status: 'Planned' as const,
                color: 'bg-navy',
                desc: 'Antioch hexagonal master plan, maritime port engineering at Port Nicholas, and offshore energy platform construction scheduled 2026–2030.',
              },
            ].map(({ num, title, status, color, desc }) => (
              <div key={num} className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
                <div className={`h-[3px] w-full ${color}`} />
                <div className="p-7 space-y-4 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-mono text-navy/30 block mb-1">{num}</span>
                      <h3 className="text-sm font-bold text-navy uppercase tracking-wide leading-tight">{title}</h3>
                    </div>
                    <StatusBadge status={status} size="sm" />
                  </div>
                  <p className="text-sm text-navy/60 leading-relaxed font-light">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          4. THE COVENANT — EDITORIAL NARRATIVE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-light section-xl border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">

            <div className="lg:col-span-6 space-y-8">
              <div className="space-y-3">
                <div className="eyebrow">Part I: The Covenant</div>
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-navy leading-[1.12]">
                  Truth unhidden: why Aletheia
                  <br />builds upon a{' '}
                  <em className="not-italic text-gold">provable ledger.</em>
                </h2>
              </div>

              <div className="space-y-5 text-navy/72 text-base leading-[1.88] font-light">
                <p>
                  Most friction in modern governance — bureaucratic queues, lost deeds, delayed payments,
                  opaque ministerial budgets, and disputed elections — stems from systems that cannot
                  prove what they say.
                </p>
                <p>
                  Aletheia replaces bureaucratic friction with deterministic cryptography. Land titles,
                  business registrations, identity credentials, and public finance receipts are settled
                  once onto the sovereign ledger with cryptographic Merkle proofs against finalized
                  blocks. <strong className="text-navy font-semibold">Proof is the baseline guarantee.</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: CheckCircle, title: 'Provable Accounts', desc: 'Every government disbursement produces an immutable public receipt checked by the Auditor-General each epoch.' },
                  { icon: Lock, title: 'Honest Reserves', desc: 'The AEY is redeemable and mathematically guarded by twelve supply invariants. The node halts rather than print unbacked currency.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="sovereign-card-premium p-5 rounded-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-laurel flex-shrink-0" />
                      <span className="text-xs font-bold text-navy uppercase tracking-wider">{title}</span>
                    </div>
                    <p className="text-xs text-navy/58 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <Link href="/constitution" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
                <span>Read The Constitutional Covenant</span>
                <ChevronRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="lg:col-span-6 space-y-5">
              <div className="relative h-72 sm:h-80 rounded-sm overflow-hidden border border-gold/20 shadow-elevated gold-glow">
                <Image
                  src="/images/civic_assembly.jpg"
                  alt="Covenant Assembly Hall — Aletheia Legislature"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/95 via-navy/30 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-parchment space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">Covenant Assembly Hall</span>
                    <span className="text-[11px] font-mono text-parchment/55">61 Seats</span>
                  </div>
                  <p className="text-xs text-parchment/75 font-light">
                    Representation elected by open-list PR across Antioch and the four constituent states.
                  </p>
                </div>
              </div>

              <div className="bg-navy-deep p-6 text-parchment rounded-sm border border-gold/25 shadow-elevated gold-glow space-y-4">
                <div className="flex items-center justify-between border-b border-parchment/10 pb-3">
                  <span className="text-[11px] font-bold tracking-[0.20em] uppercase text-gold">Four Constitutional Pillars</span>
                  <HexagonCross size={18} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { roman: 'I.', branch: 'Legislature', body: 'Covenant Assembly' },
                    { roman: 'II.', branch: 'States', body: 'Council of 15' },
                    { roman: 'III.', branch: 'Executive', body: '9 Capped Ministries' },
                    { roman: 'IV.', branch: 'Verification', body: 'Auditor-General' },
                  ].map(({ roman, branch, body }) => (
                    <div key={branch} className="p-3 bg-navy/60 border border-gold/12 rounded-sm hover:border-gold/35 transition-colors">
                      <span className="text-gold font-bold text-xs block mb-0.5">{roman} {branch}</span>
                      <span className="text-parchment/65 text-[11px]">{body}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          5. THE TERRITORY — ANTIOCH & THE FOUR FOUNDING STATES
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-canvas section-xl border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="eyebrow">Part II: The Territory</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">
                Antioch &amp; The Four<br />Founding States
              </h2>
              <p className="text-navy/60 max-w-xl text-base leading-relaxed font-light">
                A geometric urban master plan radiating outward across concentric rings and six grand
                avenues, flanked by four specialized coastal and maritime states.
              </p>
            </div>
            <Link href="/development" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors shrink-0 group">
              <span>Explore Urban Masterplan</span>
              <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Antioch featured showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white border border-navy/10 rounded-sm overflow-hidden shadow-institutional">
            <div className="lg:col-span-7 relative h-80 lg:h-auto min-h-[340px]">
              <Image
                src="/images/architecture_antioch.jpg"
                alt="Antioch Capital — Concentric Civic Architecture"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy/30 to-transparent" />
              <div className="absolute bottom-5 left-5 text-parchment">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gold block mb-1">Capital Precinct</span>
                <h4 className="text-xl font-bold">Antioch Central Ledger &amp; Diplomatic District</h4>
              </div>
            </div>
            <div className="lg:col-span-5 p-8 space-y-5 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <HexagonCross size={22} />
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-2xl font-bold text-navy">The Concentric Capital City</h3>
              <p className="text-sm text-navy/62 leading-relaxed">
                Antioch is engineered as the civic heart of Aletheia: six radial avenues
                connecting three concentric rings to a central hexagonal plaza housing the
                Assembly, the High Court, and state validator vaults.
              </p>
              <div className="space-y-2.5 pt-2 border-t border-navy/08">
                {[
                  { key: 'Radial Avenues', val: '6 Continental Axes' },
                  { key: 'Circumferential Rings', val: 'Ring I, II & III' },
                  { key: 'Geocoding Standard', val: 'APS-44 Hex Grid' },
                ].map(({ key, val }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-navy/55 font-medium">{key}</span>
                    <span className="font-mono text-navy font-semibold">{val}</span>
                  </div>
                ))}
              </div>
              <Link href="/development#antioch" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-shadow hover:text-navy transition-colors group">
                <span>Antioch Architectural Specs</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Four States */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { name: 'St. Barbara State', capital: 'Port Michael', quarter: 'Quarter I: Tower (Navy)', desc: 'Aerospace engineering, sovereign defence installations, and national cybersecurity operations.', accent: 'bg-navy', icon: Building2, iconBg: 'bg-navy/08 text-navy' },
              { name: 'Augustine State', capital: 'Port Luke', quarter: 'Quarter II: Book & Heart', desc: 'National University, medical faculties, biotechnology research, and family health center.', accent: 'bg-burgundy', icon: Landmark, iconBg: 'bg-burgundy/08 text-burgundy' },
              { name: 'Benedict State', capital: 'San José', quarter: 'Quarter III: Wheat & Sun', desc: 'Offshore clean wind, small modular nuclear reactors, desalination, agriculture, and manufacturing.', accent: 'bg-gold', icon: Zap, iconBg: 'bg-gold/10 text-gold-shadow' },
              { name: 'St. Brendan State', capital: 'Port Nicholas', quarter: 'Quarter IV: Caravel on Waves', desc: 'Deepwater commercial container port, naval docks, maritime freight logistics, and North Sea ferry link.', accent: 'bg-laurel', icon: Anchor, iconBg: 'bg-laurel/10 text-laurel' },
            ].map(({ name, capital, quarter, desc, accent, icon: Icon, iconBg }) => (
              <div key={name} className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col group">
                <div className={`h-[3px] w-full ${accent}`} />
                <div className="p-6 space-y-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-sm ${iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <StatusBadge status="Planned" size="sm" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif font-bold text-navy text-base">{name}</h3>
                    <span className="text-[11px] text-gold font-mono font-semibold uppercase tracking-wider block mt-0.5">{capital}</span>
                    <p className="text-xs text-navy/58 leading-relaxed mt-2 font-light">{desc}</p>
                  </div>
                  <div className="pt-3 border-t border-navy/08 text-[10px] font-mono text-gold font-bold uppercase tracking-wider">{quarter}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          6. CITIZENS & SOCIETY — MEMBERSHIP BY COVENANT
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-light section-xl border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-16 opacity-30" style={{ background: 'radial-gradient(circle, rgba(112,24,36,0.3) 0%, transparent 70%)' }} />
                <Image
                  src="/passport_cover.png"
                  alt="Aletheian ICAO TD3 eMRTD Passport — Covenant Burgundy"
                  width={300}
                  height={420}
                  className="object-contain relative z-10"
                  style={{ filter: 'drop-shadow(0 32px 56px rgba(0,0,0,0.32)) drop-shadow(0 6px 14px rgba(112,24,36,0.25))' }}
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-3">
                <div className="eyebrow">Part IV: Citizens &amp; Society</div>
                <h2 className="text-4xl font-bold tracking-tight text-navy leading-[1.15]">
                  Membership by Covenant:
                  <br />
                  <span className="text-navy/60 font-light">transparent standards for all.</span>
                </h2>
                <p className="text-navy/62 text-base leading-relaxed font-light max-w-xl">
                  Citizenship is not a commercial product. Aletheia maintains an unambiguous distinction
                  between digital e-residency, physical residency, and full sovereign citizenship.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Cpu, title: 'E-Residency', status: 'Under Development' as const, desc: 'Digital identity, 15-minute company formation, APN settlement account, remote contract execution. Conveys no physical residence or voting rights.' },
                  { icon: Users, title: 'Lawful Residence', status: 'Planned' as const, desc: '5-year renewable permit to live, work, and study in Aletheia with access to healthcare and education. Local municipal voting rights after 2 years.' },
                  { icon: Shield, title: 'Citizenship & Passport', status: 'Planned' as const, desc: 'Conferred by birth or naturalisation after 5 years PR, civic proficiency in English and one other official language, and the public Covenant Oath.' },
                ].map(({ icon: Icon, title, status, desc }) => (
                  <div key={title} className="sovereign-card-premium p-5 rounded-sm flex items-start gap-4 group">
                    <div className="p-2.5 bg-navy text-gold rounded-sm flex-shrink-0 mt-0.5 group-hover:bg-navy-subtle transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-sm font-bold text-navy">{title}</h4>
                        <StatusBadge status={status} size="sm" />
                      </div>
                      <p className="text-xs text-navy/62 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/citizenship" className="btn-sovereign-navy px-6 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider">
                  Citizenship Standards
                </Link>
                <Link href="/passport" className="px-6 py-3 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-parchment-canvas hover:border-navy/35 transition-all duration-200">
                  ICAO Passport Specification
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          7. FINANCIAL OPERATING SYSTEM — STABLECHAIN & AEY
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="guilloche-hero relative overflow-hidden section-xl border-b border-gold/25 text-parchment">
        <div className="orb-gold w-[480px] h-[480px] -top-32 left-10 opacity-50" />
        <div className="orb-burgundy w-[400px] h-[400px] -bottom-24 right-20 opacity-40" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-14">
          <div className="max-w-3xl space-y-4">
            <div className="eyebrow" style={{ color: '#E4C689' }}>Part V: The Financial Operating System</div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-parchment leading-[1.1]">
              Critical national payment
              <br />infrastructure, not a crypto
              <br /><span className="text-gold-metallic">experiment.</span>
            </h2>
            <p className="text-parchment/68 text-base leading-relaxed font-light max-w-2xl">
              Aletheia rejects volatile token speculation. The state operates StableChain: an
              enterprise-grade DAG ledger delivering 500 ms slot finality, real-time public
              reserve verification, and fixed micro-cent settlement fees.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { val: '500 ms', label: 'Block Slot Finality', desc: 'Transactions settle deterministically every 500ms across state-authorized validator clusters.' },
              { val: '100%', label: 'Provable AEY Reserve', desc: 'AEY is pegged 1:1 with EUR. Cryptographic balance sheet proofs published every epoch.' },
              { val: '0%', label: 'Personal Income Tax', desc: 'State revenue funded by land leasehold dividends, APN fees, and the Covenant Endowment.' },
              { val: 'APN Rail', label: 'Payment Network', desc: 'Instant merchant settlement connecting retail point-of-sale directly to SEPA and SWIFT gateways.' },
            ].map(({ val, label, desc }) => (
              <div key={label} className="dark-feature-card p-6 rounded-sm space-y-3">
                <div className="text-2xl font-extrabold text-gold-tint tracking-tight font-mono">{val}</div>
                <h3 className="text-sm font-bold text-parchment/95">{label}</h3>
                <p className="text-xs text-parchment/58 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="p-6 bg-navy/40 border border-gold/20 rounded-sm backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <Database className="w-5 h-5 text-gold flex-shrink-0" />
              <div>
                <span className="text-sm font-semibold text-parchment block">StableChain Core Specification v2.5</span>
                <span className="text-xs text-parchment/50">Available for engineering audit — full technical specification.</span>
              </div>
            </div>
            <Link href="/stablechain" className="btn-sovereign-gold px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 group shrink-0">
              <span>Explore StableChain</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          8. ADSS — DEFENCE & SECURITY
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-canvas section-xl border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="eyebrow">Part III: Security &amp; Resilience</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy">
                Aletheian Defence &amp;<br />Security Service (ADSS)
              </h2>
              <p className="text-navy/58 max-w-xl text-sm leading-relaxed font-light">
                A unified defence and civilian security institution operating under strict civilian
                command, with a mandatory sovereign Cybersecurity Department.
              </p>
            </div>
            <Link href="/adss" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group shrink-0">
              <span>View All Directorates</span>
              <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <Image src="/images/cyber_defence.jpg" alt="High-Assurance Cyber Defence Operations" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy/40 to-transparent" />
                <div className="absolute top-3 right-3"><StatusBadge status="Operational" size="sm" /></div>
                <div className="absolute bottom-3 left-4"><span className="text-[10px] font-mono text-gold uppercase tracking-wider">Core Mandate</span></div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div>
                  <h3 className="font-bold text-navy">Aletheian Cybersecurity Department</h3>
                  <span className="text-xs text-gold font-medium">National Cyber Defence &amp; Threat Ops</span>
                </div>
                <p className="text-xs text-navy/62 leading-relaxed flex-1">
                  Mandatory core national security agency protecting government networks, digital identity registries, StableChain validators, and critical maritime infrastructure.
                </p>
                <Link href="/adss/cybersecurity" className="text-xs font-bold text-navy hover:text-gold flex items-center gap-1 transition-colors group">
                  <span>Department Mandate &amp; Disclosure</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
              <div className="h-48 bg-gradient-to-br from-navy to-navy-deep flex items-center justify-center">
                <Shield className="w-14 h-14 text-gold/25" />
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-navy">Police Directorate</h3>
                    <span className="text-xs text-gold font-medium">Civilian Policing &amp; Public Safety</span>
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <p className="text-xs text-navy/62 leading-relaxed flex-1">
                  Civilian community law enforcement, criminal investigations, and municipal safety. Institutionally separate from military command structures.
                </p>
                <Link href="/adss#police" className="text-xs font-bold text-navy hover:text-gold flex items-center gap-1 transition-colors group">
                  <span>Civilian Policing Charter</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
              <div className="h-48 bg-gradient-to-br from-laurel-deep to-laurel flex items-center justify-center">
                <Globe className="w-14 h-14 text-parchment/20" />
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-navy">Immigration Directorate</h3>
                    <span className="text-xs text-gold font-medium">Border Administration &amp; Permits</span>
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <p className="text-xs text-navy/62 leading-relaxed flex-1">
                  Biometric entry/exit, residence card issuance, compliance verification, and integration with the secure Immigration Officer Workbench.
                </p>
                <Link href="/admin/immigration" className="text-xs font-bold text-gold-shadow hover:text-navy flex items-center gap-1 transition-colors group">
                  <span>Immigration Officer Workbench</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          9. PUBLIC RECORD — FINAL CTA BANNER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="cta-banner py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-3">
                <StarOfTruth size={18} />
                <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-gold">
                  Public Record &amp; Official Gazette
                </span>
              </div>
              <h3 className="text-3xl lg:text-4xl font-bold text-parchment leading-tight">
                Every public decree, statute,<br />and audit is openly published.
              </h3>
              <p className="text-parchment/60 text-sm leading-relaxed font-light">
                Explore the latest publications in the Official Gazette, read the full text of
                enacted protocols, or inspect the cryptographic integrity logs of the public ledger.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Link href="/documents" className="btn-sovereign-gold px-8 py-4 rounded-sm text-sm font-bold uppercase tracking-wider flex items-center gap-2 group">
                <FileText className="w-4 h-4" />
                <span>Official Gazette</span>
              </Link>
              <Link href="/transparency" className="btn-sovereign-ghost px-8 py-4 rounded-sm text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>Ledger Transparency</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
