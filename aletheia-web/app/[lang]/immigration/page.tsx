'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ImageCaption } from '@/components/ui/ImageCaption';
import {
  ShieldCheck,
  Plane,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const VISA_TYPES = [
  {
    id: 'eta',
    title: 'Electronic Travel Authorisation (A-ETA)',
    category: 'Short Stay (up to 90 days)',
    status: 'Proposed' as const,
    fee: 'To be set by law',
    processingTime: 'To be set by law',
    desc: 'Proposed digital clearance for visits, conferences and business meetings in a future Aletheian territory.',
    requirements: ['A valid passport', 'A return ticket', 'Health insurance'],
  },
  {
    id: 'res-tech',
    title: 'Innovation & Research Residence Permit',
    category: 'Long Stay (1 to 3 years)',
    status: 'Proposed' as const,
    fee: 'To be set by law',
    processingTime: 'To be set by law',
    desc: 'Proposed for engineers, researchers and academics working in a future Aletheian territory.',
    requirements: ['Accredited contract or sponsor', 'Police clearance certificate', 'Biometric enrolment'],
  },
  {
    id: 'res-invest',
    title: 'Enterprise Residence Permit',
    category: 'Long Stay (Renewable)',
    status: 'Proposed' as const,
    fee: 'To be set by law',
    processingTime: 'To be set by law',
    desc: 'For founders running real businesses within an Aletheian territory. Residence would never be granted for payment alone.',
    requirements: ['A business operating within the territory', 'Police clearance certificate', 'Lawful source of funds'],
  },
  {
    id: 'perm-res',
    title: 'Permanent Covenant Residence',
    category: 'Indefinite Physical Settlement',
    status: 'Vision' as const,
    fee: 'To be set by law',
    processingTime: 'To be set by law',
    desc: 'Would convey the indefinite right to reside, work and study, and would be the step before naturalisation.',
    requirements: ['3 years lawful continuous physical residence', 'Civic Integration assessment', 'No serious criminal infractions'],
  },
];

export default function ImmigrationPage() {
  const { t, tx } = useI18n();
  const [selectedPurpose, setSelectedPurpose] = useState('all');

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-36 border-b border-gold/30">
        <div className="absolute inset-0">
          <Image
            src="/images/autonomous_harbor.jpg"
            alt=""
            fill
            className="object-cover opacity-20 mix-blend-luminosity"
            priority
          />
          <ImageCaption kind="design" position="bottom-right" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Immigration & Residence · Proposed")}</span>
              </div>
              <StatusBadge asset="residence" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Immigration & Residence")}</h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light max-w-2xl">{t("A proposed system of visas and residence permits for a future Aletheian territory, secured by treaty. Nothing on this page is open: no visa or permit can be applied for, and none is issued.")}</p>

            <div className="p-4 bg-navy-deep/80 border border-gold/25 rounded-sm flex items-start gap-3 max-w-2xl">
              <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="text-xs text-parchment/80 leading-relaxed">
                <strong className="text-parchment block mb-0.5">{t("Crucial Legal Distinction: E-Residency vs. Physical Immigration")}</strong>{t("E-residency, as proposed, would be a digital identity for company formation and online services. It would confer")}{' '}<em>{t("no physical right to enter or reside")}</em>{' '}{t("in Aletheia.")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BORDER PILLARS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-navy text-gold rounded-sm border border-gold/30 shrink-0">
                <Plane className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-parchment">{t("Automated e-Gates")}</h4>
                <p className="text-xs text-parchment/60 leading-relaxed">{t("Proposed: paperless biometric entry at the ports of a future territory.")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-navy text-gold rounded-sm border border-gold/30 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-parchment">{t("Predictable Timelines")}</h4>
                <p className="text-xs text-parchment/60 leading-relaxed">{t("Proposed: statutory deadlines for every decision, with reasons given.")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-navy text-gold rounded-sm border border-gold/30 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-parchment">{t("Judicial Appeal Right")}</h4>
                <p className="text-xs text-parchment/60 leading-relaxed">{t("Proposed: every visa decision open to review by an independent appeals board.")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERMITS DIRECTORY ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Proposed Categories")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Proposed Visas & Residence Permits")}</h2>
            <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Visas and permits proposed in a draft Immigration Act. None is available.")}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedPurpose('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                selectedPurpose === 'all'
                  ? 'bg-navy text-gold'
                  : 'bg-white border border-navy/15 text-navy/70 hover:border-gold/40'
              }`}
            >{t("All Permits")}</button>
            <button
              onClick={() => setSelectedPurpose('short')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                selectedPurpose === 'short'
                  ? 'bg-navy text-gold'
                  : 'bg-white border border-navy/15 text-navy/70 hover:border-gold/40'
              }`}
            >{t("Short Stay")}</button>
            <button
              onClick={() => setSelectedPurpose('long')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                selectedPurpose === 'long'
                  ? 'bg-navy text-gold'
                  : 'bg-white border border-navy/15 text-navy/70 hover:border-gold/40'
              }`}
            >{t("Long Stay / Residence")}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {VISA_TYPES.filter((item) => {
            if (selectedPurpose === 'short') return item.id === 'eta';
            if (selectedPurpose === 'long') return item.id !== 'eta';
            return true;
          }).map((visa) => (
            <div
              key={visa.id}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">
                      {tx(visa.category)}
                    </span>
                    <h3 className="text-base font-bold text-navy mt-0.5">{tx(visa.title)}</h3>
                  </div>
                  <StatusBadge status={visa.status} size="sm" />
                </div>

                <p className="text-xs text-navy/70 leading-relaxed">{tx(visa.desc)}</p>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-navy/10 text-xs">
                  <div>
                    <span className="text-[10px] text-navy/50 uppercase block font-mono">{t("Fee")}</span>
                    <span className="font-bold text-navy">{tx(visa.fee)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-navy/50 uppercase block font-mono">{t("Processing Time")}</span>
                    <span className="font-bold text-navy">{tx(visa.processingTime)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Core Prerequisites:")}</span>
                  <ul className="space-y-1 text-xs text-navy/65">
                    {visa.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0" />
                        <span>{tx(req)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-navy/10 flex items-center justify-between">
                <span className="text-[11px] font-mono text-navy/50">{t("Draft category")}{' '}{visa.id.toUpperCase()}</span>
                <span className="text-[11px] font-semibold text-navy/60">{t("Not open for applications")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CITIZENSHIP PATHWAY CALLOUT ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Long-Term Settlement")}</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("From Lawful Residence to Citizenship")}</h2>
              <p className="text-xs sm:text-sm text-parchment/70 leading-relaxed max-w-2xl">{t("As proposed, permanent residents with five continuous years of residence who complete civic integration could apply to naturalise. Citizenship will be conferred only by birth or naturalisation, under a founding treaty.")}</p>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end">
              <Link
                href="/citizenship"
                className="px-6 py-3 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint text-center transition-all"
              >{t("Proposed Citizenship Standards")}</Link>
              <Link
                href="/founding-members"
                className="px-6 py-3 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 text-center transition-colors"
              >{t("Register interest as a Founding Member")}</Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
