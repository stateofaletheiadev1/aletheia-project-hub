'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const INFRA_PROJECTS = [
  {
    id: 'port-brendan',
    title: 'St. Brendan Deepwater Autonomous Port',
    tag: 'Maritime Logistics & Trade',
    status: 'Vision' as const,
    lead: 'Design study · Port Nicholas',
    desc: 'A design study for an automated container terminal, sized for the largest container vessels and fully electrified. No site has been chosen and no works have begun.',
    specs: ['Design target: deepwater berths', 'Design target: 2.5M TEU a year', 'Automated electric vehicles', 'Bonded free-port zone'],
  },
  {
    id: 'antioch-concentric',
    title: 'Antioch Concentric Capital Urban Plan',
    tag: 'Civic & Urban Architecture',
    status: 'Vision' as const,
    lead: 'Design study · Antioch',
    desc: 'A design study for Antioch: administrative, legislative, residential and academic zones in concentric rings, with zero-emission underground transit.',
    specs: ['Hexagonal Central Assembly', 'Subterranean Maglev Loop', '100% Pedestrian Surface', 'LEED Platinum Standards'],
  },
  {
    id: 'marine-defences',
    title: 'Seawall & Storm Surge Barrier',
    tag: 'Oceanic Civil Protection',
    status: 'Vision' as const,
    lead: 'Design study · Civil protection',
    desc: 'A design study for marine concrete caissons to withstand a 1-in-200-year storm surge, for the foundations of Aletheia’s fixed platforms.',
    specs: ['Designed to maritime classification rules', 'Integrated wave turbines', 'Self-healing bio-concrete', 'Automated tidal floodgates'],
  },
  {
    id: 'fiber-spine',
    title: 'Subsea Fibre & Satellite Gateway',
    tag: 'Digital Connectivity',
    status: 'Vision' as const,
    lead: 'Design study · Digital connectivity',
    desc: 'A design study for submarine cable landing stations linked to major European internet exchanges, backed by satellite ground stations.',
    specs: ['High-capacity subsea fibre', 'Low latency to European exchanges', 'Resilient data centres', 'Satellite backup'],
  },
];

export default function InfrastructurePage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="absolute inset-0">
          <Image
            src="/images/maritime_port.jpg"
            alt=""
            fill
            className="object-cover opacity-20 mix-blend-luminosity"
            priority
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Ports & Coastal Works")}</span>
              </div>
              <StatusBadge asset="maritime" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Ports & Coastal Works: Design Studies")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Design studies for the long term: a deepwater port, a concentric capital, coastal protection and digital links. None is under construction. Each would be built at sea, on platforms Aletheia owns, beginning with a single pilot platform.")}</p>
          </div>
        </div>
      </section>

      {/* ── INFRASTRUCTURE PROJECTS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Vision · Design Studies")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Long-Term Public Works")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Any construction would follow Eurocode and maritime classification standards.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {INFRA_PROJECTS.map((proj) => (
            <div
              key={proj.id}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-gold uppercase tracking-wider block">
                    {tx(proj.tag)}
                  </span>
                  <StatusBadge status={proj.status} size="sm" />
                </div>

                <h3 className="text-xl font-bold text-navy">{tx(proj.title)}</h3>
                <p className="text-xs text-navy/70 leading-relaxed">{tx(proj.desc)}</p>

                <div className="pt-3 border-t border-navy/10 space-y-2">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Design Parameters:")}</span>
                  <div className="grid grid-cols-2 gap-2 text-xs text-navy/70">
                    {proj.specs.map((spec, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0" />
                        <span>{tx(spec)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-navy/10 flex items-center justify-between text-xs">
                <span className="text-navy/50 font-mono text-[11px]">{tx(proj.lead)}</span>
                <Link
                  href="/development#antioch"
                  className="text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
                >{t("View the Design Study")}{' '}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Built on Our Own Platforms")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("These works would be built at sea, on platforms Aletheia owns. No tenders or investments are offered.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/development#seastead"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("The Seastead")}</Link>
            <Link
              href="/founding-members"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Register interest")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
