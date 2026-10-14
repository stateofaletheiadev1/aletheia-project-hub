'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Eye,
  Fingerprint,
  Globe,
  Info,
  Layers,
  Maximize2,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';

type Side = 'front' | 'back';

interface BanknoteSpec {
  value: number;
  words: string;
  colourway: string;
  accent: string;
  portrait: string;
  frontMotif: string;
  backMotif: string;
  backInscription: string;
}

/** Banknote series as designed in currency-proto/, lowest to highest denomination. */
const BANKNOTES: BanknoteSpec[] = [
  {
    value: 1,
    words: 'One Aletheian Guilder',
    colourway: 'Covenant Green & Gold',
    accent: '#2F5D3A',
    portrait: 'St. Benedict of Nursia',
    frontMotif: 'State Seal of Aletheia above the Open Book of the Covenant, with a North Sea skyline of wind turbines and a circular latent image of the numeral 1.',
    backMotif: 'A caravel under sail beside the hexagonal harbour of Antioch, framed by the Veritas · Iustitia · Foedus · Progressus seal.',
    backInscription: 'Latent image — hold to light',
  },
  {
    value: 5,
    words: 'Five Aletheian Guilders',
    colourway: 'Sovereign Blue',
    accent: '#2B3F9E',
    portrait: 'Nikola Tesla',
    frontMotif: 'Inventor and electromagnetic pioneer, surrounded by lightning-field engraving, the State Seal and the Open Book of Truth (Lux et Veritas).',
    backMotif: 'Offshore wind and the energy island of Benedict State under the Benedict State crest.',
    backInscription: 'Clean energy · sovereign future · North Sea legacy',
  },
  {
    value: 10,
    words: 'Ten Aletheian Guilders',
    colourway: 'Covenant Violet',
    accent: '#5B4A8B',
    portrait: 'Civic portrait with the Antioch seal',
    frontMotif: 'StableChain DAG lattice and entropy formula beside the Antioch crest, with a holographic stripe whose latent image is revealed at 45°.',
    backMotif: 'The concentric hexagonal masterplan of Antioch with the Aletheian Covenant State Seal and the Open Public Ledger.',
    backInscription: 'Open public ledger · cryptographic proof',
  },
  {
    value: 20,
    words: 'Twenty Aletheian Guilders',
    colourway: 'Augustine Sepia & Burgundy',
    accent: '#7A2E2A',
    portrait: 'St. Augustine of Hippo',
    frontMotif: 'Augustine holding De Civitate Dei before the planned National University and Medical Campus of Augustine State.',
    backMotif: 'The aerospace and cyber horizon of St. Barbara State, with the ADSS Cybersecurity Department emblem.',
    backInscription: 'Veritas in Foedere · proof is the baseline',
  },
  {
    value: 100,
    words: 'One Hundred Aletheian Guilders',
    colourway: 'Deep Forest & Burnished Gold',
    accent: '#1F3B2B',
    portrait: 'St. Brendan of Clonfert',
    frontMotif: 'Navigator of the North Sea and patron of St. Brendan State, holding a caravel above the Novalis capital district and the Open Book of the Covenant.',
    backMotif: 'The four founding states: St. Barbara, Augustine, Benedict and St. Brendan, beneath a hexagonal lattice.',
    backInscription: 'Ad astra · Lux · Natura · Aude navigare',
  },
];

const SECURITY_FEATURES = [
  {
    icon: Eye,
    title: 'Latent Images',
    body: 'Denomination numerals and hexagonal lattices appear only when the note is tilted to 45° or held to light.',
  },
  {
    icon: ScanLine,
    title: 'Microprint & Guilloche',
    body: 'Veritas in Foedere microtext and fine guilloche linework that cannot be reproduced by consumer scanners or printers.',
  },
  {
    icon: Fingerprint,
    title: 'Dual Serial Numbering',
    body: 'Each note carries matching serials in two positions, prefixed AEY and suffixed with the printing series letter.',
  },
  {
    icon: ShieldCheck,
    title: 'Reserve Bank Backing',
    body: 'Every note is issued by the Aletheian Reserve Bank, the central bank of the Sovereign Covenant State, and bears “100% Reserve Backed — StableChain Invariants I1–I12”, binding the design to the supply ledger.',
  },
];

const TENDER_FORMS = [
  {
    icon: Banknote,
    eyebrow: 'Paper',
    title: 'AEY Banknotes',
    body: 'Engraved notes for everyday cash payments in the Republic, for holders who want physical money rather than crypto, and for sale to nations, institutions and collectors.',
  },
  {
    icon: Zap,
    eyebrow: 'Digital',
    title: 'StableChain AEY',
    body: 'The same guilder as a digital balance on the Aletheia StableChain: final in about a second, citizen cards and wallets, and enterprise settlement.',
  },
  {
    icon: Globe,
    eyebrow: 'Exchange',
    title: 'EUR, GBP & USD Abroad',
    body: 'Outside the Republic, banknotes or StableChain AEY are exchanged for euros, pounds sterling or US dollars through the Aletheian Reserve Bank and its accredited exchange partners.',
  },
];

const noteSrc = (value: number, side: Side, thumb = false) =>
  `/images/currency/aey-${value}-${side}${thumb ? '-thumb' : ''}.webp`;

const NOTE_WIDTH = 1168;
const NOTE_HEIGHT = 784;

export default function AeyPaperCurrencyPage() {
  const { t, tx } = useI18n();
  const [selected, setSelected] = useState(BANKNOTES.length - 1);
  const [side, setSide] = useState<Side>('front');
  const [lightbox, setLightbox] = useState<{ index: number; side: Side } | null>(null);

  const note = BANKNOTES[selected];

  const selectNote = (index: number) => {
    setSelected(index);
    setSide('front');
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden border-b border-gold/30">
        <div className="orb-gold w-[520px] h-[520px] -top-32 -left-40 opacity-55 animate-orb-float-1" />
        <div className="orb-burgundy w-[380px] h-[380px] bottom-0 right-8 opacity-45 animate-orb-float-2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 z-10 w-full">
          <Link
            href="/aey"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/80 hover:text-gold transition-colors mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("The Aletheian Guilder (AEY)")}</span>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-7 animate-fade-in-up">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("AEY Banknote Series")}</span>
                </div>
                <StatusBadge status="Planned" size="sm" />
              </div>

              <h1 className="heading-hero">{t("The AEY")}<br />
                <span className="text-gold-metallic">{t("Paper Series")}</span></h1>

              <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light max-w-xl">{t("The Aletheian Guilder in paper: five engraved denominations that sit alongside digital AEY on the StableChain as legal tender in the Republic, and can be exchanged for EUR, GBP or USD abroad.")}</p>

              <div className="flex flex-wrap gap-4 pt-2">
                <a
                  href="#viewer"
                  className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm"
                >
                  <span>{t("View the Banknotes")}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <Link
                  href="/aey"
                  className="btn-sovereign-ghost px-6 py-3.5 rounded-sm flex items-center gap-2 text-sm"
                >{t("Back to the AEY Overview")}</Link>
              </div>
            </div>

            {/* Fanned stack of the series */}
            <div className="lg:col-span-6 animate-fade-in-up delay-200" aria-hidden="true">
              <div className="relative mx-auto w-full max-w-[560px] aspect-[1168/784]">
                {[1, 20, 100].map((value, i) => (
                  <div
                    key={value}
                    className="absolute inset-0 rounded-sm overflow-hidden border border-gold/30 shadow-2xl shadow-black/50"
                    style={{ transform: `translate(${(i - 1) * 6}%, ${(1 - i) * 7}%) rotate(${(i - 1) * 5}deg)`, zIndex: i }}
                  >
                    <Image
                      src={noteSrc(value, 'front', i < 2)}
                      alt=""
                      width={NOTE_WIDTH}
                      height={NOTE_HEIGHT}
                      priority={i === 2}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERIES AT A GLANCE ── */}
      <section className="bg-[#060C14] border-b border-gold/25 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-gold/15 gap-y-2">
            {[
              { value: '5', label: 'Denominations', sublabel: '1 · 5 · 10 · 20 · 100 AEY' },
              { value: 'EUR · GBP · USD', label: 'Exchangeable Abroad', sublabel: 'Notes or StableChain AEY' },
              { value: '2025 A', label: 'Banknote Series', sublabel: 'Issued at Novalis' },
              { value: '1:1', label: 'EUR Parity', sublabel: 'Same reserve as digital AEY' },
            ].map(({ value, label, sublabel }) => (
              <div key={label} className="px-6 py-4 text-center first:pl-0 last:pr-0 space-y-0.5">
                <div className="text-2xl font-bold font-mono text-gold tracking-tight">{tx(value)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-parchment/80">{tx(label)}</div>
                <div className="text-[10px] text-parchment/40 font-mono">{tx(sublabel)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ISSUE NOTICE ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-10">
        <div className="flex items-start gap-3 p-4 bg-white border border-gold/40 border-l-4 border-l-gold rounded-sm text-xs text-navy/80 leading-relaxed">
          <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p><strong className="text-navy">{t("Series 2025 A — planned issue.")}</strong>{' '}{t("These designs are approved for the first AEY banknote series under the Currency & Digital Settlement Act 2026. Once issued by the Aletheian Reserve Bank, the notes are legal tender alongside digital AEY; issue dates will be announced in the Official Gazette.")}</p>
        </div>
      </div>

      {/* ── INTERACTIVE BANKNOTE VIEWER ── */}
      <section id="viewer" className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Banknote Viewer")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Examine Each Note, Front and Back")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Select a denomination, flip the note to see its reverse, and open it full-screen to inspect the engraving.")}</p>
        </div>

        {/* Denomination selector */}
        <div role="tablist" aria-label={t("Denomination")} className="grid grid-cols-5 gap-2 sm:gap-4 mb-10">
          {BANKNOTES.map((n, i) => {
            const active = i === selected;
            return (
              <button
                key={n.value}
                type="button"
                role="tab"
                id={`note-tab-${n.value}`}
                aria-selected={active}
                aria-controls="note-panel"
                onClick={() => selectNote(i)}
                className={`group rounded-sm border p-1.5 sm:p-2 text-left transition-all bg-white ${active ? 'border-gold shadow-md ring-1 ring-gold' : 'border-navy/15 hover:border-gold/60'}`}
              >
                <div className="relative overflow-hidden rounded-[2px] aspect-[1168/784]">
                  <Image
                    src={noteSrc(n.value, 'front', true)}
                    alt=""
                    width={480}
                    height={322}
                    className={`w-full h-full object-cover transition-opacity ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                  />
                </div>
                <div className="pt-2 flex items-baseline justify-between gap-1">
                  <span className="text-sm sm:text-lg font-bold font-mono text-navy">{n.value}</span>
                  <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-gold">{t("AEY")}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div id="note-panel" role="tabpanel" aria-labelledby={`note-tab-${note.value}`} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Note stage */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-navy rounded-sm border border-gold/30 p-4 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

              <button
                type="button"
                onClick={() => setLightbox({ index: selected, side })}
                className="relative block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm [perspective:1800px]"
                aria-label={`${t("Open full-screen view")}: ${note.value} ${t("AEY")} — ${side === 'front' ? t("Front Side") : t("Back Side")}`}
              >
                <div
                  className={`relative w-full aspect-[1168/784] transition-transform duration-700 ease-out [transform-style:preserve-3d] ${side === 'back' ? '[transform:rotateY(180deg)]' : ''}`}
                >
                  {(['front', 'back'] as const).map((face) => (
                    <div
                      key={`${note.value}-${face}`}
                      className={`absolute inset-0 rounded-sm overflow-hidden shadow-2xl shadow-black/60 [backface-visibility:hidden] ${face === 'back' ? '[transform:rotateY(180deg)]' : ''}`}
                    >
                      <Image
                        src={noteSrc(note.value, face)}
                        alt={`${tx(note.words)} — ${face === 'front' ? t("Front Side") : t("Back Side")}`}
                        width={NOTE_WIDTH}
                        height={NOTE_HEIGHT}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-sm border border-navy/20 bg-white p-1" role="group" aria-label={t("Side")}>
                {(['front', 'back'] as const).map((face) => (
                  <button
                    key={face}
                    type="button"
                    aria-pressed={side === face}
                    onClick={() => setSide(face)}
                    className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[2px] transition-colors ${side === face ? 'bg-navy text-gold' : 'text-navy/60 hover:text-navy'}`}
                  >{face === 'front' ? t("Front Side") : t("Back Side")}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide(side === 'front' ? 'back' : 'front')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-navy/20 bg-white text-navy rounded-sm hover:border-gold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />{t("Flip Note")}
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox({ index: selected, side })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-gold text-navy rounded-sm hover:bg-gold-tint transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />{t("Full Screen")}
                </button>
              </div>
            </div>
          </div>

          {/* Note specification */}
          <aside className="lg:col-span-4 bg-white border border-navy/15 rounded-sm p-7 space-y-6 shadow-sm">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">{t("Series 2025 A")}</span>
              <h3 className="text-2xl font-bold text-navy">{note.value}{' '}{t("AEY")}</h3>
              <p className="text-xs text-navy/60">{tx(note.words)}</p>
            </div>

            <dl className="space-y-4 text-xs border-t border-navy/10 pt-5">
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold uppercase tracking-wider text-[11px] text-navy/60">{t("Colourway")}</dt>
                <dd className="flex items-center gap-2 text-navy font-semibold text-right">
                  <span className="w-3 h-3 rounded-full border border-navy/20 shrink-0" style={{ backgroundColor: note.accent }} />
                  {tx(note.colourway)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-bold uppercase tracking-wider text-[11px] text-navy/60">{t("Portrait")}</dt>
                <dd className="text-navy font-semibold text-right">{tx(note.portrait)}</dd>
              </div>
              <div className="space-y-1.5">
                <dt className="font-bold uppercase tracking-wider text-[11px] text-navy/60">{t("Front Side")}</dt>
                <dd className="text-navy/75 leading-relaxed">{tx(note.frontMotif)}</dd>
              </div>
              <div className="space-y-1.5">
                <dt className="font-bold uppercase tracking-wider text-[11px] text-navy/60">{t("Back Side")}</dt>
                <dd className="text-navy/75 leading-relaxed">{tx(note.backMotif)}</dd>
              </div>
            </dl>

            <div className="p-3 bg-navy-deep text-parchment rounded-sm border border-gold/30">
              <span className="text-[10px] font-mono uppercase text-gold block">{t("Reverse Inscription")}</span>
              <span className="text-xs font-serif italic text-parchment/85">{tx(note.backInscription)}</span>
            </div>
          </aside>
        </div>
      </section>

      {/* ── FULL SERIES GALLERY ── */}
      <section className="bg-white border-y border-navy/10 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-3">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("The Complete Series")}</span>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("All Ten Faces of the Series")}</h2>
            <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Every denomination is shown front and back exactly as engraved. Select any face to enlarge it.")}</p>
          </div>

          <div className="space-y-10">
            {BANKNOTES.map((n, i) => (
              <div key={n.value} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-2 flex lg:flex-col items-baseline lg:items-start gap-3 lg:gap-1">
                  <span className="text-4xl font-bold font-mono text-navy leading-none">{n.value}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gold">{t("AEY")}</span>
                  <span className="text-[11px] text-navy/60">{tx(n.colourway)}</span>
                </div>
                {(['front', 'back'] as const).map((face) => (
                  <button
                    key={face}
                    type="button"
                    onClick={() => setLightbox({ index: i, side: face })}
                    className="lg:col-span-5 group relative block rounded-sm overflow-hidden border border-navy/15 shadow-sm hover:shadow-lg transition-shadow cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    aria-label={`${t("Open full-screen view")}: ${tx(n.words)} — ${face === 'front' ? t("Front Side") : t("Back Side")}`}
                  >
                    <Image
                      src={noteSrc(n.value, face)}
                      alt=""
                      width={NOTE_WIDTH}
                      height={NOTE_HEIGHT}
                      loading="lazy"
                      className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-navy-deep/85 text-gold text-[10px] font-bold uppercase tracking-wider rounded-sm">{face === 'front' ? t("Front Side") : t("Back Side")}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAPER OR STABLECHAIN ── */}
      <section className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Paper or StableChain")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("One Guilder, Two Forms of Legal Tender")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Many nations, institutions and individuals still prefer physical currency to crypto. The AEY banknote gives them a tangible, reserve-backed guilder, while StableChain AEY serves instant digital settlement.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TENDER_FORMS.map(({ icon: Icon, eyebrow, title, body }) => (
            <div key={title} className="bg-white border border-navy/15 rounded-sm p-7 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">{tx(eyebrow)}</span>
                  <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                </div>
              </div>
              <p className="text-xs text-navy/70 leading-relaxed">{tx(body)}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-navy text-parchment rounded-sm border border-gold/30 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-6 items-center text-center">
            <div className="stat-tile p-4 rounded-sm space-y-1">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{t("In the Republic")}</span>
              <span className="text-sm font-bold text-parchment block">{t("AEY Banknotes")}</span>
            </div>
            <ArrowLeftRight className="w-5 h-5 text-gold mx-auto rotate-90 md:rotate-0" aria-hidden="true" />
            <div className="stat-tile p-4 rounded-sm space-y-1">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{t("In the Republic")}</span>
              <span className="text-sm font-bold text-parchment block">{t("StableChain AEY")}</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gold mx-auto rotate-90 md:rotate-0" aria-hidden="true" />
            <div className="stat-tile p-4 rounded-sm space-y-1">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{t("Abroad")}</span>
              <span className="text-sm font-bold font-mono text-parchment block">EUR · GBP · USD</span>
            </div>
          </div>
          <p className="mt-5 text-[11px] font-mono text-parchment/55 text-center leading-relaxed">{t("Notes and StableChain AEY convert 1:1 at par. EUR at the fixed constitutional parity; GBP and USD at the Aletheian Reserve Bank reference rate.")}</p>
        </div>
      </section>

      {/* ── SECURITY FEATURES ── */}
      <section className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Anti-Counterfeit Design")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Security Features")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("The engraving carries the same guarantees as the digital AEY: provable backing and verifiable provenance.")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white border border-navy/15 rounded-sm p-6 space-y-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{tx(body)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <Layers className="w-9 h-9 text-gold mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("One Guilder, Paper or Digital")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Every AEY, engraved or on the Aletheia StableChain, is backed by the same audited reserve. Explore the digital currency and the reserve behind both.")}</p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/aey"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />{t("Back to the AEY Overview")}
            </Link>
            <Link
              href="/central-bank"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Reserve Bank Architecture")}</Link>
          </div>
        </div>
      </section>

      {lightbox && (
        <Lightbox
          index={lightbox.index}
          side={lightbox.side}
          onChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

interface LightboxProps {
  index: number;
  side: Side;
  onChange: (next: { index: number; side: Side }) => void;
  onClose: () => void;
}

/** Full-screen viewer stepping through every face of the series in order. */
function Lightbox({ index, side, onChange, onClose }: LightboxProps) {
  const { t, tx } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const faces = BANKNOTES.length * 2;
  const position = index * 2 + (side === 'back' ? 1 : 0);
  const note = BANKNOTES[index];

  const step = useCallback((delta: number) => {
    const next = (position + delta + faces) % faces;
    onChange({ index: Math.floor(next / 2), side: next % 2 ? 'back' : 'front' });
  }, [position, faces, onChange]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const faceLabel = side === 'front' ? t("Front Side") : t("Back Side");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tx(note.words)} — ${faceLabel}`}
      className="fixed inset-0 z-[100] bg-[#060C14]/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 text-parchment" onClick={(e) => e.stopPropagation()}>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-gold block">{t("Series 2025 A")}</span>
          <span className="text-sm font-bold">{note.value}{' '}{t("AEY")} · {faceLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-parchment/50">{position + 1} / {faces}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="w-9 h-9 flex items-center justify-center rounded-sm border border-gold/30 text-parchment hover:border-gold hover:text-gold transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-8 pb-8">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); step(-1); }}
          aria-label={t("Previous")}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-sm border border-gold/30 text-parchment hover:border-gold hover:text-gold transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="relative h-full w-full max-w-[1168px] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Image
            key={`${note.value}-${side}`}
            src={noteSrc(note.value, side)}
            alt={`${tx(note.words)} — ${faceLabel}`}
            width={NOTE_WIDTH}
            height={NOTE_HEIGHT}
            className="max-h-full w-auto max-w-full object-contain rounded-sm shadow-2xl shadow-black/70 border border-gold/20"
          />
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); step(1); }}
          aria-label={t("Next")}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-sm border border-gold/30 text-parchment hover:border-gold hover:text-gold transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
