'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Scale,
  Globe,
  ArrowRight,
  Cpu,
  Anchor,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const VISION_PILLARS = [
  {
    icon: Scale,
    title: 'The Inviolability of Law',
    subtitle: 'Constitutional Covenant Supremacy',
    desc: 'Government exists solely within the limits established by the Covenant. Neither majority vote nor emergency decree may suspend the foundational rights of citizens.',
  },
  {
    icon: Globe,
    title: 'European Democratic Alignment',
    subtitle: 'Continental Integration Standards',
    desc: 'Adherence to the European Convention on Human Rights (ECHR), GDPR data protection standards, and OECD transparency guidelines while pioneering voluntary civic governance.',
  },
  {
    icon: Cpu,
    title: 'Algorithmic State Integrity',
    subtitle: 'Zero-Discretion Public Registries',
    desc: 'Bureaucratic friction and corruption are engineered out through public ledgers, automated statutory deadlines, and cryptographically provable treasury accounts.',
  },
  {
    icon: Anchor,
    title: 'Maritime Autonomy & Resilience',
    subtitle: 'Sovereign Oceanic Commonwealth',
    desc: 'Exercising full jurisdiction under UNCLOS, pioneering modular floating civil structures, and providing vital search and rescue infrastructure in international sea lanes.',
  },
];

const MILESTONES = [
  {
    year: '2026',
    title: 'Constitutional Promulgation & Identity Infrastructure',
    desc: 'Ratification of the Covenant of Aletheia, deployment of the StableChain testnet, rollout of ICAO Doc 9303 biometric passport specifications, and E-Residency activation.',
    status: 'Operational' as const,
  },
  {
    year: '2027',
    title: 'Maritime Territory & Port Groundbreaking',
    desc: 'Commencement of marine civil works for the St. Brendan Port and Antioch Federal District; installation of autonomous renewable offshore wind arrays.',
    status: 'Under Development' as const,
  },
  {
    year: '2028',
    title: 'Parliamentary Elections & Resident Settlement',
    desc: 'Inaugural elections for the 61-member Covenant Assembly, convening of the Council of the States, and initial residential occupancy in Antioch.',
    status: 'Planned' as const,
  },
  {
    year: '2030',
    title: 'Full European Treaty Integration & Economic Maturity',
    desc: 'Bilateral trade compacts, full SEPA/AEY interbank clearing integration, and mature self-sustaining sovereign endowment operations.',
    status: 'Vision' as const,
  },
];

export default function VisionPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-36 border-b border-gold/30">
        <HeroBackdrop image="cloudSummit" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("The 2050 Covenant")}</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">{t("The National Vision of Aletheia")}</h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light max-w-2xl">{t("Building a state where power is strictly bounded, law is incorruptible, and human dignity is paramount. A maritime sanctuary of free enterprise and European constitutional excellence for generations to come.")}</p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/constitution"
                className="px-6 py-3 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("Read The Covenant")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/development"
                className="px-6 py-3 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("Spatial Masterplan")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE VISION PILLARS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Foundational Tenets")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Four Pillars of the Sovereign Compact")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("The Covenant of Aletheia unites centuries of European constitutional wisdom with the technological possibilities of the modern era.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {VISION_PILLARS.map((pillar, idx) => (
            <div
              key={idx}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="w-12 h-12 rounded-sm bg-navy text-gold flex items-center justify-center group-hover:bg-navy-deep transition-colors">
                <pillar.icon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">
                  {tx(pillar.subtitle)}
                </span>
                <h3 className="text-xl font-bold text-navy">{tx(pillar.title)}</h3>
              </div>
              <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
                {tx(pillar.desc)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2026-2030 STRATEGIC ROADMAP ── */}
      <section className="py-16 bg-navy text-parchment border-y border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Strategic Milestones")}</span>
            <h2 className="text-3xl font-bold tracking-tight text-parchment">{t("The Roadmap to Statehood")}</h2>
            <p className="text-xs sm:text-sm text-parchment/65 leading-relaxed">{t("Transparent, measurable targets published pursuant to the National Development Act.")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {MILESTONES.map((m) => (
              <div
                key={m.year}
                className="bg-navy-deep/80 border border-navy/40 rounded-sm p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold font-mono text-gold">{tx(m.year)}</span>
                    <StatusBadge status={m.status} size="sm" />
                  </div>
                  <h4 className="text-sm font-bold text-parchment leading-snug">{tx(m.title)}</h4>
                  <p className="text-xs text-parchment/65 leading-relaxed">{tx(m.desc)}</p>
                </div>
                <div className="pt-4 border-t border-navy/40 text-[10px] font-mono text-parchment/40">{t("Target Phase · Covenant Act §")}{' '}{tx(m.year)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 w-full">
        <StarOfTruth size={36} className="mx-auto" />
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy">{t("Help Shape the Future of Aletheia")}</h2>
        <p className="text-xs sm:text-sm text-navy/70 max-w-xl mx-auto leading-relaxed">{t("From legal scholars and maritime engineers to global entrepreneurs, the Sovereign Covenant State is built by those who participate.")}</p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/citizenship"
            className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
          >{t("Citizenship Pathways")}</Link>
          <Link
            href="/e-residency"
            className="px-6 py-2.5 border border-navy/30 text-navy font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-navy transition-colors"
          >{t("Apply for E-Residency")}</Link>
        </div>
      </section>

    </div>
  );
}
