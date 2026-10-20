'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { Placeholder } from '@/components/ui/Placeholder';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ArrowRight } from 'lucide-react';

const PHASES: { phase: string; title: string; now?: boolean; vision?: boolean; items: string[] }[] = [
  {
    phase: 'Phase 0',
    title: 'Now',
    now: true,
    items: ['A founding community forming', 'Digital institutions: this platform, the draft Constitution and the public record', 'StableChain on testnet'],
  },
  {
    phase: 'Phase 1',
    title: 'Foundations',
    items: ['The Founding Thesis published', 'Legal counsel engaged', 'Seastead engineering research'],
  },
  {
    phase: 'Phase 2',
    title: 'Design',
    items: ['Platform design and site survey', 'A development company formed', 'Seed funding'],
  },
  {
    phase: 'Phase 3',
    title: 'Pilot Platform',
    items: ['A pilot platform, built and owned by Aletheia', 'Seeking recognition from other states'],
  },
  {
    phase: 'Phase 4',
    title: 'First Residents',
    items: ['Licensed AEY issuance and the APN, on the pilot platform', 'The first residents'],
  },
  {
    phase: 'Vision',
    title: 'The Long Term',
    vision: true,
    items: ['Antioch and the maritime districts'],
  },
];

export default function RoadmapPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="Roadmap"
        image="coastSunrise"
        title="An Honest Roadmap"
        lead="How Aletheia intends to move from a founding community to its first platform, phase by phase. Each phase depends on the one before it."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-wrap items-center gap-3 text-sm text-navy/70">
            <span className="font-semibold text-navy">{t("Target dates:")}</span>
            <Placeholder>target dates</Placeholder>
          </div>

          <ol className="relative border-l-2 border-gold/40 ml-3 space-y-10">
            {PHASES.map(({ phase, title, now, vision, items }) => (
              <li key={phase} className="relative pl-8">
                <span
                  className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${now ? 'bg-gold border-gold' : vision ? 'bg-parchment-canvas border-navy/30' : 'bg-white border-gold'}`}
                  aria-hidden="true"
                />
                <div className="sovereign-card-premium rounded-sm p-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gold-shadow">{tx(phase)}</span>
                    <h2 className="text-lg font-bold text-navy">{tx(title)}</h2>
                    {now && <StatusBadge status="Under Development" size="sm" />}
                    {vision && <StatusBadge status="Vision" size="sm" />}
                  </div>
                  <ul className="space-y-1.5 text-sm text-navy/70 leading-relaxed list-disc pl-5">
                    {items.map((item) => (
                      <li key={item}>{tx(item)}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-xs text-navy/55 border-t border-navy/10 pt-6">{t("Aletheia is in its founding phase. It is not a recognised state, holds no territory and exercises no legal authority.")}</p>

          <div className="flex flex-wrap gap-3">
            <Link href="/founding-members" className="btn-sovereign-gold px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 group">
              <span>{t("Register interest as a Founding Member")}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/development#seastead" className="px-6 py-3 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:border-navy/40 transition-colors">{t("The Seastead")}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
