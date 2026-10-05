'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Scale,
  BookOpen,
  Search,
  FileText,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export interface StatuteMeta {
  slug: string;
  code: string;
  title: string;
  article: string;
  date: string;
  hash: string;
  summary: string;
  pages: number;
}

export const STATUTES: StatuteMeta[] = [
  {
    slug: 'constitutional-supremacy',
    code: 'ACT-2026-01',
    title: 'Constitutional Supremacy & Judicial Review Act',
    article: 'Constitution Article 1 § 3',
    date: '2026-01-20',
    hash: '0x8f2b7a4c91e3d085fa49b817e4521098ef7321ac',
    summary: 'Codifies the absolute supremacy of the Covenant over ordinary statutes, establishing the jurisdiction of the High Court to void unconstitutional executive decrees.',
    pages: 18,
  },
  {
    slug: 'languages-act',
    code: 'ACT-2026-02',
    title: 'Official Languages & Diplomatic Communication Act',
    article: 'Constitution Article 2 § 2',
    date: '2026-01-28',
    hash: '0x14ea892018fa34091ec87201948ba209ef731204',
    summary: 'Designates English, German, Serbian, and Italian as official national languages, regulating statutory translations, gazette publications, and diplomatic passports.',
    pages: 14,
  },
  {
    slug: 'maritime-zones',
    code: 'ACT-2026-03',
    title: 'Maritime Zones & UNCLOS Jurisdiction Act',
    article: 'Constitution Article 3 § 4',
    date: '2026-02-05',
    hash: '0x77ba90123ca87201948ea20914be872190847b2c',
    summary: 'Enforces statutory boundaries for Aletheia’s 12nm territorial waters, contiguous zone, and 200nm Exclusive Economic Zone in adherence to international law.',
    pages: 26,
  },
  {
    slug: 'nationality-act',
    code: 'ACT-2026-04',
    title: 'Nationality & Naturalisation Act',
    article: 'Constitution Article 8 § 5',
    date: '2026-02-14',
    hash: '0x3c9902ba14ff28e67a01d5e390c88461ab209ef7',
    summary: 'Establishes the criteria for founding citizenship, naturalisation by physical residence, civic integration assessment, and passport issuance rights.',
    pages: 32,
  },
  {
    slug: 'e-residency-act',
    code: 'ACT-2026-05',
    title: 'Digital E-Residency & Virtual Jurisdiction Act',
    article: 'Constitution Article 9 § 4',
    date: '2026-02-22',
    hash: '0x55902148ea20914801fa8892ca3401ef6291a012',
    summary: 'Defines the legal rights of digital identity holders, 15-minute corporate incorporation, virtual legal standing, and explicit physical residency exclusions.',
    pages: 24,
  },
  {
    slug: 'monetary-act',
    code: 'ACT-2026-06',
    title: 'Monetary Architecture & Reserve Backing Act',
    article: 'Constitution Article 14 § 6',
    date: '2026-03-04',
    hash: '0xaa18902ef34b890123ca78091ecb87201948ba20',
    summary: 'Statutory mandate creating the Aletheian Guilder (AEY), enforcing the 100% reserve floor in gold and EU debt, and guaranteeing par redemption on demand.',
    pages: 28,
  },
  {
    slug: 'executive-act',
    code: 'ACT-2026-07',
    title: 'Executive Cabinet & Ministerial Portfolios Act',
    article: 'Constitution Article 15 § 5',
    date: '2026-03-12',
    hash: '0x9920184fa9802ecb8720918ba340291ef7320148',
    summary: 'Imposes the strict constitutional maximum of nine ministries, defining statutory responsibilities, oaths of office, and parliamentary oversight mechanisms.',
    pages: 20,
  },
  {
    slug: 'adss-act',
    code: 'ACT-2026-08',
    title: 'Armed & Defensive Sovereign Service (ADSS) Governance Act',
    article: 'Constitution Article 18 § 4',
    date: '2026-03-20',
    hash: '0x4489021fa89023ebc87201948ea20914bca89021',
    summary: 'Mandates absolute civilian subordination of security forces, prohibits military domestic policing, and establishes the Coast Guard maritime SAR protocol.',
    pages: 36,
  },
  {
    slug: 'cyber-resilience',
    code: 'ACT-2026-09',
    title: 'Critical National Infrastructure & Cyber Resilience Act',
    article: 'Constitution Article 19 § 3',
    date: '2026-03-29',
    hash: '0x66189023ebca87201948ea20914801e991204890',
    summary: 'Enacts mandatory post-quantum cryptographic standards, validator consensus protection, and SCADA air-gapping across national energy and maritime facilities.',
    pages: 30,
  },
];

export default function LawsIndexPage() {
  const [search, setSearch] = useState('');

  const filtered = STATUTES.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="justice" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Republic of Aletheia</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">
              The Statutory Code & Organic Acts
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              Official codified legislation enacted pursuant to the Covenant of Aletheia. Every statute is authenticated by parliamentary inscription and verified on the public ledger.
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTROLS & SEARCH ── */}
      <section className="py-6 bg-white border-b border-navy/15 sticky top-16 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search codified statutes, acts, or keywords..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
              />
            </div>
            <span className="text-xs font-mono text-navy/60">
              Showing {filtered.length} of {STATUTES.length} Codified Acts
            </span>
          </div>
        </div>
      </section>

      {/* ── LAWS GRID ── */}
      <section className="py-12 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((law) => (
            <div
              key={law.slug}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[10px] font-bold rounded-sm border border-navy/10">
                      {law.code}
                    </span>
                    <span className="text-[11px] font-mono text-gold font-bold">{law.article}</span>
                  </div>
                  <span className="text-[11px] font-mono text-navy/50 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {law.date}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-navy leading-snug">{law.title}</h2>
                <p className="text-xs text-navy/70 leading-relaxed">{law.summary}</p>
              </div>

              <div className="pt-4 border-t border-navy/10 flex items-center justify-between text-xs">
                <span className="text-navy/50 font-mono text-[11px] flex items-center gap-1">
                  <Hash className="w-3 h-3 text-gold" /> {law.hash.slice(0, 16)}...
                </span>
                <Link
                  href={`/laws/${law.slug}`}
                  className="px-4 py-1.5 bg-navy text-gold font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Read Full Act <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
