'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useMemo, useState } from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHero } from '@/components/ui/PageHero';
import { GAZETTE_CATEGORIES, GAZETTE_NOTICE, GAZETTE_POSTS, formatGazetteDate } from '@/lib/gazette';
import { ImageCaption } from '@/components/ui/ImageCaption';
import { unsplash } from '@/lib/imagery';
import { ArrowRight, Bell, Calendar, Clock, Info, Search } from 'lucide-react';

export default function NewsPage() {
  const { t, tx, intl } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GAZETTE_POSTS.filter((p) => {
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, search]);

  const isFiltering = selectedCategory !== 'All' || search.trim() !== '';
  const [lead, ...rest] = filteredPosts;
  const showLead = !isFiltering && lead;
  const grid = showLead ? rest : filteredPosts;

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow={t("The Gazette")}
        asset="platform"
        image="newspaper"
        title={<>{t("Gazette &")}{' '}<span className="text-gold-metallic">{t("Founding Records")}</span></>}
        lead={t("Founding documents, design studies and planning notes of the Sovereign Covenant State, each one dated and signed by the founding team.")}
      />

      {/* ── NOTICE ── */}
      <section className="bg-parchment-light border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-start gap-3 text-sm text-navy/75">
          <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-semibold">{t(GAZETTE_NOTICE)}</p>
        </div>
      </section>

      {/* ── CONTROLS ── */}
      <section className="py-5 bg-white/90 backdrop-blur-md border-b border-navy/10 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-4 justify-between items-center">
          <label className="relative w-full md:w-80">
            <span className="sr-only">{t("Search the Gazette")}</span>
            <Search className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder={t("Search records and record numbers…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-sovereign w-full pl-9 pr-4 py-2.5 text-xs rounded-sm"
            />
          </label>

          <div className="flex flex-wrap gap-2 w-full md:w-auto" role="group" aria-label={t("Filter by category")}>
            {['All', ...GAZETTE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all duration-200 ${
                  selectedCategory === cat
                    ? 'bg-navy text-gold shadow-institutional'
                    : 'bg-parchment-light border border-navy/10 text-navy/70 hover:border-gold/50 hover:text-navy'
                }`}
              >
                {tx(cat)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
        {/* ── LEAD STORY ── */}
        {tx(showLead && (
          <Link
            href={`/news/${lead.slug}`}
            className="photo-card group grid grid-cols-1 lg:grid-cols-12 bg-navy-deep rounded-sm border border-gold/25 shadow-elevated"
          >
            <div className="lg:col-span-7 relative min-h-[300px] lg:min-h-[440px]">
              <Image src={unsplash(lead.image, 1400)} alt="" fill sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" />
              <ImageCaption />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-navy-deep/90 hidden lg:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/20 to-transparent lg:hidden" />
            </div>
            <div className="photo-card-body lg:col-span-5 p-8 lg:p-10 flex flex-col justify-center space-y-5 text-parchment">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2 py-0.5 bg-gold text-navy font-mono text-[10px] font-bold rounded-sm">{t("Latest")}</span>
                <span className="text-[11px] font-bold text-gold uppercase tracking-[0.16em]">{tx(lead.category)}</span>
                <StatusBadge status={lead.status} size="sm" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight group-hover:text-gold-tint transition-colors">
                {tx(lead.title)}
              </h2>
              <p className="text-sm text-parchment/70 leading-relaxed font-light">{tx(lead.summary)}</p>
              <div className="flex items-center gap-4 text-[11px] font-mono text-parchment/50">
                <span>{tx(lead.number)}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatGazetteDate(lead.date, intl)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tx(lead.readMinutes)}{' '}{t("min")}</span>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">{t("Read the record")}{' '}<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        ))}

        {/* ── BULLETIN GRID ── */}
        {tx(grid.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grid.map((post) => (
              <Link
                key={post.slug}
                href={`/news/${post.slug}`}
                className="photo-card group sovereign-card-premium rounded-sm flex flex-col"
              >
                <div className="relative h-52">
                  <Image src={unsplash(post.image, 900)} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover" />
                  <ImageCaption />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/80 via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-4 px-2 py-0.5 bg-navy-deep/80 backdrop-blur-sm text-parchment font-mono text-[10px] font-bold rounded-sm border border-gold/30">
                    {tx(post.number)}
                  </span>
                </div>
                <div className="photo-card-body p-6 flex-1 flex flex-col space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-gold-shadow uppercase tracking-[0.16em]">{tx(post.category)}</span>
                    <StatusBadge status={post.status} size="sm" />
                  </div>
                  <h3 className="text-lg font-bold text-navy leading-snug group-hover:text-gold-shadow transition-colors">{tx(post.title)}</h3>
                  <p className="text-xs text-navy/65 leading-relaxed flex-1">{tx(post.summary)}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-navy/08 text-[11px] font-mono text-navy/50">
                    <span>{formatGazetteDate(post.date, intl)}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-3">
            <p className="text-navy font-semibold">{t("No records match your search.")}</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory('All'); }}
              className="text-xs font-bold uppercase tracking-wider text-gold-shadow hover:text-navy"
            >{t("Clear filters")}</button>
          </div>
        ))}
      </section>

      {/* ── SUBSCRIPTION ── */}
      <section className="guilloche-hero relative overflow-hidden text-parchment py-20 border-t border-gold/25">
        <div className="orb-gold w-[420px] h-[420px] -top-40 left-1/4 opacity-40" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full border border-gold/40 bg-navy-deep/70 flex items-center justify-center animate-glow-pulse">
            <Bell className="w-6 h-6 text-gold" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">{t("Follow the Gazette")}</h2>
            <p className="text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Founding Members receive new founding documents and design records when they are published.")}</p>
          </div>

          <Link href="/founding-members" className="btn-sovereign-gold inline-flex px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-sm">{t("Register interest as a Founding Member")}</Link>
        </div>
      </section>
    </div>
  );
}
