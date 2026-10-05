'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import type { ReactNode } from 'react';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import type { PhotoKey } from '@/lib/imagery';
import type { NationalStatus } from '@/lib/status';

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  image: PhotoKey;
  status?: NationalStatus;
  imagePosition?: string;
  children?: ReactNode;
}

/** Standard cinematic hero for public pages: photograph, eyebrow, headline, lead, actions. */
export function PageHero({ eyebrow, title, lead, image, status, imagePosition, children }: PageHeroProps) {
  const { tx } = useI18n();
  return (
    <section className="guilloche-hero relative overflow-hidden text-parchment border-b border-gold/30">
      <HeroBackdrop image={image} position={imagePosition} />
      <div className="orb-gold w-[520px] h-[520px] -top-48 -left-40 opacity-40 animate-orb-float-1" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-gold/35 bg-navy-deep/70 rounded-sm backdrop-blur-sm">
              <StarOfTruth size={14} />
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{tx(eyebrow)}</span>
            </div>
            {tx(status && <StatusBadge status={status} size="sm" />)}
          </div>

          <h1 className="heading-hero animate-fade-in-up delay-100">{tx(title)}</h1>

          <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light max-w-2xl animate-fade-in-up delay-200">
            {tx(lead)}
          </p>

          {tx(children && <div className="flex flex-wrap gap-4 pt-2 animate-fade-in-up delay-300">{tx(children)}</div>)}
        </div>
      </div>
    </section>
  );
}
