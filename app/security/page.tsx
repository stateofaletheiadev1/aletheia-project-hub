'use client';

import React from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldAlert,
  Anchor,
  Radio,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Siren,
  LifeBuoy,
  PhoneCall,
  Eye,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const DIRECTORATES = [
  {
    id: 'maritime',
    title: 'Maritime Defence & Coast Guard',
    tag: 'Oceanic Sovereignty & SAR',
    status: 'Operational' as const,
    mandate: 'Patrols territorial waters up to 12 nautical miles and Exclusive Economic Zone (EEZ) up to 200 nautical miles pursuant to UNCLOS, conducting maritime interdiction and humanitarian search and rescue.',
    assets: ['Autonomous Patrol Cutters', 'Offshore Oceanic Corvettes', 'Air-Sea Rescue Helicopters', 'Automated AIS Radar Arrays'],
  },
  {
    id: 'police',
    title: 'Civilian Police Directorate',
    tag: 'Lawful Order & Community Safety',
    status: 'Planned' as const,
    mandate: 'Dedicated strictly to civilian crime prevention, transparent investigation, and community policing. Statutorily separated from military commands with mandatory body cameras and judicial oversight.',
    assets: ['Municipal Community Bureaus', 'Forensic Cyber Crime Units', 'Independent Ombudsman Oversight', 'Zero-Militarization Doctrine'],
  },
  {
    id: 'emergency',
    title: 'Civil Protection & Disaster Mitigation',
    tag: 'Resilience & Emergency Response',
    status: 'Under Development' as const,
    mandate: 'Protects the population against severe North Sea storm surges, platform structural failures, marine fires, and medical emergencies.',
    assets: ['Tidal Surge Flood Barrier Units', 'Deepwater Firefighting Tugs', 'Aeromedical Evacuation Squads', 'Autonomous Warning Sirens'],
  },
  {
    id: 'cyber',
    title: 'National Cybersecurity Directorate',
    tag: 'Critical Digital Infrastructure',
    status: 'Operational' as const,
    mandate: 'Protects the Aletheia StableChain validator consensus network, national identity registries, power grids, and telecommunication landing stations from hostile state-sponsored cyber warfare.',
    assets: ['24/7 National CSIRT / CERT Desk', 'Air-Gapped Sovereign HSM Vaults', 'Automated Threat Intelligence Grid', 'Zero-Trust Architecture'],
  },
];

export default function SecurityPage() {
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="dataMesh" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Ministry of Security & Civil Defence</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">
              Security & Civil Defence
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              Civilian governance of the Armed & Defensive Sovereign Service (ADSS). Protecting territorial waters, civic liberties, and critical national infrastructure under strict parliamentary oversight.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/adss"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >
                ADSS Unified Directorate <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/adss/cybersecurity"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                Cybersecurity Directorate (CSIRT)
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CIVILIAN OVERSIGHT PRINCIPLE ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-gold shrink-0" />
              <div className="text-xs">
                <strong className="text-parchment block">Constitutional Invariant: Absolute Civilian Supremacy</strong>
                <span className="text-parchment/70">Under Covenant Article 18, security forces are strictly bound to civilian courts and parliamentary committees.</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-gold font-bold">National Alert Level:</span>
              <span className="px-2 py-0.5 bg-laurel/20 text-laurel border border-laurel/40 rounded-sm">DEFCON 5 / NORMAL</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── DIRECTORATES GRID ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Command Architecture</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">The Four Operational Directorates</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            Coordinated under the unified command of the civilian Minister of Security, maintaining full functional separation between civilian policing, military defense, and cyber defense.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {DIRECTORATES.map((dir) => (
            <div
              key={dir.id}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-6 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">
                      {dir.tag}
                    </span>
                    <h3 className="text-xl font-bold text-navy">{dir.title}</h3>
                  </div>
                  <StatusBadge status={dir.status} size="sm" />
                </div>

                <p className="text-xs text-navy/70 leading-relaxed">{dir.mandate}</p>

                <div className="pt-3 border-t border-navy/10 space-y-2">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Operational Capabilities & Assets:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-navy/70">
                    {dir.assets.map((asset, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0" />
                        <span>{asset}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-navy/10 flex items-center justify-between text-xs">
                <span className="text-navy/50 font-mono text-[11px]">Command Base: St. Barbara State</span>
                <Link
                  href={dir.id === 'cyber' ? '/adss/cybersecurity' : '/adss'}
                  className="text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
                >
                  Directorate Details <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── EMERGENCY HOTLINE & MARITIME DISTRESS ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              <Siren className="w-4 h-4" /> 24/7 National Emergency & Rescue Desk
            </span>
            <h3 className="text-2xl font-bold text-navy">Immediate Response & Maritime Search and Rescue</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Vessels navigating territorial waters or citizens experiencing physical emergencies may reach the Joint Operations Command Center immediately via radio VHF Channel 16 or encrypted telephony.
            </p>
          </div>

          <div className="lg:col-span-5 bg-navy-deep text-parchment p-6 rounded-sm border border-gold/30 space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-navy/40 pb-2">
              <span className="text-gold">VHF Marine Distress:</span>
              <span className="text-parchment font-bold">Channel 16 (156.800 MHz)</span>
            </div>
            <div className="flex justify-between border-b border-navy/40 pb-2 pt-1">
              <span className="text-gold">Emergency Telephony:</span>
              <span className="text-parchment font-bold">+112 (National Toll-Free)</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-gold">Maritime MMSI Code:</span>
              <span className="text-parchment font-bold">209 001 000</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            A Republic Defended by Free Citizens
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Learn more about the civilian statutory limits and constitutional bounds of the Armed & Defensive Sovereign Service.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/adss"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Explore ADSS Directorate
            </Link>
            <Link
              href="/constitution"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Covenant Article 18 (Defence)
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
