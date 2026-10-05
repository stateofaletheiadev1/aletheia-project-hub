'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
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
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { REGISTER, registerPdfHref, registerReadHref } from '@/lib/documents';

export default function DocumentsPage() {
  const { t, tx } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredDocs = REGISTER.filter((doc) => {
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
        <HeroBackdrop image="paperwork" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Public Repository")}</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Official Documents & Legal Registry")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("All statutory acts, constitutional texts, executive decrees, and technical standards of Aletheia are published openly. Every record includes a cryptographic SHA-256 integrity hash verifiable against the national ledger.")}</p>
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
                placeholder={t("Search documents, acts, codes, or keywords...")}
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
                  {tx(cat)}
                </button>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── DOCUMENTS LIST ── */}
      <section className="py-12 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="space-y-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              id={doc.id}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[10px] font-bold uppercase rounded-sm border border-navy/10">
                    {tx(doc.code)}
                  </span>
                  <span className="text-xs font-bold text-gold uppercase tracking-wider">
                    {tx(doc.category)}
                  </span>
                  <StatusBadge status={doc.status} size="sm" />
                  <span className="text-[11px] text-navy/50 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {tx(doc.date)}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-navy">{tx(doc.title)}</h3>
                <p className="text-xs text-navy/70 leading-relaxed">{tx(doc.description)}</p>

                <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] font-mono text-navy/50">
                  <span>{t("PDF · A4")}</span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-gold" />{t("Hash:")}{' '}<code className="text-[10px] text-navy/70">{doc.hash.slice(0, 18)}...</code>
                  </span>
                </div>
              </div>

              <div className="flex md:flex-col gap-2 shrink-0 justify-end">
                <a
                  href={registerPdfHref(doc.id)}
                  target="_blank"
                  rel="noopener"
                  className="px-4 py-2 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />{' '}{t("Download PDF")}</a>
                <Link
                  href={registerReadHref(doc)}
                  className="px-4 py-2 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:border-gold hover:text-gold text-center transition-colors flex items-center justify-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />{' '}{t("Read Online")}</Link>
              </div>
            </div>
          ))}

          {tx(filteredDocs.length === 0 && (
            <div className="text-center py-16 bg-white border border-navy/10 rounded-sm">
              <FileText className="w-8 h-8 text-navy/30 mx-auto mb-3" />
              <p className="text-sm font-bold text-navy">{t("No documents match your query.")}</p>
              <p className="text-xs text-navy/60 mt-1">{t("Try clearing your search terms or selecting another category.")}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER CALLOUT ── */}
      <section className="bg-navy text-parchment py-12 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-gold mx-auto" />
          <h3 className="text-xl font-bold text-parchment">{t("Cryptographic Hash Verification")}</h3>
          <p className="text-xs text-parchment/70 max-w-xl mx-auto">{t("Every statute published above is hashed and verified against root state block #0 of the Aletheia StableChain ledger.")}</p>
        </div>
      </section>

    </div>
  );
}
