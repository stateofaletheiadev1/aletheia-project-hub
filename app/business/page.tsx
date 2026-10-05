'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Building2,
  Clock,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Coins,
  FileCheck,
  ChevronRight,
  Globe2,
  Zap,
} from 'lucide-react';

const ENTITY_TYPES = [
  {
    id: 'sarl',
    name: 'Aletheia Private Limited (Ltd / SARL)',
    idealFor: 'Tech startups, digital consultancies, e-commerce, and software ventures.',
    fee: '200 AEY / year',
    time: '15 Minutes',
    features: [
      '1 to 50 shareholders',
      'No minimum paid-up share capital requirement',
      'Remote digital contract and governance execution',
      'Zero corporate income tax and zero capital gains tax',
      'Automated digital corporate seal and cryptographic charter',
    ],
  },
  {
    id: 'corp',
    name: 'Sovereign Joint Stock Corporation (Corp / SA)',
    idealFor: 'Enterprises issuing public shares, maritime shipping lines, and industrial funds.',
    fee: '600 AEY / year',
    time: '24 Hours',
    features: [
      'Unlimited domestic and international shareholders',
      'Bearer shares and tokenized on-chain share registers supported',
      'Covenant Assembly statutory board of directors structure',
      'Direct listing eligibility on the Antioch Exchange',
      'Multi-currency balance sheet reporting in AEY, USD, and major reserve currencies',
    ],
  },
  {
    id: 'foundation',
    name: 'Covenant Foundation & Trust',
    idealFor: 'Family offices, asset protection, non-profit endowments, and IP holding.',
    fee: '450 AEY / year',
    time: '2 Business Days',
    features: [
      'Perpetual legal succession independent of founders',
      'Strict statutory privacy and fiduciary protection',
      'Immunity from foreign ex-post extraterritorial claims',
      'Dedicated council and guardian oversight options',
      'Full cryptographic vault custody integration',
    ],
  },
];

export default function BusinessPage() {
  const [selectedEntity, setSelectedEntity] = useState('sarl');

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="relative guilloche-bg text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-36 border-b border-gold/30">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 border border-gold/40 bg-navy-deep/90 rounded-sm gold-glow">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Ministry of Finance &amp; Commerce</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">
              Form a Sovereign Enterprise in <span className="text-gold-metallic">15 Minutes</span>
            </h1>

            <p className="text-base sm:text-lg text-parchment/80 leading-relaxed font-light max-w-2xl">
              Zero corporate tax, no bureaucratic delays, and instant European banking access. Aletheia provides the world&apos;s most agile, paperless corporate jurisdiction backed by English commercial law principles and cryptographic state registries.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/e-residency"
                className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group"
              >
                <span>Start Incorporation</span>
                <ArrowRight className="w-4 h-4 text-navy group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/economy"
                className="btn-sovereign-navy px-6 py-3.5 rounded-sm flex items-center gap-2"
              >
                Monetary System &amp; AEY
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY ADVANTAGES ── */}
      <section className="bg-navy-deep border-b border-gold/20 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">0%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Corporate Income Tax</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">15 Min</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Digital Incorporation</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Remote Operation</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">SEPA</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">&amp; APN Settlement Rails</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORPORATE FORMS DIRECTORY ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Statutory Entities</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight">Choose Your Enterprise Structure</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            All legal entities are created pursuant to the Aletheia Companies Act 2026 and registered on the immutable corporate state registry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ENTITY_TYPES.map((entity) => (
            <div
              key={entity.id}
              className={`sovereign-card rounded-sm p-7 flex flex-col justify-between transition-all bg-white relative overflow-hidden group ${
                selectedEntity === entity.id
                  ? 'border-gold shadow-xl ring-1 ring-gold/40'
                  : 'border-navy/15 hover:border-gold/50'
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-5">
                <div className="flex justify-between items-start">
                  <div className={`p-2.5 rounded-sm ${selectedEntity === entity.id ? 'bg-gold/15 text-gold-shadow' : 'bg-navy/5 text-navy group-hover:text-gold-shadow transition-colors'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 bg-parchment-canvas border border-navy/10 rounded-sm text-[10px] font-mono text-navy font-bold">
                    {entity.time}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-navy">{entity.name}</h3>
                  <p className="text-xs text-navy/70 leading-relaxed mt-1 font-light">{entity.idealFor}</p>
                </div>

                <div className="py-3.5 border-y border-navy/10 flex items-baseline justify-between bg-parchment-canvas/50 px-3 -mx-3 rounded-sm">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-navy/50 block font-semibold">Annual Maintenance Fee</span>
                    <span className="text-xl font-bold font-mono text-navy tracking-tight">{entity.fee}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gold font-mono uppercase px-2 py-0.5 border border-gold/30 bg-gold/10 rounded-sm">
                    AEY Tender
                  </span>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Statutory Privileges:
                  </span>
                  <ul className="space-y-2 text-xs text-navy/70 font-light">
                    {entity.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-navy/10">
                <Link
                  href="/e-residency"
                  className="btn-sovereign-navy w-full py-3 rounded-sm text-center block transition-all"
                >
                  Incorporate Entity
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4-STEP FORMATION PROCESS ── */}
      <section className="py-16 bg-parchment-light border-y border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Seamless Onboarding</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">Four Simple Steps to Operation</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                01
              </span>
              <h4 className="text-sm font-bold text-navy">Obtain E-Residency</h4>
              <p className="text-xs text-navy/70 leading-relaxed">
                Complete digital identity verification and receive your cryptographic state credential.
              </p>
            </div>

            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                02
              </span>
              <h4 className="text-sm font-bold text-navy">Name & Structure</h4>
              <p className="text-xs text-navy/70 leading-relaxed">
                Check commercial name availability and configure shareholder distribution online.
              </p>
            </div>

            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                03
              </span>
              <h4 className="text-sm font-bold text-navy">Digital Signature</h4>
              <p className="text-xs text-navy/70 leading-relaxed">
                Sign constitutional articles of incorporation using your Aletheia cryptographic key.
              </p>
            </div>

            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                04
              </span>
              <h4 className="text-sm font-bold text-navy">Registry Inscription</h4>
              <p className="text-xs text-navy/70 leading-relaxed">
                Charter is registered on-chain; corporate IBAN and EU VAT clearance issued instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            Start Your Enterprise in Aletheia Today
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Join international founders taking advantage of 0% tax, zero personal liability friction, and cryptographic legal certainty.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/e-residency"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Apply for E-Residency
            </Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Enterprise Consultation
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
