'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ArrowRight, Building2, Zap, Anchor, Globe, Cpu, TreePine, CheckCircle } from 'lucide-react';

const DISTRICTS = [
  {
    id: 'civic',
    name: 'Civic Core',
    ring: 'Ring 0 — Central',
    desc: 'The Constitutional Plaza, Covenant Assembly Hall, High Court, and Chancellor\'s Residence. Public space designed around the Star of Truth motif.',
    icon: <Building2 className="w-5 h-5 text-gold" />,
    status: 'Planned' as const,
  },
  {
    id: 'financial',
    name: 'Financial Quarter',
    ring: 'Ring 1 — Inner',
    desc: 'Aletheia Digital Bank, StableChain Validator Cluster, Treasury Building, and licensed financial institutions.',
    icon: <Cpu className="w-5 h-5 text-gold" />,
    status: 'Planned' as const,
  },
  {
    id: 'maritime',
    name: 'Maritime & Port District',
    ring: 'Ring 2 — Coastal',
    desc: 'Deep-water port, Coast Guard headquarters, customs and immigration facilities, and the free-trade processing zone.',
    icon: <Anchor className="w-5 h-5 text-gold" />,
    status: 'Planned' as const,
  },
  {
    id: 'energy',
    name: 'Energy & Industrial Zone',
    ring: 'Ring 3 — Perimeter',
    desc: 'Offshore wind substation, SMR nuclear facility, hydrogen production plant, and desalination infrastructure.',
    icon: <Zap className="w-5 h-5 text-gold" />,
    status: 'Planned' as const,
  },
  {
    id: 'residential',
    name: 'Residential Cantons',
    ring: 'Rings 1–2 — Interspersed',
    desc: 'Four residential cantons integrated between civic and commercial zones. High-density mixed-use with mandatory green coverage.',
    icon: <TreePine className="w-5 h-5 text-gold" />,
    status: 'Planned' as const,
  },
  {
    id: 'international',
    name: 'International District',
    ring: 'Ring 2 — North Sector',
    desc: 'Embassy row, international trade mission offices, ICAO-compliant airport terminal, and conference facilities.',
    icon: <Globe className="w-5 h-5 text-gold" />,
    status: 'Planned' as const,
  },
];

const PRINCIPLES = [
  { label: 'Six Radial Avenues', desc: 'Emanating from the Constitutional Plaza, each named after a founding covenant principle.' },
  { label: 'Hexagonal Block Grid', desc: 'Consistent with the Star of Truth motif — efficiency, symmetry, and civic legibility.' },
  { label: 'Ledger-First Infrastructure', desc: 'All land titles, building permits, and utility connections recorded immutably on StableChain.' },
  { label: '40% Green Coverage', desc: 'Constitutional mandate on all residential and civic zones. No development without arboricultural offset.' },
  { label: 'Underground Utility Spine', desc: 'All power, water, fibre, and waste systems routed below-grade to protect the street-level civic aesthetic.' },
  { label: 'Walkable 15-Minute City', desc: 'Every residence within 15 minutes walk of employment, education, healthcare, and transit.' },
];

export default function DevelopmentPage() {
  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="relative bg-navy text-parchment overflow-hidden pt-20 pb-28 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0">
          {/* Hexagonal grid watermark */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
            <defs>
              <pattern id="dev-hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
                <polygon points="30,2 54,16 54,44 30,58 6,44 6,16" fill="none" stroke="#C49A4E" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dev-hex)"/>
          </svg>
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/60 rounded-[3px]">
                <StarOfTruth size={14} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">Territorial Development</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">
              Antioch — the capital city of Aletheia.
            </h1>

            <p className="text-base sm:text-lg text-parchment/65 leading-relaxed font-light max-w-2xl">
              Designed from first principles as a concentric, hexagonal city with six radial avenues, a constitutional civic core, and every infrastructure system anchored to the StableChain ledger. A 15-minute city for the covenant generation.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="#masterplan" className="px-5 py-2.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors flex items-center gap-2 group">
                View Masterplan <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/economy#infrastructure" className="px-5 py-2.5 border border-gold/25 text-parchment font-semibold text-[12px] uppercase tracking-wider rounded-[3px] hover:border-gold/50 transition-colors">
                Infrastructure Bonds
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'City Design', value: 'Concentric', sub: '6 radial avenues' },
              { label: 'Block Grid', value: 'Hexagonal', sub: 'Star of Truth motif' },
              { label: 'Green Coverage', value: '40%', sub: 'Constitutional mandate' },
              { label: 'Land Registry', value: 'On-Ledger', sub: 'StableChain immutable' },
            ].map((s) => (
              <div key={s.label} className="bg-navy-deep/80 border border-gold/15 rounded-[4px] p-4">
                <span className="text-[10px] uppercase tracking-[0.16em] text-parchment/40 font-semibold block mb-1">{s.label}</span>
                <span className="text-xl font-bold text-parchment">{s.value}</span>
                <span className="text-[10px] text-parchment/30 block mt-1">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESIGN PRINCIPLES ── */}
      <section className="py-20 lg:py-28 bg-parchment-light border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">Urban Design</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">
              Six founding principles of the Antioch masterplan.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PRINCIPLES.map((p, i) => (
              <div key={i} className="bg-white border border-navy/[0.07] rounded-[4px] p-5 hover:shadow-[0_4px_24px_-4px_rgba(21,41,74,0.08)] hover:border-gold/20 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-gold shrink-0" />
                  <h3 className="text-[14px] font-bold text-navy">{p.label}</h3>
                </div>
                <p className="text-[12px] text-navy/60 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DISTRICTS ── */}
      <section id="masterplan" className="py-20 lg:py-28 bg-parchment-canvas border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">District Plan</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">
              Six functional districts across four rings.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DISTRICTS.map((d) => (
              <div key={d.id} className="bg-white border border-navy/[0.07] rounded-[4px] p-5 hover:shadow-[0_4px_24px_-4px_rgba(21,41,74,0.08)] hover:border-gold/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 bg-navy/[0.04] rounded-[3px] flex items-center justify-center">
                    {d.icon}
                  </div>
                  <StatusBadge status={d.status} size="sm" />
                </div>
                <h3 className="text-[14px] font-bold text-navy mb-0.5">{d.name}</h3>
                <span className="text-[10px] font-mono text-gold/70 block mb-2">{d.ring}</span>
                <p className="text-[12px] text-navy/60 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 lg:py-28 bg-navy text-parchment">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <StarOfTruth size={48} className="mx-auto" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">
              Invest in the infrastructure of a new republic.
            </h2>
            <p className="text-parchment/60 leading-relaxed">
              Covenant Development Bonds fund the physical build-out of Antioch. Denominated in AEY, fully on-ledger, with quarterly audited reserve reporting.
            </p>
            <Link
              href="/economy#bonds"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors group"
            >
              View Covenant Bonds <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
