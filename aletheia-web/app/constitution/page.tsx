'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  ChevronRight,
  Shield,
  Landmark,
  Scale,
  Check,
  FileText,
  ArrowRight,
} from 'lucide-react';

export default function ConstitutionPage() {
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
      <section className="bg-navy text-parchment py-16 lg:py-20 border-b border-gold/40 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
          <svg width="800" height="800" viewBox="0 0 100 100" fill="none">
            <polygon points="50,0 95,27 95,85 50,112 5,85 5,27" stroke="#C49A4E" strokeWidth="0.8" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-navy-deep/80 border border-gold/40 rounded-sm">
            <StarOfTruth size={16} />
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
              SUPREME CONSTITUTIONAL CHARTER
            </span>
            <span className="text-parchment/40">|</span>
            <span className="text-xs text-parchment/80 font-serif italic">Edition 2026.3</span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-parchment">
              The Covenant of Aletheia
            </h1>
            <p className="text-base sm:text-lg text-parchment/80 leading-relaxed font-light">
              The constitutional instrument establishing the Sovereign Covenant State of Aletheia. Every provision is an immutable public covenant binding government, constituent states, and citizens under the rule of verifiable law.
            </p>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-navy-deep border border-gold/40 text-parchment hover:text-gold rounded-sm flex items-center gap-2 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-gold" />
              <span>Print Official Version</span>
            </button>
            <span className="text-parchment/40">|</span>
            <span className="text-parchment/70 font-mono">
              Status: Authoritative Working Draft (Planning Instrument)
            </span>
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
                <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                  TABLE OF CONTENTS
                </span>
                <span className="text-xs font-mono text-navy/50">
                  {filteredArticles.length} Provisions
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-navy/40 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles, keywords..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-parchment-light border border-navy/20 rounded-sm text-navy placeholder:text-navy/40 focus:outline-none focus:border-gold"
                />
              </div>

              {/* Part Filter Tabs */}
              <div className="space-y-1 pt-2">
                <span className="text-[11px] font-semibold text-navy/60 uppercase tracking-wider block mb-1">
                  Filter by Part
                </span>
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
                      {p}
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
                  >
                    Art. {art.number}: {art.title}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Searchable Article Cards & Linking Spine (Col 8) */}
          <div className="lg:col-span-8 space-y-8">
            {filteredArticles.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-sm border border-navy/15 space-y-3">
                <BookOpen className="w-8 h-8 text-gold mx-auto" />
                <h3 className="text-lg font-bold text-navy">No Constitutional Articles Found</h3>
                <p className="text-xs text-navy/60">
                  Try adjusting your search terms or clearing the part filter.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPart('All');
                  }}
                  className="px-4 py-2 bg-navy text-parchment text-xs font-semibold rounded-sm uppercase tracking-wider"
                >
                  Reset Filters
                </button>
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
                        {art.part}
                      </span>
                      <h2 className="text-2xl font-bold text-navy">
                        Article {art.number}. {art.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={art.status} size="sm" />
                      <button
                        onClick={() => handleCopyLink(art.id)}
                        className="p-1.5 border border-navy/15 text-navy/60 hover:text-navy hover:bg-parchment-light rounded-sm transition-colors"
                        title="Copy clause permalink"
                      >
                        {copiedId === art.id ? (
                          <Check className="w-4 h-4 text-laurel" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Summary Lead */}
                  <p className="text-sm text-navy/80 italic bg-parchment-light p-3 rounded-sm border-l-2 border-gold">
                    {art.summary}
                  </p>

                  {/* Clauses */}
                  <div className="space-y-4">
                    {art.clauses.map((clause) => (
                      <div key={clause.number} className="flex items-start gap-3">
                        <span className="font-mono text-xs font-bold text-gold-shadow bg-parchment-canvas px-1.5 py-0.5 rounded-sm border border-navy/10 shrink-0">
                          {clause.number}
                        </span>
                        <p className="text-sm text-navy/90 leading-relaxed font-normal">
                          {clause.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Cross References */}
                  {art.crossReferences.length > 0 && (
                    <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-navy/50 font-medium">Cross References:</span>
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
                  )}

                  {/* ─────────────────────────────────────────────────────────
                      THE LINKING SPINE (§10.5):
                      Constitution → Law → Institution → Service
                  ────────────────────────────────────────────────────────── */}
                  <div className="pt-4 border-t border-navy/10 bg-parchment-canvas/40 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 sm:p-6 rounded-b-sm space-y-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-gold-shadow block font-bold">
                      THE CIVIC LINKING SPINE (§10.5)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Related Law */}
                      <div className="p-2.5 bg-white border border-navy/10 rounded-sm space-y-1">
                        <span className="text-[10px] text-navy/50 uppercase tracking-wider block">
                          Statutory Enactment
                        </span>
                        <span className="font-semibold text-navy line-clamp-1">
                          {art.relatedLaw.title}
                        </span>
                      </div>

                      {/* Responsible Institution */}
                      <div className="p-2.5 bg-white border border-navy/10 rounded-sm space-y-1">
                        <span className="text-[10px] text-navy/50 uppercase tracking-wider block">
                          Responsible Body
                        </span>
                        <Link
                          href={art.responsibleInstitution.href}
                          className="font-semibold text-navy hover:text-gold transition-colors line-clamp-1"
                        >
                          {art.responsibleInstitution.name}
                        </Link>
                      </div>

                      {/* Connected Public Service */}
                      <div className="p-2.5 bg-white border border-navy/10 rounded-sm space-y-1">
                        <span className="text-[10px] text-navy/50 uppercase tracking-wider block">
                          Government Service
                        </span>
                        {art.relatedService ? (
                          <Link
                            href={art.relatedService.href}
                            className="font-semibold text-gold-shadow hover:text-navy transition-colors flex items-center gap-1 line-clamp-1"
                          >
                            <span>{art.relatedService.title}</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                          </Link>
                        ) : (
                          <span className="text-navy/40 italic">Statutory foundation</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
