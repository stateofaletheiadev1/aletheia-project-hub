'use client';

import React from 'react';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Anchor,
  Compass,
  Ship,
  Waves,
  ShieldCheck,
  FileCheck2,
  ArrowRight,
  CheckCircle2,
  Globe2,
  Radio,
  Building2,
} from 'lucide-react';

const MARITIME_DIVISIONS = [
  {
    title: 'Commercial Port Operations & Terminals',
    desc: 'Supervision of St. Brendan Deepwater Container Port, automated transshipment handling, bonded warehouses, and cold-chain logistics.',
    icon: Anchor,
  },
  {
    title: 'Sovereign Vessel Flagging & Registry',
    desc: 'Issuance of electronic certificates of registry, provisional flagging, IMO compliance tracking, and crew endorsement credentials.',
    icon: Ship,
  },
  {
    title: 'Oceanographic Stewardship & Marine Reserves',
    desc: 'Environmental monitoring of territorial sea zones, baseline pelagic ecosystem protection, and zero-discharge industrial compliance.',
    icon: Waves,
  },
  {
    title: 'Autonomous Navigation & Hydrography',
    desc: 'Real-time nautical chart publishing, automated radar vessel traffic management (VTS), and oceanic meteorological telemetry.',
    icon: Compass,
  },
];

export default function MinistryMaritimePage() {
  const { notify } = useToast();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="absolute inset-0">
          <Image
            src="/images/autonomous_harbor.jpg"
            alt="Maritime Port of Aletheia"
            fill
            className="object-cover opacity-20 mix-blend-luminosity"
            priority
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Executive Cabinet Portfolio</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">
              Ministry of Maritime Affairs & Trade
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              Administering the maritime sovereignty, autonomous deepwater port terminals, paperless vessel flagging, and pelagic environmental stewardship of the republic under the Law of the Sea.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/infrastructure"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >
                St. Brendan Port Blueprint <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/laws/maritime-zones"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                Maritime Zones Act
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY METRICS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">18.5 m</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Natural Deepwater Draft</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">200 NM</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Exclusive Economic Zone</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">0% Tax</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">International Tonnage Tax</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">IMO Compliant</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Electronic Vessel Registry</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MINISTERIAL DIVISIONS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Statutory Directorates</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">Executive Maritime Portfolios</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            Headquartered at the St. Brendan Port Authority Complex, managing commercial trade and oceanic environmental resilience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {MARITIME_DIVISIONS.map((div, idx) => (
            <div
              key={idx}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center shrink-0">
                  <div.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-navy">{div.title}</h3>
              </div>
              <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{div.desc}</p>
            </div>
          ))}
        </div>

        {/* ── VESSEL FLAGGING PORTAL BANNER ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3">
            <span className="text-xs font-bold text-gold uppercase tracking-wider block">
              Flag State Administration
            </span>
            <h3 className="text-2xl font-bold text-navy">Flag Your Vessel with the Republic of Aletheia</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Paperless 24-hour flagging for merchant ships, yachts, and research vessels. Enjoy zero tonnage tax, full compliance with international maritime labor conventions (MLC 2006), and autonomous digital vessel certification.
            </p>
          </div>

          <div className="lg:col-span-4 flex justify-end">
            <button
              onClick={() => notify('Vessel registration enquiries', 'Submit digital IMO documentation to flag.registry@aletheia.gov. The online flag registry opens with the maritime administration.', 'info')}
              className="px-6 py-3 bg-navy text-gold font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-2"
            >
              Begin Flagging Application <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            A Maritime Republic Governed by Covenant
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Discover the full territorial masterplan and oceanic infrastructure engineering of Aletheia.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/development"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Territories & Masterplan
            </Link>
            <Link
              href="/government"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              All Ministries
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
