'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SpecimenWatermark } from '@/components/ui/SpecimenWatermark';
import { Cpu, FileCheck2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const DESIGN_LAYERS: { icon: 'eye' | 'file' | 'chip'; title: string; items: [string, string][] }[] = [
  {
    icon: 'eye',
    title: 'Layer 1: Visible Design',
    items: [
      ['Covenant Burgundy cover:', 'Gold foil with a debossed seal.'],
      ['Data page:', 'A laser-engraved polycarbonate page is envisaged.'],
      ['Colour-shifting emblem:', 'The Star of Truth, moving from gold to emerald at tilt.'],
      ['Guilloche:', 'Fine line engravings in the background of every page.'],
    ],
  },
  {
    icon: 'file',
    title: 'Layer 2: Machine Reading',
    items: [
      ['Machine-readable zone:', 'Two lines of OCR-B text, in the conventional layout.'],
      ['Ultraviolet features:', 'Caravel motifs visible only under UV light.'],
      ['Micro-text:', 'The Latin text of Article 1 of the Covenant in the borders.'],
      ['Ghost portrait:', 'A secondary image visible against transmitted light.'],
    ],
  },
  {
    icon: 'chip',
    title: 'Layer 3: Electronic Chip',
    items: [
      ['Contactless chip:', 'A secure microcontroller holding the holder’s data.'],
      ['Biometric data:', 'Facial image, and fingerprints where the law requires them.'],
      ['Signed data:', 'Elliptic-curve signatures, so a copy cannot pass as genuine.'],
      ['Public keys:', 'Signing certificates to be published for border systems, if a document is ever issued.'],
    ],
  },
];

const DESIGN_PARAMETERS: [string, string][] = [
  ['Document type', 'Ordinary travel document (design concept)'],
  ['Format', 'Booklet, 88 mm × 125 mm, 32 or 48 pages'],
  ['Cover', 'Covenant Burgundy (#701824) with gold foil'],
  ['Data page', 'Polycarbonate with laser engraving'],
  ['Chip security', 'Modern access control and chip authentication'],
  ['Validity', 'To be set by law, if a document is ever issued'],
];

function LayerIcon({ icon }: { icon: 'eye' | 'file' | 'chip' }) {
  if (icon === 'file') return <FileCheck2 className="w-5 h-5" />;
  if (icon === 'chip') return <Cpu className="w-5 h-5" />;
  return <EyeIcon className="w-5 h-5" />;
}

export default function TravelDocumentDesignPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-32 border-b border-gold/30">
        <HeroBackdrop image="flight" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Design Concept")}</span>
                </div>
                <StatusBadge status="Proposed" size="sm" />
              </div>

              <h1 className="heading-hero">{t("Design Concept: Aletheian Travel Document")}</h1>

              <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light max-w-2xl">{t("A design concept for a future Aletheian travel document, designed with reference to international travel-document conventions. It is not a travel document, none has been issued, and none will be issued unless Aletheia is established by treaty and has the lawful authority to do so.")}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                {[
                  ['Format', 'Booklet'],
                  ['Data Page', 'Polycarbonate'],
                  ['Status', 'Design only'],
                ].map(([label, value]) => (
                  <div key={label} className="p-3 bg-navy-deep/60 border border-navy/30 rounded-sm">
                    <span className="text-[10px] font-mono uppercase text-gold block">{tx(label)}</span>
                    <span className="text-xs font-bold text-parchment">{tx(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cover — overprinted as a specimen */}
            <div className="lg:col-span-5 flex justify-center">
              <figure className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-covenant-burgundy/40 to-gold/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
                <div className="relative">
                  <div className="relative overflow-hidden">
                    <Image
                      src="/passport_cover.png"
                      alt={t("Design concept for the cover of an Aletheian travel document, in Covenant Burgundy")}
                      width={320}
                      height={447}
                      className="object-contain"
                      style={{ filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.6)) drop-shadow(0 8px 16px rgba(112,24,36,0.4))' }}
                      priority
                    />
                    <SpecimenWatermark />
                  </div>
                  <figcaption className="mt-4 text-center">
                    <span className="inline-block px-3 py-1 bg-navy-deep/90 border border-gold/30 rounded-full text-[10px] font-mono text-gold tracking-widest uppercase">{t("Specimen · Design concept")}</span>
                  </figcaption>
                </div>
              </figure>
            </div>

          </div>
        </div>
      </section>

      {/* ── WHAT THIS IS ── */}
      <section className="bg-parchment-light border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div role="note" className="flex items-start gap-3 border-l-[3px] border-l-burgundy bg-white border border-navy/10 rounded-sm px-5 py-4 text-sm text-navy/75 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-burgundy shrink-0 mt-0.5" aria-hidden="true" />
            <p>{t("Aletheia does not issue passports or any other travel or identity document, and does not sell them. Any document offered in Aletheia’s name is not genuine.")}</p>
          </div>
        </div>
      </section>

      {/* ── DESIGN LAYERS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Design Study")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight">{t("Three Layers of Security, by Design")}</h2>
          <p className="text-sm text-navy/70 leading-relaxed">{t("How the design concept layers physical, machine-readable and electronic features. These describe a design, not a produced document.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {DESIGN_LAYERS.map((layer) => (
            <div key={layer.title} className="feature-card rounded-sm p-6 space-y-4 group">
              <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                <LayerIcon icon={layer.icon} />
              </div>
              <h3 className="text-base font-bold text-navy">{tx(layer.title)}</h3>
              <ul className="space-y-2.5 text-xs text-navy/70 leading-relaxed">
                {layer.items.map(([term, desc]) => (
                  <li key={term} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                    <span><strong>{tx(term)}</strong>{' '}{tx(desc)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── DESIGN PARAMETERS ── */}
      <section className="py-16 bg-parchment-light border-y border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-8 space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Design Parameters")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Concept in Figures")}</h2>
            <p className="text-xs sm:text-sm text-navy/70">{t("Working parameters of the design concept. None is a legal specification.")}</p>
          </div>

          <div className="bg-white border border-navy/15 rounded-sm overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy text-parchment font-mono uppercase tracking-wider text-[11px] border-b border-navy/20">
                    <th scope="col" className="p-4">{t("Parameter")}</th>
                    <th scope="col" className="p-4">{t("Design Concept")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/10">
                  {DESIGN_PARAMETERS.map(([param, value]) => (
                    <tr key={param} className="hover:bg-parchment-light/60">
                      <th scope="row" className="p-4 font-semibold text-navy">{tx(param)}</th>
                      <td className="p-4 text-navy/80">{tx(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Citizenship Comes First")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Citizenship will be conferred only by birth or naturalisation, under a founding treaty. Until then, you can join the founding community.")}</p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/founding-members"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Register interest as a Founding Member")}</Link>
            <Link
              href="/citizenship"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Proposed Citizenship Standards")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
