'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import {
  Landmark,
  Shield,
  Scale,
  Building,
  Users,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Cpu,
  Coins,
  Anchor,
  HeartPulse,
  GraduationCap,
  Leaf,
  Gavel,
  Lock,
} from 'lucide-react';

interface Ministry {
  id: string;
  name: string;
  portfolio: string;
  mandate: string;
  responsibilities: string[];
  legalBasis: string;
  status: 'Operational' | 'Under Development' | 'Planned';
  icon: React.ReactNode;
  serviceHref: string;
  serviceName: string;
}

const MINISTRIES: Ministry[] = [
  {
    id: 'treasury',
    name: 'Ministry of Treasury & Finance',
    portfolio: 'Public Accounts, Reserves & Bonds',
    mandate: 'Preserves the fiscal stability of the Republic, administers the Covenant Endowment Fund, manages sovereign bond issuances, and guarantees zero personal income taxation.',
    responsibilities: [
      'Covenant Endowment Fund administration',
      'Epochal Merkle proofs of treasury accounts',
      'Sovereign Development Bond issuance',
      'Tax-free state revenue model coordination',
    ],
    legalBasis: 'Constitution Art. 16; Public Finance & Endowment Act',
    status: 'Under Development',
    icon: <Coins className="w-5 h-5 text-gold" />,
    serviceHref: '/treasury',
    serviceName: 'Treasury & Balance Sheet Audit',
  },
  {
    id: 'digital-state',
    name: 'Ministry of Digital State & Registries',
    portfolio: 'StableChain, Digital ID & E-Residency',
    mandate: 'Operates state-authorized validator clusters, supervises the National Identity Registry, coordinates E-Residency services, and maintains immutable civil records.',
    responsibilities: [
      'StableChain node governance and validator uptime',
      'National Biometric Identity Registry',
      'E-Residency digital incorporation rail',
      'Data sovereignty and public API infrastructure',
    ],
    legalBasis: 'Constitution Art. 11; StableChain Governance Act',
    status: 'Under Development',
    icon: <Cpu className="w-5 h-5 text-gold" />,
    serviceHref: '/e-residency',
    serviceName: 'E-Residency Portal',
  },
  {
    id: 'security',
    name: 'Ministry of Security & Civil Defence',
    portfolio: 'Civilian Governance of ADSS & Emergency',
    mandate: 'Exercises civilian constitutional authority over the Aletheian Defence & Security Service (ADSS), civil disaster mitigation, and national resilience policy.',
    responsibilities: [
      'Civilian governance of ADSS Directorates',
      'Emergency broadcast and maritime disaster readiness',
      'Critical infrastructure physical hardening',
      'Civilian police oversight and accountability',
    ],
    legalBasis: 'Constitution Art. 46; ADSS Governance Act',
    status: 'Planned',
    icon: <Shield className="w-5 h-5 text-gold" />,
    serviceHref: '/adss',
    serviceName: 'ADSS Directory & Directives',
  },
  {
    id: 'foreign-affairs',
    name: 'Ministry of Foreign Affairs & Justice',
    portfolio: 'Diplomacy, Treaties & Passports',
    mandate: 'Represents the Republic in bilateral and international treaties, supervises the legal system, administers the dispute arbitration framework, and issues passports.',
    responsibilities: [
      'Bilateral treaties and UNCLOS maritime agreements',
      'ICAO Doc 9303 machine-readable passport issuance',
      'Judicial appointments and arbitral chamber support',
      'Consular affairs and diplomatic representation',
    ],
    legalBasis: 'Constitution Art. 2, 8; Diplomatic Relations Act',
    status: 'Planned',
    icon: <Scale className="w-5 h-5 text-gold" />,
    serviceHref: '/passport',
    serviceName: 'Passport Issuance & Validation',
  },
  {
    id: 'health',
    name: 'Ministry of Health & Social Well-being',
    portfolio: 'St. Luke National Hospital & Bio-Sciences',
    mandate: 'Administers universal primary healthcare, hospital networks, biomedical clinical licensing, and family health support in Augustine State.',
    responsibilities: [
      'St. Luke National Research Hospital operation',
      'High-standard pharmaceuticals and clinical trials licensing',
      'Universal primary medical access for residents',
      'Public health monitoring and emergency medical response',
    ],
    legalBasis: 'Constitution Art. 41; Health & Medical Standards Act',
    status: 'Planned',
    icon: <HeartPulse className="w-5 h-5 text-gold" />,
    serviceHref: '/healthcare',
    serviceName: 'National Health Registry',
  },
  {
    id: 'education',
    name: 'Ministry of Education & Science',
    portfolio: 'National University & Advanced Research',
    mandate: 'Oversees higher education, primary schooling, vocational apprenticeships, and sovereign research grants in science, robotics, and maritime law.',
    responsibilities: [
      'National University of Aletheia accreditation',
      'STEM, robotics, and maritime engineering curricula',
      'Sovereign research grant administration',
      'Five-language civic education standards',
    ],
    legalBasis: 'Constitution Art. 40; Education & Research Charter',
    status: 'Planned',
    icon: <GraduationCap className="w-5 h-5 text-gold" />,
    serviceHref: '/education',
    serviceName: 'Research Grants & Scholarships',
  },
  {
    id: 'maritime',
    name: 'Ministry of Maritime Affairs & Ports',
    portfolio: 'Port Nicholas, Navigation & Fisheries',
    mandate: 'Governs territorial waters, deepwater port facilities, maritime logistics, vessel registration, and sustainable oceanic resources.',
    responsibilities: [
      'Port Nicholas deepwater commercial terminal operations',
      'Aletheian Maritime Ship Registry',
      'Fisheries and marine conservation oversight',
      'Aviation and maritime navigation safety standards',
    ],
    legalBasis: 'Constitution Art. 7; Maritime Administration Act',
    status: 'Planned',
    icon: <Anchor className="w-5 h-5 text-gold" />,
    serviceHref: '/infrastructure',
    serviceName: 'Ship Registry & Port Logistics',
  },
  {
    id: 'infrastructure',
    name: 'Ministry of Infrastructure & Energy',
    portfolio: 'Clean Energy Grid, Water & Transport',
    mandate: 'Constructs and oversees offshore wind farms, small modular nuclear reactors, desalination facilities, and the Antioch rapid transit network.',
    responsibilities: [
      'Offshore wind and SMR energy generation',
      'Desalination and autonomous water supply grid',
      'Antioch concentric transport ring management',
      'Subsea power and telecommunication cable links',
    ],
    legalBasis: 'Constitution Art. 39; National Energy Grid Act',
    status: 'Planned',
    icon: <Building className="w-5 h-5 text-gold" />,
    serviceHref: '/energy',
    serviceName: 'Clean Grid & Infrastructure',
  },
  {
    id: 'agriculture',
    name: 'Ministry of Agriculture & Environment',
    portfolio: 'Controlled Agriculture & Aquaculture',
    mandate: 'Guarantees food security through high-yield vertical farming, hydroponics, sustainable ocean aquaculture, and environmental stewardship.',
    responsibilities: [
      'Hydroponic and vertical farm facilities in Benedict State',
      'Sustainable offshore aquaculture farming',
      'Environmental impact assessments and coastal preservation',
      'Zero-waste circular economy enforcement',
    ],
    legalBasis: 'Constitution Art. 43; Environmental Protection Act',
    status: 'Planned',
    icon: <Leaf className="w-5 h-5 text-gold" />,
    serviceHref: '/development#agriculture',
    serviceName: 'Aquaculture & Agricultural Grid',
  },
];

export default function GovernmentDirectoryPage() {
  const [filter, setFilter] = useState<'All' | 'Operational' | 'Under Development' | 'Planned'>('All');

  const filteredMinistries = MINISTRIES.filter(
    (m) => filter === 'All' || m.status === filter
  );

  return (
    <div className="min-h-screen bg-parchment-canvas text-navy">
      {/* 1. Header Banner */}
      <section className="bg-navy text-parchment py-16 lg:py-20 border-b border-gold/40 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-navy-deep/80 border border-gold/40 rounded-sm">
            <HexagonCross size={18} />
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
              INSTITUTIONAL DIRECTORY
            </span>
            <span className="text-parchment/40">|</span>
            <span className="text-xs text-parchment/80 font-serif italic">The Nine Capped Ministries</span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-parchment">
              Organs of Government
            </h1>
            <p className="text-base sm:text-lg text-parchment/80 leading-relaxed font-light">
              Executive authority is constitutionally capped at nine ministries under the Chancellor. Power is divided among the Covenant Assembly, the Council of the States, the High Court, and checked continuously by the Auditor-General on the ledger.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <span className="text-gold font-semibold uppercase tracking-wider">
              Constitutional Ceiling:
            </span>
            <span className="bg-navy-deep px-3 py-1 border border-gold/30 rounded-sm font-mono text-gold-tint">
              9 Ministries Max (Schedule 3)
            </span>
            <span className="text-parchment/40">|</span>
            <span className="text-parchment/70">Sunset Review: Every 8 Years</span>
          </div>
        </div>
      </section>

      {/* 2. Main Organs Overview */}
      <section className="py-12 border-b border-navy/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* The Covenant Assembly */}
            <div id="assembly" className="p-6 bg-parchment-light border border-navy/15 rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <Landmark className="w-5 h-5 text-gold" />
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-lg font-bold text-navy">The Covenant Assembly</h3>
              <p className="text-xs text-navy/70 leading-relaxed">
                The primary legislative chamber consisting of 61 members elected every four years by open-list proportional representation across Antioch and the four states.
              </p>
              <div className="text-[11px] font-mono text-navy/60 pt-2 border-t border-navy/10">
                Seats: 61 | Term: 4 Years | Min 5 per State
              </div>
            </div>

            {/* Council of the States */}
            <div id="council" className="p-6 bg-parchment-light border border-navy/15 rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <Building className="w-5 h-5 text-gold" />
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-lg font-bold text-navy">Council of the States</h3>
              <p className="text-xs text-navy/70 leading-relaxed">
                Territorial review chamber comprising 15 members (3 appointed by each State Council and 3 by Antioch). Possesses suspensive review on land, energy, and currency acts.
              </p>
              <div className="text-[11px] font-mono text-navy/60 pt-2 border-t border-navy/10">
                Members: 15 | Suspensive Veto: 90 Days
              </div>
            </div>

            {/* The High Court */}
            <div id="judiciary" className="p-6 bg-parchment-light border border-navy/15 rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <Gavel className="w-5 h-5 text-gold" />
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-lg font-bold text-navy">The High Court of Aletheia</h3>
              <p className="text-xs text-navy/70 leading-relaxed">
                The supreme judicial body exercising constitutional supremacy, administrative review, and presiding over the Court of Maritime & Commercial Disputes with automated smart-contract arbitration.
              </p>
              <div className="text-[11px] font-mono text-navy/60 pt-2 border-t border-navy/10">
                Benches: Constitutional, Civil, Commercial
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Nine Ministries Directory */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/15 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
                THE EXECUTIVE PORTFOLIOS
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">
                The Nine Capped Ministries
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {(['All', 'Under Development', 'Planned'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s as any)}
                  className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
                    filter === s
                      ? 'bg-navy text-parchment font-semibold'
                      : 'bg-white border border-navy/15 text-navy/70 hover:bg-parchment-light'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMinistries.map((ministry) => (
              <div
                key={ministry.id}
                className="bg-white border border-navy/15 rounded-sm p-6 space-y-4 shadow-subtle hover:shadow-institutional transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-parchment-canvas rounded-sm border border-navy/10">
                      {ministry.icon}
                    </div>
                    <StatusBadge status={ministry.status} size="sm" />
                  </div>

                  <div>
                    <h3 className="font-bold text-navy text-base leading-snug">
                      {ministry.name}
                    </h3>
                    <span className="text-xs font-mono text-gold-shadow uppercase tracking-wider block mt-0.5">
                      {ministry.portfolio}
                    </span>
                  </div>

                  <p className="text-xs text-navy/70 leading-relaxed">
                    {ministry.mandate}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-navy/10">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-navy/50 font-bold block">
                      Core Responsibilities:
                    </span>
                    <ul className="space-y-1 text-[11px] text-navy/80">
                      {ministry.responsibilities.map((r) => (
                        <li key={r} className="flex items-start gap-1.5">
                          <span className="text-gold font-bold">›</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-navy/10 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-navy/50 truncate max-w-[140px]">
                    {ministry.legalBasis}
                  </span>
                  <Link
                    href={ministry.serviceHref}
                    className="font-semibold text-gold-shadow hover:text-navy transition-colors flex items-center gap-1"
                  >
                    <span>{ministry.serviceName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gold" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Independent Verification & Constitutional Bodies */}
      <section className="py-12 bg-white border-t border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">
              FOURTH PILLAR OF VERIFICATION
            </span>
            <h2 className="text-2xl font-bold text-navy">
              Independent Constitutional Bodies
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-parchment-canvas border border-navy/15 rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-navy text-sm">Auditor-General</h4>
                <StatusBadge status="Under Development" size="sm" />
              </div>
              <p className="text-xs text-navy/70 leading-relaxed">
                Publishes autonomous cryptographic Merkle proofs of public expenditure against finalized StableChain blocks every 512-slot epoch.
              </p>
            </div>

            <div className="p-6 bg-parchment-canvas border border-navy/15 rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-navy text-sm">Registry & Privacy Ombudsman</h4>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <p className="text-xs text-navy/70 leading-relaxed">
                Independent guardian enforcing strict zero-knowledge identity separation and auditing that no personally identifiable information (PII) is stored on-chain.
              </p>
            </div>

            <div className="p-6 bg-parchment-canvas border border-navy/15 rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-navy text-sm">The Monetary Board</h4>
                <StatusBadge status="Under Development" size="sm" />
              </div>
              <p className="text-xs text-navy/70 leading-relaxed">
                Independent overseers of the 12 reserve invariants (I1–I12), auditing Aletheian Guilder (AEY) reserve accounts and preventing unbacked currency expansion.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
