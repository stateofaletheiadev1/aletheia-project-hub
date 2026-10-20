'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HexagonCross } from '@/components/brand/Logo';
import {
  Landmark,
  Shield,
  Scale,
  Building,
  CheckCircle,
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
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

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
    mandate: 'Preserves the fiscal stability of the Sovereign Covenant State, administers the Covenant Endowment Fund, manages sovereign bond issuances, and guarantees zero personal income taxation.',
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
    mandate: 'Represents the Sovereign Covenant State in bilateral and international treaties, supervises the legal system, administers the dispute arbitration framework, and issues passports.',
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
  const { t, tx } = useI18n();
  const [filter, setFilter] = useState<'All' | 'Operational' | 'Under Development' | 'Planned'>('All');

  const filteredMinistries = MINISTRIES.filter(
    (m) => filter === 'All' || m.status === filter
  );

  return (
    <div className="min-h-screen bg-parchment-canvas text-navy">
      {/* 1. Header Banner */}
      <section className="guilloche-hero relative text-parchment py-24 lg:py-32 border-b border-gold/30 overflow-hidden">
        <HeroBackdrop image="chamber" />
        {/* Ambient orbs */}
        <div className="orb-gold w-[480px] h-[480px] -top-24 -right-32 opacity-50 animate-orb-float-1" />
        <div className="orb-burgundy w-[320px] h-[320px] bottom-0 left-10 opacity-40 animate-orb-float-2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-7">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-navy-deep/80 border border-gold/40 rounded-sm backdrop-blur-sm">
            <HexagonCross size={18} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Institutional Directory")}</span>
            <span className="text-parchment/30">|</span>
            <span className="text-[11px] text-parchment/70 font-serif italic">{t("The Nine Capped Ministries")}</span>
          </div>

          <div className="max-w-3xl space-y-4 animate-fade-in-up">
            <h1 className="heading-hero">{t("Organs of")}{' '}
              <span className="text-gold-metallic">{t("Government")}</span>
            </h1>
            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Executive authority is constitutionally capped at nine ministries under the Chancellor. Power is divided among the Covenant Assembly, the Council of the States, the High Court, and checked continuously by the Auditor-General on the sovereign ledger.")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs animate-fade-in-up delay-200">
            <span className="text-gold font-bold uppercase tracking-[0.16em]">{t("Constitutional Ceiling:")}</span>
            <span className="bg-navy-deep/80 backdrop-blur-sm px-3 py-1.5 border border-gold/35 rounded-sm font-mono text-gold-tint">{t("9 Ministries Max (Schedule 3)")}</span>
            <span className="text-parchment/30">|</span>
            <span className="text-parchment/65">{t("Sunset Review: Every 8 Years")}</span>
          </div>
        </div>
      </section>

      {/* 2. Main Organs Overview */}
      <section className="py-12 border-b border-navy/10 bg-parchment-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* The Covenant Assembly */}
            <div id="assembly" className="feature-card rounded-sm p-6 space-y-3 group">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Landmark className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-base font-bold text-navy">{t("The Covenant Assembly")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{t("The primary legislative chamber of 61 members elected every four years by open-list proportional representation across Antioch and the four states.")}</p>
              <div className="text-[11px] font-mono text-gold-shadow pt-2 border-t border-navy/10 font-semibold">{t("61 Seats · 4-Year Term · Min 5 per State")}</div>
            </div>

            {/* Council of the States */}
            <div id="council" className="feature-card rounded-sm p-6 space-y-3 group">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Building className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-base font-bold text-navy">{t("Council of the States")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{t("Territorial review chamber comprising 15 members (3 from each State Council and 3 from Antioch). Suspensive review on land, energy, and currency acts.")}</p>
              <div className="text-[11px] font-mono text-gold-shadow pt-2 border-t border-navy/10 font-semibold">{t("15 Members · Suspensive Veto: 90 Days")}</div>
            </div>

            {/* The High Court */}
            <div id="judiciary" className="feature-card rounded-sm p-6 space-y-3 group">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Gavel className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h3 className="text-base font-bold text-navy">{t("The High Court of Aletheia")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{t("The supreme judicial body — constitutional supremacy, administrative review, and the Court of Maritime & Commercial Disputes with smart-contract arbitration.")}</p>
              <div className="text-[11px] font-mono text-gold-shadow pt-2 border-t border-navy/10 font-semibold">{t("Constitutional · Civil · Commercial Benches")}</div>
            </div>
          </div>
        </div>
      </section>


      {/* 3. The Nine Ministries Directory */}
      <section id="cabinet" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/15 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-eyebrow uppercase text-gold">{t("THE EXECUTIVE PORTFOLIOS")}</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">{t("The Nine Capped Ministries")}</h2>
            </div>

            <div className="flex items-center gap-2">
              {(['All', 'Under Development', 'Planned'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
                    filter === s
                      ? 'bg-navy text-parchment font-semibold'
                      : 'bg-white border border-navy/15 text-navy/70 hover:bg-parchment-light'
                  }`}
                >
                  {tx(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMinistries.map((ministry) => (
              <div
                key={ministry.id}
                className="sovereign-card-premium rounded-sm p-6 space-y-4 flex flex-col justify-between group"
              >
                {/* Top gold accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="icon-sovereign group-hover:border-gold/50 transition-colors">
                      {tx(ministry.icon)}
                    </div>
                    <StatusBadge status={ministry.status} size="sm" />
                  </div>

                  <div>
                    <h3 className="font-bold text-navy text-[15px] leading-snug">
                      {tx(ministry.name)}
                    </h3>
                    <span className="text-[10px] font-mono text-gold uppercase tracking-[0.16em] block mt-1 font-bold">
                      {tx(ministry.portfolio)}
                    </span>
                  </div>

                  <p className="text-xs text-navy/65 leading-relaxed">
                    {tx(ministry.mandate)}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-navy/8">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-navy/40 block">{t("Key Responsibilities")}</span>
                    <ul className="space-y-1">
                      {ministry.responsibilities.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-[11px] text-navy/75">
                          <span className="text-gold font-bold mt-0.5 shrink-0">›</span>
                          <span>{tx(r)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-navy/8 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-navy/40 truncate max-w-[140px]">
                    {tx(ministry.legalBasis)}
                  </span>
                  <Link
                    href={ministry.serviceHref}
                    className="font-bold text-xs text-navy hover:text-gold transition-colors flex items-center gap-1 group/l shrink-0"
                  >
                    <span>{tx(ministry.serviceName)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gold group-hover/l:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Independent Verification & Constitutional Bodies */}
      <section className="py-16 bg-navy text-parchment border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-1">
            <span className="eyebrow">{t("Fourth Pillar of Verification")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-parchment">{t("Independent Constitutional Bodies")}</h2>
            <p className="text-sm text-parchment/65 max-w-2xl">{t("These bodies operate outside the nine ministries and report directly to the Covenant Assembly.")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="sovereign-card-dark rounded-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <CheckCircle className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge status="Under Development" size="sm" />
              </div>
              <h4 className="font-bold text-parchment text-sm">{t("Auditor-General")}</h4>
              <p className="text-xs text-parchment/65 leading-relaxed">{t("Publishes autonomous cryptographic Merkle proofs of public expenditure against finalized StableChain blocks every 12-hour ledger epoch.")}</p>
            </div>

            <div className="sovereign-card-dark rounded-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Lock className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h4 className="font-bold text-parchment text-sm">{t("Registry & Privacy Ombudsman")}</h4>
              <p className="text-xs text-parchment/65 leading-relaxed">{t("Independent guardian enforcing zero-knowledge identity separation and auditing that no PII is ever stored on-chain.")}</p>
            </div>

            <div className="sovereign-card-dark rounded-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Scale className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge status="Under Development" size="sm" />
              </div>
              <h4 className="font-bold text-parchment text-sm">{t("The Monetary Board")}</h4>
              <p className="text-xs text-parchment/65 leading-relaxed">{t("Independent overseers of the Aletheian Guilder (AEY) issuance rules, examining the public register and the accounts of the Reserve Bank of Aletheia.")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
