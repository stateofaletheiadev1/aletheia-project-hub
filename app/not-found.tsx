import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { ArrowRight, Compass } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

const DESTINATIONS = [
  { label: 'The Constitution', href: '/constitution' },
  { label: 'Citizenship', href: '/citizenship' },
  { label: 'E-Residency', href: '/e-residency' },
  { label: 'Official Gazette', href: '/news' },
  { label: 'Government', href: '/government' },
  { label: 'Contact', href: '/contact' },
];

export default function NotFound() {
  return (
    <section className="guilloche-hero relative overflow-hidden text-parchment min-h-[80vh] flex items-center">
      <HeroBackdrop image="oceanWave" intensity={0.4} />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-8">
        <Image
          src="/coat_of_arms_transparent.png"
          alt="Coat of Arms of Aletheia"
          width={88}
          height={104}
          className="mx-auto object-contain drop-shadow-2xl animate-float"
        />
        <div className="space-y-3 animate-fade-in-up">
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-gold">Error 404 · Uncharted waters</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">This page is not on the register.</h1>
          <p className="text-parchment/70 leading-relaxed max-w-xl mx-auto font-light">
            The address may have moved, or it was never promulgated. Every public record of the Covenant State is reachable from the destinations below.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 animate-fade-in-up delay-200">
          {DESTINATIONS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-parchment/15 rounded-sm text-parchment/75 hover:text-gold hover:border-gold/50 backdrop-blur-sm transition-all"
            >
              {d.label}
            </Link>
          ))}
        </div>
        <Link href="/" className="btn-sovereign-gold inline-flex items-center gap-2 px-8 py-4 rounded-sm text-sm animate-fade-in-up delay-300">
          <Compass className="w-4 h-4" /> Return to the homepage <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
