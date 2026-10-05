'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  FileText,
  Download,
  Search,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Hash,
  BookOpen,
  Filter,
  CheckCircle2,
} from 'lucide-react';

interface DocumentItem {
  id: string;
  title: string;
  category: 'Constitutional' | 'Statute' | 'Gazette' | 'Technical Standard';
  code: string;
  date: string;
  hash: string;
  status: 'Operational' | 'Under Development' | 'Planned';
  description: string;
  pages: number;
}

const DOCUMENTS: DocumentItem[] = [
  {
    id: 'covenant-main',
    title: 'The Covenant of Aletheia (Full Constitution)',
    category: 'Constitutional',
    code: 'CONST-2026-01',
    date: '2026-01-15',
    hash: '0x8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    status: 'Operational',
    description: 'The fundamental supreme organic law establishing the federal republic, rights charter, and governance architecture.',
    pages: 48,
  },
  {
    id: 'nationality-act',
    title: 'Nationality & Naturalisation Act',
    category: 'Statute',
    code: 'ACT-2026-04',
    date: '2026-02-10',
    hash: '0x3c9902ba14ff28e67a01d5e390c88461ab209ef731478201fa8892ca3401ef62',
    status: 'Operational',
    description: 'Governs citizenship acquisition, civic integration, e-residency naturalisation, and revocation protocols.',
    pages: 22,
  },
  {
    id: 'passport-spec',
    title: 'Passports & ICAO eMRTD Specifications Act',
    category: 'Statute',
    code: 'ACT-2026-07',
    date: '2026-03-01',
    hash: '0x17fa9081e7d230198aa49b8214309eec8120fa87632190847b2c01948fe21980',
    status: 'Operational',
    description: 'Statutory mandate for TD3 biometric travel document issuance, polycarbonate substrates, and ICAO PKD keys.',
    pages: 18,
  },
  {
    id: 'monetary-framework',
    title: 'Monetary Architecture & AEY Reserve Act',
    category: 'Statute',
    code: 'ACT-2026-09',
    date: '2026-04-18',
    hash: '0xaa18902ef34b890123ca78091ecb87201948ba209ef182049ec8720914be8721',
    status: 'Operational',
    description: 'Defines the legal tender status of the Aletheian Guilder (AEY) and reserve backing invariants.',
    pages: 34,
  },
  {
    id: 'gazette-01-2026',
    title: 'Official Gazette No. 01/2026 — Establishing Decree',
    category: 'Gazette',
    code: 'GAZ-2026-01',
    date: '2026-05-01',
    hash: '0x9920184fa9802ecb8720918ba340291ef732014890ecb8201948ea20914801fa',
    status: 'Operational',
    description: 'Official promulgation of inaugural executive orders, ministerial portfolios, and diplomatic notifications.',
    pages: 12,
  },
  {
    id: 'aps-01-spec',
    title: 'Aletheia Protocol Standard 01: StableChain Consensus & Settlement',
    category: 'Technical Standard',
    code: 'APS-01',
    date: '2026-06-12',
    hash: '0x4489021fa89023ebc87201948ea20914bca890214890ec8201948ea20914801e',
    status: 'Under Development',
    description: 'Technical whitepaper for 500ms block finality, deterministic gas execution, and state registry verification.',
    pages: 64,
  },
];

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredDocs = DOCUMENTS.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Public Repository</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">
              Official Documents & Legal Registry
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              All statutory acts, constitutional texts, executive decrees, and technical standards of Aletheia are published openly. Every record includes a cryptographic SHA-256 integrity hash verifiable against the national ledger.
            </p>
          </div>
        </div>
      </section>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <section className="py-8 bg-white border-b border-navy/15 sticky top-16 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search documents, acts, codes, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'Constitutional', 'Statute', 'Gazette', 'Technical Standard'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                    selectedCategory === cat
                      ? 'bg-navy text-gold'
                      : 'bg-parchment-light border border-navy/10 text-navy/70 hover:border-gold/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── DOCUMENTS LIST ── */}
      <section className="py-12 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[10px] font-bold uppercase rounded-sm border border-navy/10">
                    {doc.code}
                  </span>
                  <span className="text-xs font-bold text-gold uppercase tracking-wider">
                    {doc.category}
                  </span>
                  <StatusBadge status={doc.status} size="sm" />
                  <span className="text-[11px] text-navy/50 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {doc.date}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-navy">{doc.title}</h3>
                <p className="text-xs text-navy/70 leading-relaxed">{doc.description}</p>

                <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] font-mono text-navy/50">
                  <span>Pages: {doc.pages}</span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-gold" />
                    Hash: <code className="text-[10px] text-navy/70">{doc.hash.slice(0, 18)}...</code>
                  </span>
                </div>
              </div>

              <div className="flex md:flex-col gap-2 shrink-0 justify-end">
                <button
                  onClick={() => alert(`Document ${doc.code} PDF generation initiated. Status: Verified on StableChain.`)}
                  className="px-4 py-2 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <Link
                  href={doc.id === 'covenant-main' ? '/constitution' : doc.id === 'passport-spec' ? '/passport' : '#'}
                  className="px-4 py-2 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:border-gold hover:text-gold text-center transition-colors flex items-center justify-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Read Online
                </Link>
              </div>
            </div>
          ))}

          {filteredDocs.length === 0 && (
            <div className="text-center py-16 bg-white border border-navy/10 rounded-sm">
              <FileText className="w-8 h-8 text-navy/30 mx-auto mb-3" />
              <p className="text-sm font-bold text-navy">No documents match your query.</p>
              <p className="text-xs text-navy/60 mt-1">Try clearing your search terms or selecting another category.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER CALLOUT ── */}
      <section className="bg-navy text-parchment py-12 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-gold mx-auto" />
          <h3 className="text-xl font-bold text-parchment">Cryptographic Hash Verification</h3>
          <p className="text-xs text-parchment/70 max-w-xl mx-auto">
            Every statute published above is hashed and verified against root state block #0 of the Aletheia StableChain ledger.
          </p>
        </div>
      </section>

    </div>
  );
}
