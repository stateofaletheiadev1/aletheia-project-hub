'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { GAZETTE_NOTICE, GAZETTE_POSTS, formatGazetteDate, getGazettePost } from '@/lib/gazette';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ImageCaption } from '@/components/ui/ImageCaption';
import { unsplash } from '@/lib/imagery';
import { ArrowLeft, ArrowRight, Calendar, Clock, Download, Info, PenLine } from 'lucide-react';

export function GazetteArticleView({ slug }: { slug: string }) {
  const { t, tx, intl } = useI18n();
  const post = getGazettePost(slug)!;
  const index = GAZETTE_POSTS.findIndex((p) => p.slug === post.slug);
  const related = GAZETTE_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const newer = GAZETTE_POSTS[index - 1];
  const older = GAZETTE_POSTS[index + 1];

  return (
    <article className="bg-parchment-canvas">
      {/* ── HEADER ── */}
      <header className="relative overflow-hidden text-parchment min-h-[62vh] flex items-end border-b border-gold/30">
        <div className="absolute inset-0 animate-ken-burns" aria-hidden="true">
          <Image src={unsplash(post.image, 2000)} alt="" fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#060C14] via-[#0E1B31]/75 to-[#0E1B31]/30" />
        <ImageCaption position="top-right" className="top-24" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 pt-32 w-full space-y-5">
          <Link href="/news" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-tint transition-colors" data-print-hide>
            <ArrowLeft className="w-3.5 h-3.5" />{' '}{t("All Gazette records")}</Link>
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up">
            <span className="px-2 py-0.5 bg-gold text-navy font-mono text-[11px] font-bold rounded-sm">{tx(post.number)}</span>
            <span className="text-[11px] font-bold text-gold uppercase tracking-[0.18em]">{tx(post.category)}</span>
            <StatusBadge status={post.status} size="sm" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] animate-fade-in-up delay-100">
            {tx(post.title)}
          </h1>
          <div className="flex flex-wrap items-center gap-5 text-xs font-mono text-parchment/65 animate-fade-in-up delay-200">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gold" /> {formatGazetteDate(post.date, intl)}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gold" /> {tx(post.readMinutes)}{' '}{t("min read")}</span>
            <span className="flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5 text-gold" /> {tx(post.signatory)}</span>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <p role="note" className="flex items-start gap-2 text-xs font-semibold text-navy/70 bg-parchment-light border border-navy/10 rounded-sm px-4 py-3 mb-10">
          <Info className="w-4 h-4 text-gold shrink-0" aria-hidden="true" />
          {t(GAZETTE_NOTICE)}
        </p>
        <p className="text-xl text-navy leading-relaxed font-light border-l-2 border-gold pl-6 mb-12">{tx(post.summary)}</p>
        <div className="space-y-6 text-[17px] leading-[1.9] text-navy/80 font-serif">
          {post.body.map((para, i) => (
            <p key={i} className={i === 0 ? 'first-letter:text-6xl first-letter:font-bold first-letter:text-gold-shadow first-letter:float-left first-letter:mr-3 first-letter:leading-[0.85]' : ''}>
              {tx(para)}
            </p>
          ))}
        </div>

        <footer className="mt-14 pt-8 border-t-2 border-navy/15 flex flex-col sm:flex-row justify-between gap-6">
          <div className="space-y-1 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-shadow block">{t("Published by")}</span>
            <p className="font-bold text-navy">{tx(post.signatory)}</p>
            <p className="text-xs font-mono text-navy/50">{t("Gazette record")}{' '}{tx(post.number)}</p>
          </div>
          <a
            href={`/pdf/gazette/${post.slug}`}
            target="_blank"
            rel="noopener"
            data-print-hide
            className="self-start btn-sovereign-navy px-5 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5 text-gold" />{' '}{t("Gazette PDF")}</a>
          <div className="self-start flex items-center gap-3 p-4 bg-navy rounded-sm border border-gold/30 text-parchment">
            <StarOfTruth size={22} />
            <div className="text-[11px] font-mono">
              <div className="text-gold font-bold">{t("Founding-phase record")}</div>
              <div className="text-parchment/55">{t("No legal force")}</div>
            </div>
          </div>
        </footer>

        <nav className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label={t("Adjacent records")} data-print-hide>
          {tx(newer ? (
            <Link href={`/news/${newer.slug}`} className="group sovereign-card-premium rounded-sm p-5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-shadow flex items-center gap-1"><ArrowLeft className="w-3 h-3" />{' '}{t("Newer")}</span>
              <span className="block text-sm font-bold text-navy group-hover:text-gold-shadow transition-colors">{tx(newer.title)}</span>
            </Link>
          ) : <span />)}
          {tx(older && (
            <Link href={`/news/${older.slug}`} className="group sovereign-card-premium rounded-sm p-5 space-y-1 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-shadow flex items-center gap-1 sm:justify-end">{t("Older")}{' '}<ArrowRight className="w-3 h-3" /></span>
              <span className="block text-sm font-bold text-navy group-hover:text-gold-shadow transition-colors">{tx(older.title)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* ── RELATED ── */}
      <section className="bg-parchment-light border-t border-navy/08 py-16 lg:py-20" data-print-hide>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="eyebrow">{t("More from the Gazette")}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map((p) => (
              <Link key={p.slug} href={`/news/${p.slug}`} className="photo-card group sovereign-card-premium rounded-sm flex flex-col">
                <div className="relative h-44">
                  <Image src={unsplash(p.image, 800)} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
                  <ImageCaption />
                </div>
                <div className="photo-card-body p-5 space-y-2">
                  <span className="text-[10px] font-bold text-gold-shadow uppercase tracking-[0.16em]">{tx(p.category)}</span>
                  <h3 className="text-base font-bold text-navy leading-snug group-hover:text-gold-shadow transition-colors">{tx(p.title)}</h3>
                  <span className="text-[11px] font-mono text-navy/50 block">{formatGazetteDate(p.date, intl)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
