import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { StatuteActions } from './StatuteActions';
import { STATUTE_DATABASE, getStatute } from '@/lib/statutes';
import { ArrowLeft, Calendar, Hash, ShieldCheck } from 'lucide-react';

export function generateStaticParams() {
  return Object.keys(STATUTE_DATABASE).map((slug) => ({ slug }));
}

// Only statutes in the register exist; anything else is a 404.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const statute = getStatute(slug);
  if (!statute) return {};
  return {
    title: `${statute.title} (${statute.code})`,
    description: statute.preamble,
    alternates: { canonical: `/laws/${statute.slug}` },
  };
}

export default async function StatuteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const statute = getStatute(slug);

  if (!statute) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HEADER ── */}
      <section className="guilloche-hero relative overflow-hidden text-parchment pt-24 pb-16 border-b border-gold/30">
        <HeroBackdrop image="lawLibrary" intensity={0.28} />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Link
            href="/laws"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Codified Statutes Index
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2 py-0.5 bg-navy-deep text-parchment font-mono text-[10px] font-bold rounded-sm border border-navy/40">
              {statute.code}
            </span>
            <span className="text-xs font-mono text-gold font-bold">{statute.article}</span>
            <StatusBadge status="Operational" size="sm" />
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-parchment leading-tight">
            {statute.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-parchment/60 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gold" /> Enacted: {statute.date}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-gold" /> Ledger Hash: {statute.hash.slice(0, 18)}...
            </span>
          </div>
        </div>
      </section>

      {/* ── STATUTE BODY ── */}
      <section className="py-12 lg:py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white border border-navy/15 rounded-sm p-8 sm:p-12 shadow-sm space-y-8">
          
          {/* Action Bar */}
          <div className="flex justify-between items-center border-b border-navy/10 pb-4 text-xs">
            <span className="font-mono text-navy/60">Official Gazette Statutory Inscription</span>
            <StatuteActions slug={statute.slug} />
          </div>

          {/* Preamble */}
          <div className="p-6 bg-parchment-light border-l-4 border-gold rounded-sm space-y-2">
            <span className="text-[10px] font-mono text-gold uppercase tracking-wider font-bold block">
              Preamble & Legislative Intent:
            </span>
            <p className="text-xs sm:text-sm text-navy/80 font-serif italic leading-relaxed">
              &ldquo;{statute.preamble}&rdquo;
            </p>
          </div>

          {/* Enacted Articles */}
          <div className="space-y-6 pt-4">
            {statute.sections.map((sec, idx) => (
              <div key={idx} className="space-y-2 border-b border-navy/5 pb-6 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[10px] font-bold rounded-sm">
                    {sec.number}
                  </span>
                  <h3 className="text-base font-bold text-navy">{sec.heading}</h3>
                </div>
                <p className="text-xs sm:text-sm text-navy/80 leading-relaxed pl-1 font-serif">
                  {sec.text}
                </p>
              </div>
            ))}
          </div>

          {/* Promulgation & Signatory Seal Block */}
          <div className="pt-8 border-t-2 border-navy/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 text-xs">
              <span className="font-mono text-gold font-bold block">Enacting Promulgation Authority:</span>
              <p className="font-bold text-navy">{statute.signatory}</p>
              <span className="text-[11px] font-mono text-navy/50">Covenant Assembly Gazette Publication No. {statute.code}</span>
            </div>

            <div className="p-3 bg-navy text-parchment rounded-sm border border-gold/30 text-center font-mono text-[10px] space-y-1">
              <div className="text-gold font-bold flex items-center gap-1 justify-center">
                <ShieldCheck className="w-3 h-3" /> Promulgated & Inscribed
              </div>
              <div className="text-parchment/60">Verified on StableChain #0</div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
