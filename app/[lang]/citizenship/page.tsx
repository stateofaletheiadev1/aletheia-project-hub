'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ArrowRight,
  CheckCircle,
  Globe,
  Shield,
  FileText,
  Star,
  Award,
  BookOpen,
  Landmark,
  Coins,
} from 'lucide-react';

const RIGHTS = [
  'Right to vote in Covenant Assembly elections',
  'Right to hold elected or appointed public office',
  'Right to an Aletheian biometric passport (ICAO-compliant)',
  'Right to reside on Aletheian sovereign territory',
  'Right to access all civic services without fee',
  'Right to education and healthcare under the Covenant',
  'Freedom of expression, assembly, and conscience',
  'Protection under Aletheian law anywhere in the world',
];

const OBLIGATIONS = [
  'Uphold the Covenant and constitutional order',
  'Pay the applicable civic contribution schedule (no income tax)',
  'Complete the Civic Integration Programme',
  'Register biometric identity on the National Identity Registry',
  'Participate in democratic processes in good faith',
];

const PATHWAYS = [
  {
    title: 'Founding Citizenship',
    desc: 'Reserved for the initial cohort of founding members who participated in the constitutional drafting and national establishment process.',
    status: 'Planned' as const,
    detail: 'Application closed to new applicants. Reserved for founding cohort only.',
  },
  {
    title: 'Naturalisation by Residence',
    desc: 'After 5 years of lawful, continuous physical residence on Aletheian territory, residents may apply for full citizenship through the standard naturalisation process.',
    status: 'Planned' as const,
    detail: 'Available upon territorial establishment. Physical residence required.',
  },
  {
    title: 'Covenant Investor Citizenship',
    desc: 'Applicants who invest in building the Sovereign Covenant State — a 250,000 AEY National Development Contribution or 500,000 AEY in Covenant Development Bonds — may be granted citizenship without a residence period.',
    status: 'Under Development' as const,
    detail: 'Enhanced due diligence and the Covenant Oath required. See Apply for Citizenship.',
  },
  {
    title: 'Naturalisation by Covenant',
    desc: 'Exceptional individuals who provide outstanding service to Aletheian civic, scientific, or economic development may be granted citizenship by covenant award.',
    status: 'Planned' as const,
    detail: 'Awarded by the Chancellor with Covenant Assembly ratification.',
  },
  {
    title: 'Citizenship by E-Residency Pathway',
    desc: 'E-residents who meet residence and contribution requirements after territorial establishment may transition to full citizenship through a defined legal pathway.',
    status: 'Vision' as const,
    detail: 'Pathway designed but requires territorial establishment to activate.',
  },
];

export default function CitizenshipPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="relative guilloche-bg text-parchment overflow-hidden pt-24 pb-32 lg:pt-36 lg:pb-44">
        {/* Layered ambient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-burgundy/12 rounded-full blur-[100px]" />
        </div>

        {/* Coat of arms watermark */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none hidden lg:block">
          <Image
            src="/coat_of_arms_transparent.png"
            alt=""
            width={480}
            height={560}
            className="object-contain"
          />
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl space-y-8">
            {/* Breadcrumb pill */}
            <div className="flex items-center gap-3">
              <div className="pill-sovereign gold-glow-sm">
                <StarOfTruth size={12} />
                <span>{t("Ministry of Interior & Civic Affairs")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.04] text-parchment">{t("Membership by")}{' '}
                <span className="text-gold-metallic">{t("covenant,")}</span>
                <br />{t("not by accident of birth.")}</h1>
              <p className="text-base sm:text-xl text-parchment/70 leading-relaxed font-light max-w-2xl">{t("Aletheian citizenship is a voluntary, bilateral covenant — a mutual commitment between the individual and the Sovereign Covenant State. Rights are constitutionally absolute. Obligations are transparent, proportionate, and free of personal income tax.")}</p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/citizenship/apply" className="btn-sovereign-gold px-8 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm">
                <span>{t("Apply for Citizenship")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/e-residency" className="btn-sovereign-ghost px-8 py-3.5 rounded-sm text-sm">{t("Begin with E-Residency")}</Link>
            </div>

            {/* Key stat strip */}
            <div className="pt-6 border-t border-parchment/10 grid grid-cols-3 gap-8">
              {[
                { num: '5', label: 'Official Languages' },
                { num: '5', label: 'Citizenship Pathways' },
                { num: '8', label: 'Guaranteed Rights' },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="text-3xl font-extrabold text-gold tabular-nums">{tx(s.num)}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-parchment/50">{tx(s.label)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CIVIC COMPACT CALLOUT BAR ── */}
      <div className="bg-navy-deep border-y border-gold/20 py-5">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-sm bg-gold/10 border border-gold/25 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-gold" />
              </div>
              <p className="text-sm text-parchment/80 font-light">
                <span className="font-bold text-parchment">{t("The Covenant Principle:")}</span>{' '}{t("All citizenship rights are justiciable and enforceable before the High Court of Aletheia. No emergency decree may suspend them.")}</p>
            </div>
            <Link href="/constitution#art-7" className="text-[11px] font-bold uppercase tracking-wider text-gold hover:text-gold-tint transition-colors whitespace-nowrap flex items-center gap-1.5">{t("Constitution Art. 7–15")}{' '}<ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── PATHWAYS TO CITIZENSHIP ── */}
      <section className="py-24 lg:py-32 guilloche-parchment border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <span className="label-sovereign block mb-3">{t("Naturalisation Framework")}</span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-navy leading-tight">{t("Five pathways to")}{' '}
              <span className="text-gold-metallic">{t("full citizenship.")}</span>
            </h2>
            <div className="rule-gold mt-5 max-w-xs" />
            <p className="text-navy/60 mt-4 text-sm leading-relaxed">{t("All citizenship pathways are governed by the Nationality & Naturalisation Act, enacted pursuant to Constitution Article 8. No pathway circumvents the mandatory Covenant Oath.")}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {PATHWAYS.map((p, idx) => (
              <div key={p.title} className="feature-card rounded-sm p-7 group">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="icon-sovereign">
                      {tx(idx === 0 && <Award className="w-5 h-5 text-gold" />)}
                      {tx(idx === 1 && <Landmark className="w-5 h-5 text-gold" />)}
                      {tx(idx === 2 && <Coins className="w-5 h-5 text-gold" />)}
                      {tx(idx === 3 && <Star className="w-5 h-5 text-gold" />)}
                      {tx(idx === 4 && <Globe className="w-5 h-5 text-gold" />)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold/70">{t("Pathway")}{' '}{String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <StatusBadge status={p.status} size="sm" />
                </div>
                <h3 className="text-lg font-bold text-navy mb-2">{tx(p.title)}</h3>
                <p className="text-sm text-navy/65 leading-relaxed mb-5">{tx(p.desc)}</p>
                <div className="pt-4 border-t border-navy/[0.07] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold/50 shrink-0" />
                  <span className="text-[11px] text-navy/45 font-light">{tx(p.detail)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RIGHTS & OBLIGATIONS ── */}
      <section className="py-24 lg:py-32 bg-navy text-parchment border-b border-gold/20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <span className="label-parchment block mb-3">{t("The Bilateral Covenant")}</span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-parchment leading-tight">{t("Rights that are real.")}{' '}
              <span className="text-gold-metallic">{t("Obligations that are fair.")}</span>
            </h2>
            <div className="rule-gold-center mt-5 max-w-xs" />
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Constitutional Rights */}
            <div className="sovereign-card-dark rounded-sm p-8 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gold/15">
                <div className="icon-sovereign">
                  <BookOpen className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-parchment">{t("Constitutional Rights")}</h3>
                  <p className="text-[11px] text-parchment/45 mt-0.5">{t("Enforceable before the High Court · Art. 7–15")}</p>
                </div>
              </div>
              <div className="space-y-3">
                {RIGHTS.map((right) => (
                  <div key={right} className="flex items-start gap-3 group">
                    <div className="w-5 h-5 rounded-sm bg-laurel/20 border border-laurel/30 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-laurel" />
                    </div>
                    <span className="text-sm text-parchment/80 group-hover:text-parchment transition-colors leading-relaxed">{tx(right)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Civic Obligations */}
            <div className="space-y-5">
              <div className="sovereign-card-dark rounded-sm p-8 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gold/15">
                  <div className="icon-sovereign">
                    <Shield className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-parchment">{t("Civic Obligations")}</h3>
                    <p className="text-[11px] text-parchment/45 mt-0.5">{t("Constitution Art. 16–20 · Enforceable by law")}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {OBLIGATIONS.map((obl) => (
                    <div key={obl} className="flex items-start gap-3 group">
                      <div className="w-5 h-5 rounded-full border border-gold/35 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-gold" />
                      </div>
                      <span className="text-sm text-parchment/80 group-hover:text-parchment transition-colors leading-relaxed">{tx(obl)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* No Income Tax callout */}
              <div className="stat-card rounded-sm p-6">
                <div className="flex items-start gap-4">
                  <div className="icon-sovereign shrink-0">
                    <span className="text-gold font-extrabold text-lg">∅</span>
                  </div>
                  <div>
                    <span className="label-sovereign block mb-1.5">{t("Zero Personal Income Tax")}</span>
                    <p className="text-sm text-parchment/75 leading-relaxed">{t("Citizens pay a flat civic contribution schedule — not a personal income tax. The Sovereign Covenant State funds its operations through institutional fees, StableChain settlement revenue, and the Covenant Endowment Fund — not individual earnings.")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── E-RESIDENCY CTA ── */}
      <section className="py-24 lg:py-32 guilloche-parchment">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-sm bg-navy/10 border border-navy/15 animate-float">
              <StarOfTruth size={36} />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-navy leading-tight">{t("Not ready for citizenship?")}{' '}
                <span className="text-gold-metallic">{t("Start with E-Residency.")}</span>
              </h2>
              <p className="text-navy/65 leading-relaxed text-base max-w-xl mx-auto">{t("E-Residency gives you access to Aletheia's digital infrastructure — company formation, banking, and civic services — without the commitment of full citizenship. Many future citizens begin their Aletheian journey as e-residents.")}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/e-residency"
                className="btn-sovereign-gold px-10 py-4 rounded-sm flex items-center gap-2.5 group text-sm"
              >
                <span>{t("Explore E-Residency")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/passport"
                className="inline-flex items-center gap-2 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-navy border border-navy/20 rounded-sm hover:border-gold/50 hover:bg-navy/5 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-gold" />
                <span>{t("ICAO eMRTD Passport")}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}


