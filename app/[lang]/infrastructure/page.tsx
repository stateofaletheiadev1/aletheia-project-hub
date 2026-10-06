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
    status: 'Planned' as const,
    lead: 'St. Brendan State Maritime Authority',
    desc: 'An automated container transshipment terminal with 18m natural deepwater draft, capable of docking Ultra Large Container Vessels (ULCV) with 100% electrified gantry systems.',
    specs: ['18.5m Natural Depth Draft', '2.5M TEU Annual Capacity', 'Automated Electric AGVs', 'Bonded Free-Port Zone'],
  },
  {
    id: 'antioch-concentric',
    title: 'Antioch Concentric Capital Urban Plan',
    tag: 'Civic & Urban Architecture',
    status: 'Planned' as const,
    lead: 'Federal Capital Planning Commission',
    desc: 'The circular masterplan of Antioch organizes administrative, legislative, residential, and academic zones in concentric rings with zero-emission subterranean transit.',
    specs: ['Hexagonal Central Assembly', 'Subterranean Maglev Loop', '100% Pedestrian Surface', 'LEED Platinum Standards'],
  },
  {
    id: 'marine-defences',
    title: 'Pelagic Seawall & Storm Surge Barrier Array',
    tag: 'Oceanic Civil Protection',
    status: 'Under Development' as const,
    lead: 'ADSS Civil Defence Directorate',
    desc: 'Reinforced pre-stressed marine concrete caissons engineered to withstand 1-in-200-year North Sea oceanic storm surges and protect domestic platforms.',
    specs: ['DNV-GL Maritime Certification', 'Integrated Kinetic Wave Turbines', 'Self-Healing Bio-Concrete', 'Automated Tidal Floodgates'],
  },
  {
    id: 'fiber-spine',
    title: 'Transatlantic Subsea Fiber & Satellite Gateway',
    tag: 'Digital Connectivity',
    status: 'Planned' as const,
    lead: 'Ministry of Digital State',
    desc: 'Direct optical submarine cable landing stations connected to global internet exchanges in London, Amsterdam, and Frankfurt, backed by Ka-band satellite ground uplinks.',
    specs: ['320 Tbps Total Bandwidth', 'Sub-5ms Latency to London/AMS', 'Tier-4 Bunkered Data Centers', 'Sovereign Telemetry Uplink'],
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
            src="/images/autonomous_harbor.jpg"
            alt={t("Aletheia Strategic Infrastructure")}
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
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Ministry of Territorial Development")}</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Strategic Infrastructure & Oceanic Engineering")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Civil structures engineered for multi-century longevity. From deepwater automated ports to concentric urban architecture and subsea telecommunications gateways.")}</p>
          </div>
        </div>
      </section>

      {/* ── INFRASTRUCTURE PROJECTS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Capital Works")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Major Strategic Public Works")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("All civil construction adheres to rigorous Eurocode and maritime classification standards.")}</p>
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
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Key Technical Specifications:")}</span>
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
                  href="/development"
                  className="text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
                >{t("View Blueprint")}{' '}<ArrowRight className="w-3 h-3" />
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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Participate in Sovereign Construction")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Explore engineering procurement tenders, GIS spatial plans, and sovereign development bonds.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/development"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Interactive Masterplan")}</Link>
            <Link
              href="/invest"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Investment Opportunities")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
