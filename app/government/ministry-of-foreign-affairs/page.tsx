'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Globe2,
  Scale,
  ShieldCheck,
  FileText,
  Building2,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Mail,
  MapPin,
  Lock,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const DIPLOMATIC_PILLARS = [
  {
    title: 'Bilateral Covenants & Treaties',
    desc: 'Negotiation and formal ratification of sovereign bilateral compacts concerning free trade, maritime navigational corridors, and environmental pelagic stewardship pursuant to Vienna Convention standards.',
  },
  {
    title: 'International Dispute Arbitration',
    desc: 'Administration of the Aletheia International Arbitration Center in Geneva, providing impartial, rapid dispute resolution for multinational corporate contracts and maritime charters.',
  },
  {
    title: 'Passport & Diplomatic Document Issuance',
    desc: 'Supervision of the National Identity Registry for ICAO Doc 9303 biometric passport production, diplomatic passports, service credentials, and consular visas.',
  },
  {
    title: 'Consular & Humanitarian Protection',
    desc: 'Protection of Aletheian citizens, e-residents, and flagged commercial vessels in international waters through permanent missions and reciprocal consular agreements.',
  },
];

const TREATY_REGISTRY = [
  {
    code: 'TRT-2026-01',
    title: 'North Sea Oceanic Navigational Safety & SAR Accord',
    parties: 'Aletheia & Regional Maritime Safety Authorities',
    status: 'Operational' as const,
    date: '2026-03-15',
    summary: 'Establishes reciprocal search and rescue coordination, automated radar sharing, and joint emergency response protocols.',
  },
  {
    code: 'TRT-2026-02',
    title: 'Bilateral Commercial Arbitration Framework',
    parties: 'Aletheia & International Chamber of Commerce (Geneva Desk)',
    status: 'Operational' as const,
    date: '2026-05-20',
    summary: 'Recognition and mutual enforcement of arbitral awards pursuant to the 1958 New York Convention on Commercial Arbitration.',
  },
  {
    code: 'TRT-2026-03',
    title: 'Double Taxation Relief & Registry Data Integrity Pact',
    parties: 'Aletheia & European Free Trade Partners',
    status: 'Under Development' as const,
    date: '2026-08-11',
    summary: 'Guarantees zero double-taxation for remote e-residents and establishes automated anti-money laundering (AML) verification standards.',
  },
];

export default function MinistryForeignAffairsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="assembly" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Executive Cabinet Portfolio</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">
              Ministry of Foreign Affairs & Justice
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              Conducting the external diplomacy, international treaties, judicial arbitration systems, and diplomatic document issuance of The Sovereign Covenant State of Aletheia in accordance with international law and the UN Charter.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/passport"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >
                ICAO Passport Specification <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/government"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                Cabinet Directory
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATUTORY RESPONSIBILITIES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Ministerial Mandate</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">Four Strategic Pillars of External Action</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            Pursuant to the Executive Government Act, the Ministry administers foreign policy, treaty accession, and the administration of justice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {DIPLOMATIC_PILLARS.map((pillar, idx) => (
            <div
              key={idx}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center shrink-0">
                  {idx === 0 ? <Globe2 className="w-5 h-5" /> : idx === 1 ? <Scale className="w-5 h-5" /> : idx === 2 ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <h3 className="text-lg font-bold text-navy">{pillar.title}</h3>
              </div>
              <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>

        {/* ── DIPLOMATIC TREATY REPOSITORY ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/10 pb-4">
            <div>
              <span className="text-xs font-bold text-gold uppercase tracking-wider block">Official Treaty Inscriptions</span>
              <h3 className="text-2xl font-bold text-navy">International Treaty & Covenant Register</h3>
            </div>
            <Link
              href="/documents"
              className="text-xs text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
            >
              All Public Documents <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {TREATY_REGISTRY.map((trt) => (
              <div
                key={trt.code}
                className="p-5 bg-parchment-light border border-navy/10 rounded-sm space-y-2 hover:border-gold/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-navy text-parchment font-mono text-[10px] font-bold rounded-sm">
                      {trt.code}
                    </span>
                    <StatusBadge status={trt.status} size="sm" />
                  </div>
                  <span className="text-[11px] font-mono text-navy/50">{trt.date}</span>
                </div>

                <h4 className="text-sm font-bold text-navy">{trt.title}</h4>
                <p className="text-xs text-navy/70 leading-relaxed">{trt.summary}</p>
                <div className="text-[11px] font-mono text-gold pt-1">Parties: {trt.parties}</div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ── DIPLOMATIC MISSIONS CALLOUT ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            Diplomatic Accreditation & Bilateral Inquiries
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Foreign ministries, international bodies, and accredited diplomatic delegations may contact the Protocol Department of the Ministry of Foreign Affairs.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Contact Protocol Department
            </Link>
            <Link
              href="/government"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              All Ministries Directory
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
