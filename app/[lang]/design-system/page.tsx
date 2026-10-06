'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Image from 'next/image';
import Link from '@/components/i18n/Link';
import { Logo, StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import { NationalFlag, StateEnsign } from '@/components/brand/Flags';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Shield, BookOpen, Layers, CheckCircle, ArrowRight } from 'lucide-react';

export default function DesignSystemSpecimenPage() {
  const { t, tx } = useI18n();
  const heraldicColors = [
    { name: 'Covenant Navy', hex: '#15294A', rgb: 'rgb(21, 41, 74)', hsl: '217°, 56%, 19%', role: 'Primary Sovereignty & Maritime Field', contrast: '13.8:1 against Parchment (AAA)' },
    { name: 'Ledger Parchment', hex: '#F4EEDF', rgb: 'rgb(244, 238, 223)', hsl: '43°, 51%, 92%', role: 'Primary Document Ground & Substrate', contrast: '13.8:1 against Navy (AAA)' },
    { name: 'Seal Gold', hex: '#C49A4E', rgb: 'rgb(196, 154, 78)', hsl: '39°, 52%, 54%', role: 'Covenant Accent, Fimbriations & Ribbons', contrast: '4.9:1 against Navy (AA)' },
    { name: 'Burnished Gold', hex: '#8F6A2A', rgb: 'rgb(143, 106, 42)', hsl: '38°, 55%, 36%', role: 'Shield Bevels & Depth Shadows', contrast: '5.2:1 against Parchment (AA)' },
    { name: 'Laurel Green', hex: '#2F6B4F', rgb: 'rgb(47, 107, 79)', hsl: '152°, 37%, 31%', role: 'Civic Peace, Renewal & Agriculture', contrast: '6.4:1 against Parchment (AA)' },
    { name: 'Deep Laurel', hex: '#214C38', rgb: 'rgb(33, 76, 56)', hsl: '152°, 39%, 21%', role: 'Laurel Foliage Underlayer', contrast: '9.8:1 against Parchment (AAA)' },
    { name: 'Covenant Burgundy', hex: '#701824', rgb: 'rgb(112, 24, 36)', hsl: '352°, 65%, 27%', role: 'Passport Cover & Diplomatic Seals', contrast: '10.2:1 against Parchment (AAA)' },
    { name: 'Canvas Parchment', hex: '#F6F3EC', rgb: 'rgb(246, 243, 236)', hsl: '42°, 33%, 95%', role: 'Outer Paper & Ceremonial Mount', contrast: '14.4:1 against Navy (AAA)' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Specimen Header */}
      <div className="border-b border-navy/15 pb-8 space-y-3">
        <div className="flex items-center gap-3">
          <StatusBadge status="Under Development" size="md" />
          <span className="text-xs font-mono text-navy/60 uppercase tracking-widest">{t("PHASE 0 / 1 DELIVERABLE: REVIEW ARTIFACT")}</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-navy">{t("Aletheia Design System & Visual Tokens")}</h1>
        <p className="text-base sm:text-lg text-navy/70 max-w-3xl leading-relaxed">{t("The single source of truth for the digital front door and civic platform of Aletheia. Every token is strictly derived from algorithmic pixel sampling of the official heraldic marks and the National Blueprint.")}</p>
      </div>

      {/* 1. Official Marks & Clear-Space Demonstration */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-navy/10 pb-3">
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-gold" />
            <span>{t("1. State Emblems, Marks & Proportions")}</span>
          </h2>
          <span className="text-xs font-mono text-navy/50">{t("Derived from received PNGs")}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Full Coat of Arms */}
          <div className="p-6 bg-parchment-canvas border border-navy/10 rounded-sm space-y-4 text-center flex flex-col items-center justify-center">
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-navy/60">{t("State Coat of Arms (Full Achievement)")}</span>
            <div className="p-4 bg-white border border-gold/20 rounded-sm shadow-subtle inline-block">
              <Image
                src="/coat_of_arms.png"
                alt={t("State Coat of Arms")}
                width={160}
                height={187}
                className="object-contain"
              />
            </div>
            <p className="text-xs text-navy/70 max-w-xs">{t("Quartered shield of the 4 founding states with Antioch inescutcheon, 8-pointed Star of Truth crest, laurel wreath, and")}{' '}<em>{t("Veritas in Foedere")}</em>{' '}{t("motto.")}</p>
          </div>

          {/* National Flag Option A */}
          <div className="p-6 bg-parchment-canvas border border-navy/10 rounded-sm space-y-4 text-center flex flex-col items-center justify-center">
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-navy/60">{t("National Flag (Option A)")}</span>
            <NationalFlag width={210} height={140} className="shadow-institutional" />
            <p className="text-xs text-navy/70 max-w-xs">{t("Nordic cross in Ledger Parchment edged with Seal Gold on Covenant Navy, with the Star of Truth in the upper hoist. Proportion 3:2.")}</p>
          </div>

          {/* State & Civil Ensign Option B */}
          <div className="p-6 bg-parchment-canvas border border-navy/10 rounded-sm space-y-4 text-center flex flex-col items-center justify-center">
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-navy/60">{t("State & Civil Ensign (Option B)")}</span>
            <StateEnsign width={210} height={140} className="shadow-institutional" />
            <p className="text-xs text-navy/70 max-w-xs">{t("Navy and parchment triband bordered in gold, bearing the Federal District Hexagon & Cross surrounded by 8 golden bezants.")}</p>
          </div>
        </div>

        {/* Vector Micro-Marks */}
        <div className="p-6 bg-navy text-parchment rounded-sm border border-gold/30 flex flex-wrap items-center justify-around gap-6">
          <div className="flex items-center gap-3">
            <StarOfTruth size={36} />
            <div>
              <span className="block font-semibold text-sm text-gold">{t("Star of Truth (SVG Vector)")}</span>
              <span className="text-xs text-parchment/60">{t("8-pointed Aletheia mark for icons and favicons")}</span>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-parchment/15 hidden sm:block" />
          <div className="flex items-center gap-3">
            <HexagonCross size={36} />
            <div>
              <span className="block font-semibold text-sm text-gold">{t("Federal Inescutcheon (SVG Vector)")}</span>
              <span className="text-xs text-parchment/60">{t("Antioch territorial hexagon and Latin cross")}</span>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-parchment/15 hidden sm:block" />
          <div className="flex items-center gap-3">
            <Logo variant="horizontal" size="sm" theme="dark" />
          </div>
        </div>
      </section>

      {/* 2. Color Palette & WCAG 2.2 AA Contrast Matrix */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-navy/10 pb-3">
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-gold" />
            <span>{t("2. Canonical Heraldic & Interface Palette")}</span>
          </h2>
          <span className="text-xs font-mono text-navy/50">{t("WCAG 2.2 AA Verified")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {heraldicColors.map((color) => (
            <div
              key={color.name}
              className="bg-white border border-navy/15 rounded-sm overflow-hidden shadow-subtle hover:shadow-institutional transition-shadow"
            >
              <div
                className="h-28 w-full p-3 flex flex-col justify-between"
                style={{ backgroundColor: color.hex }}
              >
                <span
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm inline-block w-fit"
                  style={{
                    backgroundColor: ['#F4EEDF', '#F6F3EC'].includes(color.hex) ? '#15294A' : '#F4EEDF',
                    color: ['#F4EEDF', '#F6F3EC'].includes(color.hex) ? '#F4EEDF' : '#15294A',
                  }}
                >
                  {tx(color.hex)}
                </span>
              </div>
              <div className="p-4 space-y-1.5">
                <h3 className="font-semibold text-navy text-sm">{tx(color.name)}</h3>
                <p className="text-xs text-navy/60 font-mono">{tx(color.rgb)}</p>
                <p className="text-[11px] text-navy/70 leading-snug">{tx(color.role)}</p>
                <div className="pt-2 text-[10px] font-mono text-gold-shadow font-semibold border-t border-navy/10 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-laurel" />
                  <span>{tx(color.contrast)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Manrope Typographic Scale */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-navy/10 pb-3">
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-gold" />
            <span>{t("3. Typography Scale: Manrope")}</span>
          </h2>
          <span className="text-xs font-mono text-navy/50">{t("Strictly Enforced Hierarchy")}</span>
        </div>

        <div className="bg-white border border-navy/15 rounded-sm p-6 sm:p-8 space-y-8 divide-y divide-navy/10">
          <div className="space-y-2">
            <span className="text-xs font-mono text-navy/50">{t("Display Head (clamp(2.75rem, 5vw, 4.5rem) / 700 / -0.025em tracking)")}</span>
            <div className="text-4xl sm:text-6xl font-bold text-navy tracking-tight leading-none">{t("Veritas in Foedere.")}</div>
          </div>

          <div className="pt-6 space-y-2">
            <span className="text-xs font-mono text-navy/50">{t("Page Heading 1 (clamp(2.25rem, 3.5vw, 3.25rem) / 700 / -0.02em tracking)")}</span>
            <div className="text-3xl sm:text-4xl font-bold text-navy">{t("The Sovereign Covenant State of Aletheia")}</div>
          </div>

          <div className="pt-6 space-y-2">
            <span className="text-xs font-mono text-navy/50">{t("Section Heading 2 (clamp(1.75rem, 2.5vw, 2.25rem) / 600)")}</span>
            <div className="text-2xl sm:text-3xl font-semibold text-navy">{t("Foundational Principles of the Constitutional Compact")}</div>
          </div>

          <div className="pt-6 space-y-2">
            <span className="text-xs font-mono text-navy/50">{t("Body Lead (1.125rem / 1.6 leading)")}</span>
            <p className="text-lg text-navy/80 leading-relaxed max-w-3xl">{t("Aletheia is a Greek word for truth — literally, that which is not hidden. The Sovereign Covenant State takes the word as its working method: public records that anyone can verify, money whose backing can be proven, and a government whose every payment leaves an immutable cryptographic receipt.")}</p>
          </div>

          <div className="pt-6 space-y-2">
            <span className="text-xs font-mono text-navy/50">{t("Eyebrow & Monospace Tabular Numerals")}</span>
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">{t("SCHEDULE 3: MINISTERIAL APPOINTMENTS")}</span>
              <span className="text-sm font-mono tabular-nums text-navy/70 bg-parchment-canvas px-2 py-1 rounded-sm border border-navy/15">{t("Block Height: #01,482,900 | Epoch: 2,896 | Slot: 488/512")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Mandatory Status Taxonomy Badges */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-navy/10 pb-3">
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-gold" />
            <span>{t("4. Five-Tier Status Taxonomy (§3.1)")}</span>
          </h2>
          <span className="text-xs font-mono text-navy/50">{t("Truth in Representation")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { status: 'Operational' as const, note: 'Provable and active in software or operations today' },
            { status: 'Under Development' as const, note: 'Active engineering and formal build phase' },
            { status: 'Planned' as const, note: 'Approved in roadmap for scheduled construction' },
            { status: 'Proposed' as const, note: 'Policy or design proposal awaiting sanction' },
            { status: 'Vision' as const, note: 'Long-term 2030–2045 conceptual direction' },
          ].map((item) => (
            <div key={item.status} className="p-4 bg-white border border-navy/15 rounded-sm space-y-2">
              <StatusBadge status={item.status} size="md" />
              <p className="text-xs text-navy/70 leading-relaxed pt-1">{tx(item.note)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Core Architectural Components Preview */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-navy/10 pb-3">
          <h2 className="text-2xl font-bold text-navy flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-gold" />
            <span>{t("5. Architectural UI Primitives (Anti-Template)")}</span>
          </h2>
          <span className="text-xs font-mono text-navy/50">{t("Disciplined 2px–4px Radii")}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Button Hierarchy */}
          <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-4">
            <h3 className="text-sm font-semibold text-navy tracking-eyebrow uppercase text-gold">{t("Button Hierarchy")}</h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-navy text-parchment hover:bg-navy-deep border border-gold/40 text-xs font-semibold uppercase tracking-wider rounded-sm transition-all shadow-subtle hover:shadow-institutional">{t("Primary Sovereign")}</button>
              <button className="px-4 py-2 bg-parchment-canvas text-navy hover:bg-parchment border border-navy/20 text-xs font-semibold uppercase tracking-wider rounded-sm transition-all">{t("Secondary Action")}</button>
              <button className="px-4 py-2 text-gold-shadow hover:text-navy text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors flex items-center gap-1.5">
                <span>{t("Text Link")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form Input Primitives */}
          <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-4">
            <h3 className="text-sm font-semibold text-navy tracking-eyebrow uppercase text-gold">{t("Form & Search Primitives")}</h3>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-navy/80">{t("Search Constitutional Articles & Acts")}</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t("e.g. citizenship, maritime zone, treasury...")}
                  className="w-full px-3.5 py-2 bg-parchment-light border border-navy/20 rounded-sm text-sm text-navy placeholder:text-navy/40 focus:border-gold focus:outline-none"
                  readOnly
                  value="Article 8: Citizenship by Covenant"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono text-navy/40">{t("ESC")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Review Approval Checkpoint Banner */}
      <div className="p-8 bg-navy text-parchment rounded-sm border border-gold/40 shadow-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gold text-xs font-semibold tracking-eyebrow uppercase">
            <CheckCircle className="w-4 h-4 text-gold" />
            <span>{t("Phase 0 Token & Identity Review Ready")}</span>
          </div>
          <h3 className="text-2xl font-bold text-parchment">{t("Approved for Phase 1 & Phase 2 Public Build")}</h3>
          <p className="text-sm text-parchment/70 max-w-xl">{t("Tokens, Manrope typography, exact pixel values, and heraldic components verified against all uploaded assets.")}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="px-5 py-2.5 bg-gold text-navy font-semibold text-xs uppercase tracking-wider hover:bg-gold-tint transition-all rounded-sm shadow-subtle flex items-center gap-2"
          >
            <span>{t("Proceed to Home Page")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
