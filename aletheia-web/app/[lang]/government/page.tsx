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
  status: 'Planned';
  icon: React.ReactNode;
  serviceHref: string;
  serviceName: string;
}

const MINISTRIES: Ministry[] = [
  {
    id: 'treasury',
    name: 'Ministry of Treasury & Finance',
    portfolio: 'Public Accounts & Endowment',
    mandate: 'Would preserve the fiscal stability of the State, administer the Covenant Endowment Fund, and uphold the proposed prohibition of personal income tax.',
    responsibilities: [
      'Covenant Endowment Fund administration',
      'Epochal Merkle proofs of treasury accounts',
      'Public balance-sheet reporting',
      'Tax-free state revenue model coordination',
    ],
    legalBasis: 'Draft Constitution Art. 163–173; Public Finance & Endowment Act',
    status: 'Planned',
    icon: <Coins className="w-5 h-5 text-gold" />,
    serviceHref: '/treasury',
    serviceName: 'Treasury & Balance Sheet Audit',
  },
  {
    id: 'digital-state',
    name: 'Ministry of Digital State & Registries',
    portfolio: 'StableChain, Digital ID & E-Residency',
    mandate: 'Would run the State’s validators, supervise the identity registry, coordinate e-residency and keep civil records. Today StableChain runs as Mainnet Beta.',
    responsibilities: [
      'StableChain node governance and validator uptime',
      'National Identity Registry',
      'E-Residency digital incorporation rail',
      'Data sovereignty and public API infrastructure',
    ],
    legalBasis: 'Draft Constitution Art. 185, 196–202; StableChain Governance Act',
    status: 'Planned',
    icon: <Cpu className="w-5 h-5 text-gold" />,
    serviceHref: '/e-residency',
    serviceName: 'E-Residency (proposed)',
  },
  {
    id: 'security',
    name: 'Ministry of Resilience & Civil Protection',
    portfolio: 'Civilian Oversight & Emergency Response',
    mandate: 'Would exercise civilian authority over planned civil-protection and resilience functions, disaster response and national resilience policy.',
    responsibilities: [
      'Civilian oversight of resilience functions',
      'Emergency broadcast and maritime disaster readiness',
      'Critical infrastructure physical hardening',
      'Civilian police oversight and accountability',
    ],
    legalBasis: 'Draft Constitution Art. 188–195; ADSS Governance Act',
    status: 'Planned',
    icon: <Shield className="w-5 h-5 text-gold" />,
    serviceHref: '/adss',
    serviceName: 'Resilience Overview',
  },
  {
    id: 'foreign-affairs',
    name: 'Ministry of Foreign Affairs & Justice',
    portfolio: 'Diplomatic Relations, Treaties & Justice',
    mandate: 'Would represent Aletheia in seeking recognition and international agreements, and supervise the legal system and arbitration.',
    responsibilities: [
      'Recognition by other states',
      'Bilateral and maritime agreements under UNCLOS',
      'Judicial appointments and arbitral chamber support',
      'Consular affairs, once lawfully established',
    ],
    legalBasis: 'Draft Constitution Art. 203–209; Diplomatic Relations Act',
    status: 'Planned',
    icon: <Scale className="w-5 h-5 text-gold" />,
    serviceHref: '/development#seastead',
    serviceName: 'The Seastead',
  },
  {
    id: 'health',
    name: 'Ministry of Health & Social Well-being',
    portfolio: 'St. Luke National Hospital & Bio-Sciences',
    mandate: 'Would administer universal primary healthcare, hospital networks, clinical licensing and family health support.',
    responsibilities: [
      'St. Luke National Research Hospital operation',
      'High-standard pharmaceuticals and clinical trials licensing',
      'Universal primary medical access for residents',
      'Public health monitoring and emergency medical response',
    ],
    legalBasis: 'Draft Constitution Art. 74, 84; Health & Medical Standards Act',
    status: 'Planned',
    icon: <HeartPulse className="w-5 h-5 text-gold" />,
    serviceHref: '/healthcare',
    serviceName: 'National Health Registry',
  },
  {
    id: 'education',
    name: 'Ministry of Education & Science',
    portfolio: 'National University & Advanced Research',
    mandate: 'Would oversee schools, higher education, apprenticeships and research grants in science, robotics and maritime law.',
    responsibilities: [
      'National University of Aletheia accreditation',
      'STEM, robotics, and maritime engineering curricula',
      'Sovereign research grant administration',
      'Five-language civic education standards',
    ],
    legalBasis: 'Draft Constitution Art. 73, 87–89; Education & Research Charter',
    status: 'Planned',
    icon: <GraduationCap className="w-5 h-5 text-gold" />,
    serviceHref: '/education',
    serviceName: 'Research Grants & Scholarships',
  },
  {
    id: 'maritime',
    name: 'Ministry of Maritime Affairs & Ports',
    portfolio: 'Port Nicholas, Navigation & Fisheries',
    mandate: 'Would govern port facilities, maritime logistics, vessel registration and marine resources around Aletheia’s platforms.',
    responsibilities: [
      'Port Nicholas deepwater terminal (vision)',
      'Aletheian Maritime Ship Registry',
      'Fisheries and marine conservation oversight',
      'Aviation and maritime navigation safety standards',
    ],
    legalBasis: 'Draft Constitution Art. 28–40; Maritime Administration Act',
    status: 'Planned',
    icon: <Anchor className="w-5 h-5 text-gold" />,
    serviceHref: '/infrastructure',
    serviceName: 'Ship Registry & Port Logistics',
  },
  {
    id: 'infrastructure',
    name: 'Ministry of Infrastructure & Energy',
    portfolio: 'Clean Energy Grid, Water & Transport',
    mandate: 'Would plan and oversee offshore wind, small modular reactors, desalination and transport, as set out in the design studies.',
    responsibilities: [
      'Offshore wind and SMR energy generation',
      'Desalination and autonomous water supply grid',
      'Antioch concentric transport ring management',
      'Subsea power and telecommunication cable links',
    ],
    legalBasis: 'Draft Constitution Art. 38, 170; National Energy Grid Act',
    status: 'Planned',
    icon: <Building className="w-5 h-5 text-gold" />,
    serviceHref: '/energy',
    serviceName: 'Clean Grid & Infrastructure',
  },
  {
    id: 'agriculture',
    name: 'Ministry of Economy, Trade, Agriculture & Labour',
    portfolio: 'Enterprise, Trade, Food Security & Labour',
    mandate: 'Would set economic and trade policy, protect fair competition and workers, and promote food security through controlled-environment agriculture and sustainable aquaculture.',
    responsibilities: [
      'Hydroponic and vertical farm facilities in Benedict State',
      'Sustainable offshore aquaculture farming',
      'Foreign trade, investment screening and concessions policy',
      'Labour standards and consumer protection',
    ],
    legalBasis: 'Draft Constitution Art. 174–180; Economy & Labour Act',
    status: 'Planned',
    icon: <Leaf className="w-5 h-5 text-gold" />,
    serviceHref: '/development#agriculture',
    serviceName: 'Aquaculture & Agricultural Grid',
  },
];

export default function GovernmentDirectoryPage() {
  const { t, tx } = useI18n();
  const [filter, setFilter] = useState<'All' | 'Planned'>('All');

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
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Proposed Institutions")}</span>
            <span className="text-parchment/30">|</span>
            <span className="text-[11px] text-parchment/70 font-serif italic">{t("The Nine Capped Ministries")}</span>
          </div>

          <div className="max-w-3xl space-y-4 animate-fade-in-up">
            <h1 className="heading-hero">{t("Organs of")}{' '}
              <span className="text-gold-metallic">{t("Government")}</span>
            </h1>
            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("The draft Constitution caps executive authority at nine ministries under a Chancellor, and divides power among a Covenant Assembly, a Council of States, a High Court and an Auditor-General. None of these institutions exists yet or exercises any authority.")}</p>
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
                <StatusBadge asset="institutions" size="sm" />
              </div>
              <h3 className="text-base font-bold text-navy">{t("The Covenant Assembly")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{t("A proposed legislative chamber of 61 members, elected every four years by open-list proportional representation.")}</p>
              <div className="text-[11px] font-mono text-gold-shadow pt-2 border-t border-navy/10 font-semibold">{t("61 Seats · 4-Year Term · Min 5 per State")}</div>
            </div>

            {/* Council of States */}
            <div id="council" className="feature-card rounded-sm p-6 space-y-3 group">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Building className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge asset="institutions" size="sm" />
              </div>
              <h3 className="text-base font-bold text-navy">{t("Council of States")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{t("A proposed territorial review chamber of 15 members, with suspensive review of land, energy and currency acts.")}</p>
              <div className="text-[11px] font-mono text-gold-shadow pt-2 border-t border-navy/10 font-semibold">{t("15 Members · Suspensive Veto: 90 Days")}</div>
            </div>

            {/* The High Court */}
            <div id="judiciary" className="feature-card rounded-sm p-6 space-y-3 group">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Gavel className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge asset="institutions" size="sm" />
              </div>
              <h3 className="text-base font-bold text-navy">{t("The High Court of Aletheia")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{t("A proposed supreme court for constitutional and administrative review, with a Court of Maritime & Commercial Disputes.")}</p>
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
              {(['All', 'Planned'] as const).map((s) => (
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
            <p className="text-sm text-parchment/65 max-w-2xl">{t("These proposed bodies would operate outside the nine ministries and report directly to the Covenant Assembly.")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="sovereign-card-dark rounded-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <CheckCircle className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge asset="institutions" size="sm" />
              </div>
              <h4 className="font-bold text-parchment text-sm">{t("Auditor-General")}</h4>
              <p className="text-xs text-parchment/65 leading-relaxed">{t("Would publish proofs of public expenditure against finalised StableChain blocks every ledger epoch.")}</p>
            </div>

            <div className="sovereign-card-dark rounded-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Lock className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge asset="institutions" size="sm" />
              </div>
              <h4 className="font-bold text-parchment text-sm">{t("Registry & Privacy Ombudsman")}</h4>
              <p className="text-xs text-parchment/65 leading-relaxed">{t("Would enforce the separation of identity data, and audit that no personal data is ever stored on-chain.")}</p>
            </div>

            <div className="sovereign-card-dark rounded-sm p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="icon-sovereign">
                  <Scale className="w-5 h-5 text-gold" />
                </div>
                <StatusBadge asset="institutions" size="sm" />
              </div>
              <h4 className="font-bold text-parchment text-sm">{t("The Monetary Board")}</h4>
              <p className="text-xs text-parchment/65 leading-relaxed">{t("Would oversee the rules for issuing the Aletheian Guilder (AEY), and examine the public register and accounts of the Reserve Bank of Aletheia.")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
