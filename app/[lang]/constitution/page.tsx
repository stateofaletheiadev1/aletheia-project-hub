'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { CONSTITUTION_DATA, ConstitutionalArticle } from '@/lib/constitution-data';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import {
  Search,
  BookOpen,
  Filter,
  Share2,
  ExternalLink,
  Printer,
  Download,
  ChevronRight,
  Shield,
  Landmark,
  Scale,
  Check,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export default function ConstitutionPage() {
  const { t, tx } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const parts = ['All', ...Array.from(new Set(CONSTITUTION_DATA.map((a) => a.part)))];

  const filteredArticles = CONSTITUTION_DATA.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.clauses.some((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase())) ||
      article.number.toString() === searchQuery.trim();

    const matchesPart = selectedPart === 'All' || article.part === selectedPart;
    return matchesSearch && matchesPart;
  });

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/constitution#${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-parchment-canvas text-navy">
      {/* 1. Constitutional Hero Banner */}
      {/* 1. Constitutional Hero Banner */}
      <section className="guilloche-hero relative text-parchment py-24 lg:py-32 border-b border-gold/30 overflow-hidden">
        <HeroBackdrop image="lawLibrary" />
        {/* Ambient orbs */}
        <div className="orb-gold w-[500px] h-[500px] -top-28 -left-36 opacity-50 animate-orb-float-1" />
        <div className="orb-burgundy w-[360px] h-[360px] bottom-0 right-8 opacity-45 animate-orb-float-2" />

        {/* Multi-ring hex watermark */}
        <div className="absolute inset-0 opacity-[0.045] pointer-events-none flex items-center justify-center">
          <svg width="900" height="900" viewBox="0 0 100 100" fill="none">
            <polygon points="50,2 95,27 95,73 50,98 5,73 5,27" stroke="#C49A4E" strokeWidth="0.5" />
            <polygon points="50,12 85,32 85,68 50,88 15,68 15,32" stroke="#C49A4E" strokeWidth="0.35" />
            <polygon points="50,22 75,37 75,63 50,78 25,63 25,37" stroke="#C49A4E" strokeWidth="0.22" />
            <circle cx="50" cy="50" r="45" stroke="#C49A4E" strokeWidth="0.18" />
            <circle cx="50" cy="50" r="5" stroke="#C49A4E" strokeWidth="0.55" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-7">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-navy-deep/80 border border-gold/40 rounded-sm backdrop-blur-sm">
            <StarOfTruth size={16} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Supreme Constitutional Charter")}</span>
            <span className="text-parchment/30">|</span>
            <span className="text-[11px] text-parchment/70 font-serif italic">{t("Edition 2026.3")}</span>
          </div>

          <div className="max-w-3xl space-y-4 animate-fade-in-up">
            <h1 className="heading-hero">{t("The Covenant")}<br />
              <span className="text-gold-metallic">{t("of Aletheia")}</span>
            </h1>
            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("The constitutional instrument establishing the Sovereign Covenant State of Aletheia. Every provision is an immutable public covenant binding government, constituent states, and citizens under the rule of verifiable law.")}</p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-4 animate-fade-in-up delay-200">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-navy-deep/80 backdrop-blur-sm border border-gold/35 text-parchment hover:text-gold hover:border-gold/60 rounded-sm flex items-center gap-2 transition-all text-xs font-semibold uppercase tracking-wider"
            >
              <Printer className="w-3.5 h-3.5 text-gold" />
              <span>{t("Print Official Version")}</span>
            </button>
            <a
              href="/pdf/constitution"
              target="_blank"
              rel="noopener"
              className="btn-sovereign-gold px-5 py-2.5 rounded-sm flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("Download PDF")}</span>
            </a>
            <span className="text-parchment/30">|</span>
            <span className="text-parchment/60 font-mono text-xs">{t("Status: Authoritative Working Draft — Planning Instrument")}</span>
          </div>
        </div>
      </section>

      {/* 2. Interactive Search & Article Engine */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Persistent Table of Contents (Col 4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-4 shadow-subtle sticky top-28">
              <div className="flex items-center justify-between border-b border-navy/10 pb-3">
                <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">{t("TABLE OF CONTENTS")}</span>
                <span className="text-xs font-mono text-navy/50">
                  {tx(filteredArticles.length)}{' '}{t("Provisions")}</span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-navy/40 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("Search articles, keywords...")}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-parchment-light border border-navy/20 rounded-sm text-navy placeholder:text-navy/40 focus:outline-none focus:border-gold"
                />
              </div>

              {/* Part Filter Tabs */}
              <div className="space-y-1 pt-2">
                <span className="text-[11px] font-semibold text-navy/60 uppercase tracking-wider block mb-1">{t("Filter by Part")}</span>
                <div className="space-y-1">
                  {parts.map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPart(p)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-sm transition-colors ${
                        selectedPart === p
                          ? 'bg-navy text-parchment font-semibold'
                          : 'text-navy/80 hover:bg-parchment-canvas'
                      }`}
                    >
                      {tx(p)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Jump List */}
              <div className="pt-3 border-t border-navy/10 max-h-60 overflow-y-auto space-y-1">
                {CONSTITUTION_DATA.map((art) => (
                  <a
                    key={art.id}
                    href={`#${art.id}`}
                    className="block px-2 py-1 text-[11px] text-navy/70 hover:text-gold hover:bg-parchment-canvas rounded-sm truncate"
                  >{t("Art.")}{' '}{tx(art.number)}: {tx(art.title)}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Searchable Article Cards & Linking Spine (Col 8) */}
          <div className="lg:col-span-8 space-y-8">
            {tx(filteredArticles.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-sm border border-navy/15 space-y-3">
                <BookOpen className="w-8 h-8 text-gold mx-auto" />
                <h3 className="text-lg font-bold text-navy">{t("No Constitutional Articles Found")}</h3>
                <p className="text-xs text-navy/60">{t("Try adjusting your search terms or clearing the part filter.")}</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPart('All');
                  }}
                  className="px-4 py-2 bg-navy text-parchment text-xs font-semibold rounded-sm uppercase tracking-wider"
                >{t("Reset Filters")}</button>
              </div>
            ) : (
              filteredArticles.map((art) => (
                <article
                  key={art.id}
                  id={art.id}
                  className="bg-white border border-navy/15 rounded-sm p-6 sm:p-8 shadow-subtle hover:shadow-institutional transition-all space-y-6 scroll-mt-28"
                >
                  {/* Article Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-navy/10 pb-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-gold-shadow uppercase tracking-wider block">
                        {tx(art.part)}
                      </span>
                      <h2 className="text-2xl font-bold text-navy">{t("Article")}{' '}{tx(art.number)}. {tx(art.title)}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={art.status} size="sm" />
                      <button
                        onClick={() => handleCopyLink(art.id)}
                        className="p-1.5 border border-navy/15 text-navy/60 hover:text-navy hover:bg-parchment-light rounded-sm transition-colors"
                        title={t("Copy clause permalink")}
                      >
                        {tx(copiedId === art.id ? (
                          <Check className="w-4 h-4 text-laurel" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        ))}
                      </button>
                    </div>
                  </div>

                  {/* Summary Lead */}
                  <p className="text-sm text-navy/80 italic bg-parchment-light p-3 rounded-sm border-l-2 border-gold">
                    {tx(art.summary)}
                  </p>

                  {/* Clauses */}
                  <div className="space-y-4">
                    {art.clauses.map((clause) => (
                      <div key={clause.number} className="flex items-start gap-3">
                        <span className="font-mono text-xs font-bold text-gold-shadow bg-parchment-canvas px-1.5 py-0.5 rounded-sm border border-navy/10 shrink-0">
                          {tx(clause.number)}
                        </span>
                        <p className="text-sm text-navy/90 leading-relaxed font-normal">
                          {tx(clause.text)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Cross References */}
                  {tx(art.crossReferences.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-navy/50 font-medium">{t("Cross References:")}</span>
                      {art.crossReferences.map((ref) => (
                        <a
                          key={ref}
                          href={`#${ref}`}
                          className="px-2 py-0.5 bg-parchment-canvas text-navy/80 hover:text-gold border border-navy/10 rounded-sm font-mono text-[11px] transition-colors"
                        >
                          § {ref.toUpperCase()}
                        </a>
                      ))}
                    </div>
                  ))}

                  {/* ─────────────────────────────────────────────────────────
                      THE LINKING SPINE (§10.5):
                      Constitution → Law → Institution → Service
                  ────────────────────────────────────────────────────────── */}
                  <div className="pt-4 border-t border-navy/10 bg-parchment-canvas/40 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 sm:p-6 rounded-b-sm space-y-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-gold-shadow block font-bold">{t("THE CIVIC LINKING SPINE (§10.5)")}</span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Related Law */}
                      <div className="p-2.5 bg-white border border-navy/10 rounded-sm space-y-1">
                        <span className="text-[10px] text-navy/50 uppercase tracking-wider block">{t("Statutory Enactment")}</span>
                        <span className="font-semibold text-navy line-clamp-1">
                          {tx(art.relatedLaw.title)}
                        </span>
                      </div>

                      {/* Responsible Institution */}
                      <div className="p-2.5 bg-white border border-navy/10 rounded-sm space-y-1">
                        <span className="text-[10px] text-navy/50 uppercase tracking-wider block">{t("Responsible Body")}</span>
                        <Link
                          href={art.responsibleInstitution.href}
                          className="font-semibold text-navy hover:text-gold transition-colors line-clamp-1"
                        >
                          {tx(art.responsibleInstitution.name)}
                        </Link>
                      </div>

                      {/* Connected Public Service */}
                      <div className="p-2.5 bg-white border border-navy/10 rounded-sm space-y-1">
                        <span className="text-[10px] text-navy/50 uppercase tracking-wider block">{t("Government Service")}</span>
                        {tx(art.relatedService ? (
                          <Link
                            href={art.relatedService.href}
                            className="font-semibold text-gold-shadow hover:text-navy transition-colors flex items-center gap-1 line-clamp-1"
                          >
                            <span>{tx(art.relatedService.title)}</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                          </Link>
                        ) : (
                          <span className="text-navy/40 italic">{t("Statutory foundation")}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
