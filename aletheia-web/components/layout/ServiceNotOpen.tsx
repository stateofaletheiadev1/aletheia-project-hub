'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { ArrowRight } from 'lucide-react';

/**
 * Shown in place of a service that has no live system behind it yet (the Citizen Portal and
 * Officer Administration). Nothing is simulated: no sign-in, no sample accounts, no figures.
 */
const COPY = {
  portal: {
    eyebrow: 'Citizen Portal · Not yet open',
    title: 'The Citizen Portal is not open yet.',
    body: 'No citizen or e-resident accounts have been issued, and applications are not yet accepted online. The opening of the portal will be announced in the Official Gazette.',
    links: [
      { label: 'Citizenship', href: '/citizenship' },
      { label: 'E-Residency', href: '/e-residency' },
      { label: 'Official Gazette', href: '/news' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  admin: {
    eyebrow: 'Officer Administration · Not yet open',
    title: 'Officer Administration is not open yet.',
    body: 'The national registries hold no records yet, so there is nothing to administer. Officer accounts will be issued by the founding government when the registries open.',
    links: [
      { label: 'Government', href: '/government' },
      { label: 'Official Gazette', href: '/news' },
      { label: 'Contact', href: '/contact' },
    ],
  },
} as const;

export function ServiceNotOpen({ area }: { area: keyof typeof COPY }) {
  const { t, tx } = useI18n();
  const c = COPY[area];
  return (
    <section className="guilloche-hero relative overflow-hidden text-parchment min-h-[80vh] flex items-center">
      <HeroBackdrop image="oceanWave" intensity={0.4} />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-8">
        <Image
          src="/coat_of_arms_transparent.png"
          alt={t('Coat of Arms of Aletheia')}
          width={88}
          height={104}
          className="mx-auto object-contain drop-shadow-2xl"
        />
        <div className="space-y-3">
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-gold">{tx(c.eyebrow)}</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{tx(c.title)}</h1>
          <p className="text-parchment/70 leading-relaxed max-w-xl mx-auto font-light">{tx(c.body)}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {c.links.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-parchment/15 rounded-sm text-parchment/75 hover:text-gold hover:border-gold/50 backdrop-blur-sm transition-all"
            >
              {tx(d.label)}
            </Link>
          ))}
        </div>
        <Link href="/" className="btn-sovereign-gold inline-flex items-center gap-2 px-8 py-4 rounded-sm text-sm">
          {t('Return to the homepage')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
