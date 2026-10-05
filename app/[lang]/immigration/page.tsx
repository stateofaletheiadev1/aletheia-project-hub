'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldCheck,
  Plane,
  Building,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileText,
  CreditCard,
  Search,
  Filter,
  Users,
  Compass,
} from 'lucide-react';

const VISA_TYPES = [
  {
    id: 'eta',
    title: 'Electronic Travel Authorisation (A-ETA)',
    category: 'Short Stay (up to 90 days)',
    status: 'Planned' as const,
    fee: '25 AEY',
    processingTime: 'Instant / < 10 mins',
    desc: 'Automated digital clearance for tourism, diplomatic conferences, and business meetings in Aletheia.',
    requirements: ['Valid ICAO biometric passport (6 months validity)', 'Return maritime or aerial ticket', 'Verified health insurance clearance'],
  },
  {
    id: 'res-tech',
    title: 'Innovation & Research Residence Permit',
    category: 'Long Stay (1 to 3 years)',
    status: 'Planned' as const,
    fee: '250 AEY',
    processingTime: '14 Business Days',
    desc: 'Issued to software engineers, maritime roboticists, academics, and biotech researchers working in Antioch or Augustine.',
    requirements: ['Accredited contract or sponsor', 'Police clearance certificate', 'Biometric enrollment with ADSS'],
  },
  {
    id: 'res-invest',
    title: 'Sovereign Capital & Enterprise Permit',
    category: 'Long Stay (Renewable)',
    status: 'Planned' as const,
    fee: '500 AEY',
    processingTime: '21 Business Days',
    desc: 'For founders establishing verified commercial operations, industrial facilities, or significant capital commitments in Aletheia.',
    requirements: ['Incorporation on Aletheia Company Registry', 'Minimum capital commitment', 'Clean source of funds audit'],
  },
  {
    id: 'perm-res',
    title: 'Permanent Covenant Residence',
    category: 'Indefinite Physical Settlement',
    status: 'Vision' as const,
    fee: '750 AEY',
    processingTime: '30 Business Days',
    desc: 'Conveys indefinite right to physically reside, conduct business, and study. Direct prerequisite for naturalised citizenship.',
    requirements: ['3 years lawful continuous physical residence', 'Civic Integration assessment', 'No serious criminal infractions'],
  },
];

export default function ImmigrationPage() {
  const { t, tx } = useI18n();
  const { notify } = useToast();
  const [selectedPurpose, setSelectedPurpose] = useState('all');

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-36 border-b border-gold/30">
        <div className="absolute inset-0">
          <Image
            src="/images/autonomous_harbor.jpg"
            alt={t("Aletheia Border Control")}
            fill
            className="object-cover opacity-20 mix-blend-luminosity"
            priority
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("ADSS Immigration Directorate")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Immigration & Border Administration")}</h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light max-w-2xl">{t("Paperless, dignified, and algorithmically transparent border management. Aletheia welcomes global talent, innovators, and investors through clear statutory pathways governed by the rule of law.")}</p>

            <div className="p-4 bg-navy-deep/80 border border-gold/25 rounded-sm flex items-start gap-3 max-w-2xl">
              <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="text-xs text-parchment/80 leading-relaxed">
                <strong className="text-parchment block mb-0.5">{t("Crucial Legal Distinction: E-Residency vs. Physical Immigration")}</strong>{t("Aletheia E-Residency is a digital identity conferring access to corporate formation and fintech services. It confers")}{' '}<em>{t("no physical right to enter or reside")}</em>{' '}{t("in Aletheia. Physical entry requires a valid visa or residence permit.")}</div>
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
                <p className="text-xs text-parchment/60 leading-relaxed">{t("Fast-track paperless biometric entry at Antioch Airport and St. Brendan Maritime Terminal.")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-navy text-gold rounded-sm border border-gold/30 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-parchment">{t("Predictable Timelines")}</h4>
                <p className="text-xs text-parchment/60 leading-relaxed">{t("Statutory deadlines enforce processing guarantees. No backlogs, discretionary stalls, or opaque rejections.")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-navy text-gold rounded-sm border border-gold/30 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-parchment">{t("Judicial Appeal Right")}</h4>
                <p className="text-xs text-parchment/60 leading-relaxed">{t("All administrative visa determinations are subject to expedited judicial review by the Immigration Appeals Board.")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERMITS DIRECTORY ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Statutory Categories")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Visa & Residence Permit Schedule")}</h2>
            <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Explore visas and permits governed under the Immigration & Border Protection Act.")}</p>
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
                    <span className="text-[10px] text-navy/50 uppercase block font-mono">{t("Government Fee")}</span>
                    <span className="font-bold text-navy">{tx(visa.fee)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-navy/50 uppercase block font-mono">{t("Statutory Turnaround")}</span>
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
                <span className="text-[11px] font-mono text-navy/50">{t("Immigration Code §")}{' '}{visa.id.toUpperCase()}</span>
                <button
                  onClick={() => notify(t('{visa}: applications not yet open', { visa: t(visa.title) }), 'Applications open upon activation of territorial border infrastructure. Register interest via the citizen portal.', 'info')}
                  className="px-4 py-1.5 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors inline-flex items-center gap-1"
                >{t("Apply Online")}{' '}<ArrowRight className="w-3 h-3" />
                </button>
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
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("From Lawful Residence to Full Covenant Citizenship")}</h2>
              <p className="text-xs sm:text-sm text-parchment/70 leading-relaxed max-w-2xl">{t("Permanent residents who have completed three continuous years of physical settlement and the Civic Integration Programme are entitled to petition for full sovereign citizenship and an Aletheian biometric passport.")}</p>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end">
              <Link
                href="/citizenship"
                className="px-6 py-3 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint text-center transition-all"
              >{t("View Citizenship Pathways")}</Link>
              <Link
                href="/e-residency"
                className="px-6 py-3 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 text-center transition-colors"
              >{t("Apply for E-Residency")}</Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
