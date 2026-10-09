'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import { NationalFlag } from '@/components/brand/Flags';
import { unsplash, type PhotoKey } from '@/lib/imagery';
import { GAZETTE_POSTS, formatGazetteDate } from '@/lib/gazette';
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
} from 'lucide-react';

const FOCUS: { href: string; title: string; kicker: string; desc?: string; image: PhotoKey; span: string; big?: boolean }[] = [
  { href: '/infrastructure', title: 'A maritime nation', kicker: 'Ports & the North Sea', desc: 'A deepwater terminal at Port Nicholas and the sea lanes that connect Aletheia to Europe and the world.', image: 'containerShip', span: 'md:col-span-2 md:row-span-2', big: true },
  { href: '/energy', title: 'Sovereign clean energy', kicker: 'Benedict State', image: 'offshoreWind', span: 'md:col-span-1' },
  { href: '/education', title: 'Schools & university', kicker: 'Augustine State', image: 'libraryAisle', span: 'md:col-span-1' },
  { href: '/healthcare', title: 'Covenant healthcare', kicker: 'Health & Social Care', image: 'clinician', span: 'md:col-span-1' },
  { href: '/stablechain', title: 'The digital state', kicker: 'StableChain & Registries', image: 'earthNight', span: 'md:col-span-1' },
];

export default function HomePage() {
  const { t, tx, intl } = useI18n();
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
        <div className="absolute inset-0 pointer-events-none animate-ken-burns" aria-hidden="true">
          <Image
            src={unsplash('oceanWave', 2200)}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center opacity-40"
            priority
          />
        </div>

        {/* Deep gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#060C14]/92 via-[#0E1B31]/72 to-[#090F1A]/85 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#060C14] to-transparent pointer-events-none" />

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
                  <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-gold">{t("Sovereign Covenant State")}</span>
                  <span className="text-parchment/25">│</span>
                  <span className="text-[11px] text-parchment/70 font-serif italic">{t("Veritas in Foedere")}</span>
                </div>
              </div>

              {/* Hero headline */}
              <h1 className="heading-hero animate-fade-in-up delay-100">{t("Building a new standard")}<br />{t("for life, technology")}{' '}
                <span className="text-gold-metallic">{t("& civic")}</span>
                <br />
                <span className="text-gold-metallic">{t("infrastructure.")}</span>
              </h1>

              {/* Sub-headline */}
              <p className="text-lg text-parchment/72 leading-[1.85] max-w-xl font-light animate-fade-in-up delay-200">{t("Aletheia is a compact, high-efficiency European-oriented maritime nation. Proof is the default, not the exception — public records are immutable, currency backing is provable in real-time, and government spending leaves an auditable receipt.")}</p>

              {/* Status row */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] animate-fade-in-up delay-300">
                <span className="font-bold tracking-[0.14em] uppercase text-gold/80">{t("Platform Status:")}</span>
                <StatusBadge status="Under Development" size="sm" />
                <span className="text-parchment/25">•</span>
                <span className="text-parchment/60">{t("Edition 2026.3 National Blueprint")}</span>
                <span className="text-parchment/25">•</span>
                <span className="font-mono text-gold-tint/80">{t("stateofaletheia.org")}</span>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-4 animate-fade-in-up delay-400">
                <Link
                  href="/constitution"
                  className="btn-sovereign-gold px-8 py-4 rounded-sm flex items-center gap-3 group text-sm"
                >
                  <span>{t("Explore the Constitution")}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
                <Link
                  href="/e-residency"
                  className="btn-sovereign-navy px-7 py-4 rounded-sm flex items-center gap-2.5 text-sm"
                >
                  <span>{t("Apply for E-Residency")}</span>
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
                    {tx(label)}
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
                      alt={t("Coat of Arms of the Sovereign Covenant State of Aletheia")}
                      width={148}
                      height={175}
                      className="object-contain mx-auto drop-shadow-2xl"
                      priority
                    />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-parchment/95">{t("The Sovereign Covenant State")}</h2>
                    <p className="text-[11px] text-gold tracking-[0.18em] uppercase font-semibold mt-1.5">{t("Veritas in Foedere · Truth in Covenant")}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-parchment/10">
                    {[
                      { label: 'Territorial Entity', value: 'Antioch & 4 States' },
                      { label: 'Constitutional Law', value: '67 Articles Capped' },
                      { label: 'Executive Cabinet', value: 'Nine Ministries Max' },
                      { label: 'Sovereign Ledger', value: '≈ 1 s Finality' },
                    ].map(({ label, value }) => (
                      <div key={label} className="stat-tile p-3 rounded-sm text-left space-y-1">
                        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{tx(label)}</span>
                        <span className="text-xs font-semibold text-parchment leading-tight block">{tx(value)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <NationalFlag width={42} height={28} />
                    <div className="h-4 w-px bg-gold/20" />
                    <span className="text-[10px] text-gold/60 tracking-widest uppercase font-medium">{t("Sovereign Covenant State")}</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x divide-gold/15 gap-y-2">
            {[
              { value: '100%', label: 'Reserve Backing', sub: 'AEY · EUR Parity', status: 'Operational' as const },
              { value: '1:1', label: 'AEY / EUR Peg', sub: 'Fixed, on-chain', status: 'Operational' as const },
              { value: '≈ 1 s', label: 'Ledger Finality', sub: 'Two 500 ms slots', status: 'Under Development' as const },
              { value: '0%', label: 'Personal Income Tax', sub: 'By constitutional decree', status: 'Operational' as const },
            ].map(({ value, label, sub, status }) => (
              <div key={label} className="py-6 px-6 text-center space-y-1.5">
                <div className="big-stat-value">{tx(value)}</div>
                <div className="text-xs font-semibold text-parchment/90">{tx(label)}</div>
                <div className="text-[10px] text-parchment/40 tracking-wide">{tx(sub)}</div>
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
            <div className="eyebrow mb-4">{t("Civic Legitimacy & Truth in Representation")}</div>
            <h2 className="text-4xl font-bold text-navy tracking-tight leading-[1.15] mb-4">{t("National Architecture")}<br />{t("Status at a Glance")}</h2>
            <p className="text-navy/60 text-base leading-relaxed font-light">{t("Aletheia never presents future aspiration as established physical fact. Every national asset carries an explicit, binding status certified by sovereign covenant.")}</p>
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
                desc: 'Byzantine-fault-tolerant ledger with 500 ms slots, AEY reserve backing invariants, and fixed-fee settlement rails operating on the sovereign closed mainnet.',
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
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-navy/30">{tx(num)}</span>
                    <StatusBadge status={status} size="sm" className="shrink-0" />
                  </div>
                  <h3 className="text-sm font-bold text-navy uppercase tracking-wide leading-tight">{tx(title)}</h3>
                  <p className="text-sm text-navy/60 leading-relaxed font-light">{tx(desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3b. THE SOVEREIGN COVENANT STATE IN FOCUS — PHOTOGRAPHIC BENTO
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-light section-lg border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="eyebrow">{t("The Sovereign Covenant State in Focus")}</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-navy leading-[1.1]">{t("Five foundations of a")}<br /><span className="text-gold-metallic">{t("covenant nation.")}</span>
              </h2>
            </div>
            <p className="text-navy/60 max-w-md text-sm leading-relaxed font-light">{t("Sea, energy, learning, care and the digital state: the systems Aletheia is building so that a free people can flourish.")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-5 md:h-[640px]">
            {FOCUS.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className={'photo-card group relative min-h-[260px] rounded-sm border border-gold/20 shadow-institutional ' + f.span}
              >
                <Image src={unsplash(f.image, f.big ? 1400 : 800)} alt="" fill sizes={f.big ? '(min-width:768px) 50vw, 100vw' : '(min-width:768px) 25vw, 100vw'} className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060C14]/95 via-[#0E1B31]/35 to-transparent" />
                <div className="photo-card-body absolute inset-x-0 bottom-0 p-6 text-parchment space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-tint">{tx(f.kicker)}</span>
                  <h3 className={(f.big ? 'text-3xl' : 'text-xl') + ' font-bold leading-tight flex items-center gap-2'}>
                    {tx(f.title)}
                    <ArrowRight className="w-4 h-4 text-gold opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </h3>
                  {tx(f.big && <p className="text-sm text-parchment/70 max-w-md font-light">{tx(f.desc)}</p>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          4. THE COVENANT — EDITORIAL NARRATIVE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-light section-xl border-b border-navy/08 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">

            <div className="lg:col-span-6 space-y-8">
              <div className="space-y-3">
                <div className="eyebrow">{t("Part I: The Covenant")}</div>
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-navy leading-[1.12]">{t("Truth unhidden: why Aletheia")}<br />{t("builds upon a")}{' '}
                  <em className="not-italic text-gold">{t("provable ledger.")}</em>
                </h2>
              </div>

              <div className="space-y-5 text-navy/72 text-base leading-[1.88] font-light">
                <p>{t("Most friction in modern governance — bureaucratic queues, lost deeds, delayed payments, opaque ministerial budgets, and disputed elections — stems from systems that cannot prove what they say.")}</p>
                <p>{t("Aletheia replaces bureaucratic friction with deterministic cryptography. Land titles, business registrations, identity credentials, and public finance receipts are settled once onto the sovereign ledger with cryptographic Merkle proofs against finalized blocks.")}{' '}<strong className="text-navy font-semibold">{t("Proof is the baseline guarantee.")}</strong>
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
                      <span className="text-xs font-bold text-navy uppercase tracking-wider">{tx(title)}</span>
                    </div>
                    <p className="text-xs text-navy/58 leading-relaxed">{tx(desc)}</p>
                  </div>
                ))}
              </div>

              <Link href="/constitution" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
                <span>{t("Read The Constitutional Covenant")}</span>
                <ChevronRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="lg:col-span-6 space-y-5">
              <div className="photo-card relative h-72 sm:h-80 rounded-sm overflow-hidden border border-gold/20 shadow-elevated gold-glow">
                <Image
                  src={unsplash('chamber', 1200)}
                  alt={t("A semicircular parliamentary chamber")}
                  fill
                  sizes="(min-width:1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/95 via-navy/30 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-parchment space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">{t("Covenant Assembly Hall")}</span>
                    <span className="text-[11px] font-mono text-parchment/55">{t("61 Seats")}</span>
                  </div>
                  <p className="text-xs text-parchment/75 font-light">{t("Representation elected by open-list PR across Antioch and the four constituent states.")}</p>
                </div>
              </div>

              <div className="bg-navy-deep p-6 text-parchment rounded-sm border border-gold/25 shadow-elevated gold-glow space-y-4">
                <div className="flex items-center justify-between border-b border-parchment/10 pb-3">
                  <span className="text-[11px] font-bold tracking-[0.20em] uppercase text-gold">{t("Four Constitutional Pillars")}</span>
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
                      <span className="text-gold font-bold text-xs block mb-0.5">{tx(roman)} {tx(branch)}</span>
                      <span className="text-parchment/65 text-[11px]">{tx(body)}</span>
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
              <div className="eyebrow">{t("Part II: The Territory")}</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("Antioch & The Four")}<br />{t("Founding States")}</h2>
              <p className="text-navy/60 max-w-xl text-base leading-relaxed font-light">{t("A geometric urban master plan radiating outward across concentric rings and six grand avenues, flanked by four specialized coastal and maritime states.")}</p>
            </div>
            <Link href="/development" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors shrink-0 group">
              <span>{t("Explore Urban Masterplan")}</span>
              <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Antioch featured showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white border border-navy/10 rounded-sm overflow-hidden shadow-institutional">
            <div className="lg:col-span-7 relative h-80 lg:h-auto min-h-[340px]">
              <Image
                src="/images/architecture_antioch.jpg"
                alt={t("Antioch Capital — Concentric Civic Architecture")}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy/30 to-transparent" />
              <div className="absolute bottom-5 left-5 text-parchment">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gold block mb-1">{t("Capital Precinct")}</span>
                <h4 className="text-xl font-bold">{t("Antioch Central Ledger & Diplomatic District")}</h4>
              </div>
            </div>
            <div className="lg:col-span-5 p-8 space-y-5 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <HexagonCross size={22} />
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-2xl font-bold text-navy">{t("The Concentric Capital City")}</h3>
              <p className="text-sm text-navy/62 leading-relaxed">{t("Antioch is engineered as the civic heart of Aletheia: six radial avenues connecting three concentric rings to a central hexagonal plaza housing the Assembly, the High Court, and state validator vaults.")}</p>
              <div className="space-y-2.5 pt-2 border-t border-navy/08">
                {[
                  { label: 'Radial Avenues', val: '6 Continental Axes' },
                  { label: 'Circumferential Rings', val: 'Ring I, II & III' },
                  { label: 'Geocoding Standard', val: 'APS-44 Hex Grid' },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-navy/55 font-medium">{tx(label)}</span>
                    <span className="font-mono text-navy font-semibold">{tx(val)}</span>
                  </div>
                ))}
              </div>
              <Link href="/development#antioch" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-shadow hover:text-navy transition-colors group">
                <span>{t("Antioch Architectural Specs")}</span>
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
                    <h3 className="font-serif font-bold text-navy text-base">{tx(name)}</h3>
                    <span className="text-[11px] text-gold font-mono font-semibold uppercase tracking-wider block mt-0.5">{tx(capital)}</span>
                    <p className="text-xs text-navy/58 leading-relaxed mt-2 font-light">{tx(desc)}</p>
                  </div>
                  <div className="pt-3 border-t border-navy/08 text-[10px] font-mono text-gold font-bold uppercase tracking-wider">{tx(quarter)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          6. CITIZENS & SOCIETY — MEMBERSHIP BY COVENANT
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-light section-xl border-b border-navy/08 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-16 opacity-30" style={{ background: 'radial-gradient(circle, rgba(112,24,36,0.3) 0%, transparent 70%)' }} />
                <Image
                  src="/passport_cover.png"
                  alt={t("Aletheian ICAO TD3 eMRTD Passport — Covenant Burgundy")}
                  width={300}
                  height={420}
                  className="object-contain relative z-10"
                  style={{ filter: 'drop-shadow(0 32px 56px rgba(0,0,0,0.32)) drop-shadow(0 6px 14px rgba(112,24,36,0.25))' }}
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-3">
                <div className="eyebrow">{t("Part IV: Citizens & Society")}</div>
                <h2 className="text-4xl font-bold tracking-tight text-navy leading-[1.15]">{t("Membership by Covenant:")}<br />
                  <span className="text-navy/60 font-light">{t("transparent standards for all.")}</span>
                </h2>
                <p className="text-navy/62 text-base leading-relaxed font-light max-w-xl">{t("Citizenship is a covenant, never an auction. Aletheia keeps a clear distinction between digital e-residency, physical residency, and full citizenship — earned by residence or by investing in the Sovereign Covenant State, and always sealed by the Covenant Oath.")}</p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Cpu, title: 'E-Residency', status: 'Under Development' as const, desc: 'Digital identity, 15-minute company formation, APN settlement account, remote contract execution. Conveys no physical residence or voting rights.' },
                  { icon: Users, title: 'Lawful Residence', status: 'Planned' as const, desc: '5-year renewable permit to live, work, and study in Aletheia with access to healthcare and education. Local municipal voting rights after 2 years.' },
                  { icon: Shield, title: 'Citizenship & Passport', status: 'Planned' as const, desc: 'Conferred by birth, by naturalisation after 5 years of residence, or through the Covenant Investor route — always with due diligence and the public Covenant Oath.' },
                ].map(({ icon: Icon, title, status, desc }) => (
                  <div key={title} className="sovereign-card-premium p-5 rounded-sm flex items-start gap-4 group">
                    <div className="p-2.5 bg-navy text-gold rounded-sm flex-shrink-0 mt-0.5 group-hover:bg-navy-subtle transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-sm font-bold text-navy">{tx(title)}</h4>
                        <StatusBadge status={status} size="sm" />
                      </div>
                      <p className="text-xs text-navy/62 leading-relaxed">{tx(desc)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/citizenship/apply" className="btn-sovereign-navy px-6 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider">{t("Apply for Citizenship")}</Link>
                <Link href="/passport" className="px-6 py-3 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-parchment-canvas hover:border-navy/35 transition-all duration-200">{t("ICAO Passport Specification")}</Link>
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
            <div className="eyebrow" style={{ color: '#E4C689' }}>{t("Part V: The Financial Operating System")}</div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-parchment leading-[1.1]">{t("Critical national payment")}<br />{t("infrastructure, not a crypto")}<br /><span className="text-gold-metallic">{t("experiment.")}</span>
            </h2>
            <p className="text-parchment/68 text-base leading-relaxed font-light max-w-2xl">{t("Aletheia rejects volatile token speculation. The state operates StableChain: a Byzantine-fault-tolerant ledger with 500 ms slots and finality in about a second, real-time public reserve verification, and fixed settlement fees.")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { val: '500 ms', label: 'Block Slot', desc: 'A block every 500 ms, final two slots later, across state-authorised validator clusters.' },
              { val: '100%', label: 'Provable AEY Reserve', desc: 'AEY is pegged 1:1 with EUR. Cryptographic balance sheet proofs published every epoch.' },
              { val: '0%', label: 'Personal Income Tax', desc: 'State revenue funded by land leasehold dividends, APN fees, and the Covenant Endowment.' },
              { val: 'APN Rail', label: 'Payment Network', desc: 'Instant merchant settlement connecting retail point-of-sale directly to SEPA and SWIFT gateways.' },
            ].map(({ val, label, desc }) => (
              <div key={label} className="dark-feature-card p-6 rounded-sm space-y-3">
                <div className="text-2xl font-extrabold text-gold-tint tracking-tight font-mono">{tx(val)}</div>
                <h3 className="text-sm font-bold text-parchment/95">{tx(label)}</h3>
                <p className="text-xs text-parchment/58 leading-relaxed">{tx(desc)}</p>
              </div>
            ))}
          </div>

          <div className="p-6 bg-navy/40 border border-gold/20 rounded-sm backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <Database className="w-5 h-5 text-gold flex-shrink-0" />
              <div>
                <span className="text-sm font-semibold text-parchment block">{t("StableChain Core Specification v2.5")}</span>
                <span className="text-xs text-parchment/50">{t("Available for engineering audit — full technical specification.")}</span>
              </div>
            </div>
            <Link href="/stablechain" className="btn-sovereign-gold px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 group shrink-0">
              <span>{t("Explore StableChain")}</span>
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
              <div className="eyebrow">{t("Part III: Security & Resilience")}</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy">{t("Aletheian Defence &")}<br />{t("Security Service (ADSS)")}</h2>
              <p className="text-navy/58 max-w-xl text-sm leading-relaxed font-light">{t("A unified defence and civilian security institution operating under strict civilian command, with a mandatory sovereign Cybersecurity Department.")}</p>
            </div>
            <Link href="/adss" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group shrink-0">
              <span>{t("View All Directorates")}</span>
              <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="photo-card sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <Image src="/images/cyber_defence.jpg" alt={t("High-Assurance Cyber Defence Operations")} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy/40 to-transparent" />
                <div className="absolute top-3 right-3"><StatusBadge status="Operational" size="sm" /></div>
                <div className="absolute bottom-3 left-4"><span className="text-[10px] font-mono text-gold uppercase tracking-wider">{t("Core Mandate")}</span></div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div>
                  <h3 className="font-bold text-navy">{t("Aletheian Cybersecurity Department")}</h3>
                  <span className="text-xs text-gold font-medium">{t("National Cyber Defence & Threat Ops")}</span>
                </div>
                <p className="text-xs text-navy/62 leading-relaxed flex-1">{t("Mandatory core national security agency protecting government networks, digital identity registries, StableChain validators, and critical maritime infrastructure.")}</p>
                <Link href="/adss/cybersecurity" className="text-xs font-bold text-navy hover:text-gold flex items-center gap-1 transition-colors group">
                  <span>{t("Department Mandate & Disclosure")}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="photo-card sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <Image src={unsplash('europeanTown', 800)} alt={t("A quiet European town street at dusk")} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy/30 to-transparent" />
                <div className="absolute bottom-3 left-4"><span className="text-[10px] font-mono text-gold uppercase tracking-wider">{t("Civilian Command")}</span></div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-navy">{t("Police Directorate")}</h3>
                    <span className="text-xs text-gold font-medium">{t("Civilian Policing & Public Safety")}</span>
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <p className="text-xs text-navy/62 leading-relaxed flex-1">{t("Civilian community law enforcement, criminal investigations, and municipal safety. Institutionally separate from military command structures.")}</p>
                <Link href="/adss#police" className="text-xs font-bold text-navy hover:text-gold flex items-center gap-1 transition-colors group">
                  <span>{t("Civilian Policing Charter")}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="photo-card sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <Image src={unsplash('flight', 800)} alt={t("Aircraft wing above the clouds")} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy/30 to-transparent" />
                <div className="absolute bottom-3 left-4"><span className="text-[10px] font-mono text-gold uppercase tracking-wider">{t("Paperless Borders")}</span></div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-navy">{t("Immigration Directorate")}</h3>
                    <span className="text-xs text-gold font-medium">{t("Border Administration & Permits")}</span>
                  </div>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <p className="text-xs text-navy/62 leading-relaxed flex-1">{t("Biometric entry/exit, residence card issuance, compliance verification, and integration with the secure Immigration Officer Workbench.")}</p>
                <Link href="/admin/immigration" className="text-xs font-bold text-gold-shadow hover:text-navy flex items-center gap-1 transition-colors group">
                  <span>{t("Immigration Officer Workbench")}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          8b. LATEST FROM THE OFFICIAL GAZETTE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-parchment-light section-lg border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-3">
              <div className="eyebrow">{t("Official Gazette")}</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy">{t("Latest dispatches")}</h2>
            </div>
            <Link href="/news" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group shrink-0">
              <span>{t("All bulletins")}</span>
              <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {GAZETTE_POSTS.slice(0, 3).map((post) => (
              <Link key={post.slug} href={'/news/' + post.slug} className="photo-card group sovereign-card-premium rounded-sm flex flex-col">
                <div className="relative h-48">
                  <Image src={unsplash(post.image, 800)} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/75 to-transparent" />
                  <span className="absolute bottom-3 left-4 px-2 py-0.5 bg-navy-deep/80 backdrop-blur-sm text-parchment font-mono text-[10px] font-bold rounded-sm border border-gold/30">{tx(post.number)}</span>
                </div>
                <div className="photo-card-body p-6 space-y-2 flex-1 flex flex-col">
                  <span className="text-[10px] font-bold text-gold-shadow uppercase tracking-[0.16em]">{tx(post.category)}</span>
                  <h3 className="text-lg font-bold text-navy leading-snug group-hover:text-gold-shadow transition-colors flex-1">{tx(post.title)}</h3>
                  <span className="text-[11px] font-mono text-navy/50">{formatGazetteDate(post.date, intl)}</span>
                </div>
              </Link>
            ))}
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
                <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-gold">{t("Public Record & Official Gazette")}</span>
              </div>
              <h3 className="text-3xl lg:text-4xl font-bold text-parchment leading-tight">{t("Every public decree, statute,")}<br />{t("and audit is openly published.")}</h3>
              <p className="text-parchment/60 text-sm leading-relaxed font-light">{t("Explore the latest publications in the Official Gazette, read the full text of enacted protocols, or inspect the cryptographic integrity logs of the public ledger.")}</p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Link href="/documents" className="btn-sovereign-gold px-8 py-4 rounded-sm text-sm font-bold uppercase tracking-wider flex items-center gap-2 group">
                <FileText className="w-4 h-4" />
                <span>{t("Official Gazette")}</span>
              </Link>
              <Link href="/transparency" className="btn-sovereign-ghost px-8 py-4 rounded-sm text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>{t("Ledger Transparency")}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
