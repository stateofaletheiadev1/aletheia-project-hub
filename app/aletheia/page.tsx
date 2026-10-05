'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { NationalFlag } from '@/components/brand/Flags';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ArrowRight,
  Shield,
  Compass,
  Anchor,
  BookOpen,
  Award,
  Globe2,
  CheckCircle2,
  FileText,
  ChevronRight,
  Building2,
  Lock,
} from 'lucide-react';

const SECTIONS = [
  { id: 'foundations', label: 'Foundations & Covenant' },
  { id: 'symbols', label: 'National Symbols' },
  { id: 'maritime', label: 'Maritime Sovereignty' },
  { id: 'territories', label: 'The Five States' },
  { id: 'institutions', label: 'Civic Architecture' },
];

export default function AletheiaPage() {
  const [activeTab, setActiveTab] = useState('foundations');

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-28 lg:pt-32 lg:pb-36 border-b border-gold/30">
        <div className="absolute inset-0">
          <Image
            src="/images/civic_assembly.jpg"
            alt="The Sovereign Covenant State of Aletheia"
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
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">The Sovereign Covenant</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">
              The Sovereign Covenant State of Aletheia
            </h1>

            <p className="text-lg sm:text-xl text-parchment/80 font-serif italic max-w-2xl">
              &ldquo;Veritas in Foedere&rdquo; — Truth in Covenant. A constitutional republic engineered for human dignity, institutional transparency, and maritime liberty.
            </p>

            <p className="text-sm sm:text-base text-parchment/65 leading-relaxed font-light max-w-2xl">
              Aletheia is a sovereign maritime nation founded on the supremacy of constitutional law, verifiable public registries, and an unalterable civic covenant between citizens and state institutions.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/constitution"
                className="px-6 py-3 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >
                Read The Covenant <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/passport"
                className="px-6 py-3 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                ICAO Passport Portal
              </Link>
              <Link
                href="/e-residency"
                className="px-6 py-3 bg-navy-deep/80 border border-navy/30 text-parchment/80 font-semibold text-xs uppercase tracking-wider rounded-sm hover:text-parchment transition-colors"
              >
                Apply for E-Residency
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY METRICS / ATTRIBUTES BAR ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment/80 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gold/70">Constitutional Order</span>
              <p className="text-lg font-bold text-parchment">Federal Covenant Republic</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gold/70">Sovereign Unit of Account</span>
              <p className="text-lg font-bold text-parchment">Aletheian Guilder (AEY)</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gold/70">Fiscal Policy</span>
              <p className="text-lg font-bold text-parchment">Zero Income Tax / Endowment</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gold/70">Administrative Base</span>
              <p className="text-lg font-bold text-parchment">ICAO & StableChain Native</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT CONTAINER WITH INTERACTIVE TAB SELECTION ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-navy/15 pb-4 mb-12">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${
                activeTab === sec.id
                  ? 'bg-navy text-gold border border-navy shadow-sm'
                  : 'bg-white/80 text-navy/70 border border-navy/10 hover:border-gold/40 hover:text-navy'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* 1. FOUNDATIONS */}
        {activeTab === 'foundations' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">The Genesis of Aletheia</span>
                <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight leading-tight">
                  A state founded not upon conquest, but upon voluntary compact.
                </h2>
                <p className="text-base text-navy/80 leading-relaxed">
                  The Sovereign Covenant State of Aletheia was established to reconcile the ancient European tradition of legal covenant with twenty-first-century institutional engineering. In traditional states, sovereignty resides in historical accident; in Aletheia, sovereignty resides strictly in the Covenant ratified by free citizens.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-2">
                    <div className="flex items-center gap-2 text-navy font-bold text-sm">
                      <Shield className="w-4 h-4 text-gold" />
                      Strict Constitutional Bounds
                    </div>
                    <p className="text-xs text-navy/70 leading-relaxed">
                      Executive authority is legally restricted. The Cabinet cannot exceed nine ministries, and personal taxation is unconstitutional.
                    </p>
                  </div>
                  <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-2">
                    <div className="flex items-center gap-2 text-navy font-bold text-sm">
                      <Lock className="w-4 h-4 text-laurel" />
                      Verifiable State Ledger
                    </div>
                    <p className="text-xs text-navy/70 leading-relaxed">
                      Public laws, corporate titles, land deeds, and sovereign bonds are timestamped permanently on the Aletheia StableChain.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-navy text-parchment p-8 rounded-sm border border-gold/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <StarOfTruth size={180} />
                </div>
                <div className="relative space-y-6">
                  <span className="text-[11px] font-mono tracking-widest uppercase text-gold">Preamble of the Covenant</span>
                  <blockquote className="text-base font-serif italic text-parchment/90 leading-relaxed border-l-2 border-gold pl-4">
                    &ldquo;We, the people of Aletheia, in solemn recognition of the immutable dignity of every human being, establish this Covenant to guarantee inviolable liberty, impartial justice, and common prosperity under the rule of law.&rdquo;
                  </blockquote>
                  <div className="pt-4 border-t border-navy-subtle flex items-center justify-between text-xs font-mono text-parchment/60">
                    <span>Article 1 § 1</span>
                    <Link href="/constitution#art-1" className="text-gold hover:underline flex items-center gap-1">
                      Full Article <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. NATIONAL SYMBOLS */}
        {activeTab === 'symbols' && (
          <div className="space-y-12">
            <div className="max-w-3xl space-y-3">
              <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Insignia of Statehood</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight">
                Emblems of truth, navigation, and maritime heritage.
              </h2>
              <p className="text-navy/75 leading-relaxed">
                The heraldic symbols of Aletheia embody its founding covenants: maritime resilience, Christian civic heritage, wisdom, and the unyielding search for truth.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Coat of Arms */}
              <div className="feature-card rounded-sm p-6 space-y-4 group">
                <div className="h-44 flex items-center justify-center bg-parchment-light rounded-sm border border-navy/10 relative">
                  <Image
                    src="/coat_of_arms.png"
                    alt="Coat of Arms of Aletheia"
                    width={140}
                    height={140}
                    className="object-contain"
                  />
                </div>
                <h3 className="text-base font-bold text-navy">The Sovereign Coat of Arms</h3>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Four heraldic quadrants featuring the Fortified Citadel Tower, the Sacred Heart & Book of Wisdom, the Wheat Sheaf of Abundance, and the Caravel traversing oceanic swells.
                </p>
                <div className="pt-2 border-t border-navy/10 text-[11px] font-mono text-gold font-bold">
                  Motto: Veritas in Foedere
                </div>
              </div>

              {/* The National Flag */}
              <div className="feature-card rounded-sm p-6 space-y-4 group">
                <div className="h-44 flex items-center justify-center bg-navy rounded-sm border border-navy/30 relative p-4">
                  <NationalFlag className="w-40 h-auto shadow-md" />
                </div>
                <h3 className="text-base font-bold text-navy">The Covenant Flag</h3>
                <p className="text-xs text-navy/70 leading-relaxed">
                  The deep Covenant Navy field represents oceanic vigilance, bounded by parchment borders of peace, bearing the radiant eight-pointed Star of Truth in burnished gold.
                </p>
                <div className="pt-2 border-t border-navy/10 text-[11px] font-mono text-navy/60">
                  Standard Ratio: 2:3
                </div>
              </div>

              {/* The Biometric Passport */}
              <div className="feature-card rounded-sm p-6 space-y-4 group">
                <div className="h-44 flex items-center justify-center bg-parchment-light rounded-sm border border-navy/10 relative p-2">
                  <Image
                    src="/passport_cover.png"
                    alt="Aletheia Biometric Passport"
                    width={100}
                    height={140}
                    className="object-contain drop-shadow-md"
                  />
                </div>
                <h3 className="text-base font-bold text-navy">ICAO eMRTD Passport</h3>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Covenant Burgundy cover with gold foil-embossed arms, polycarbonate data page, encrypted contactless biometric chip compliant with ICAO Doc 9303 Part 9 standards.
                </p>
                <div className="pt-2 border-t border-navy/10 text-[11px] font-mono text-covenant-burgundy font-bold">
                  <Link href="/passport" className="hover:underline flex items-center gap-1">
                    View Passport Specs <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. MARITIME SOVEREIGNTY */}
        {activeTab === 'maritime' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">UNCLOS & International Law</span>
                <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight leading-tight">
                  A maritime commonwealth governed by the law of the sea.
                </h2>
                <p className="text-base text-navy/80 leading-relaxed">
                  Aletheia exercises maritime jurisdiction pursuant to the United Nations Convention on the Law of the Sea (UNCLOS), establishing territorial waters, exclusive economic zones, and autonomous deep-sea platforms engineered for multi-century resilience.
                </p>
                <ul className="space-y-3 text-sm text-navy/75">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                    <span><strong>Autonomous Maritime Registry:</strong> Digital vessel flagging with automated international maritime compliance.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                    <span><strong>Deepwater Infrastructure:</strong> Semi-submersible floating platforms and wave-energy harvesting fields.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                    <span><strong>Search & Rescue Protection:</strong> ADSS Maritime Directorate patrols securing international navigational corridors.</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-6 relative h-[380px] rounded-sm overflow-hidden border border-navy/20 shadow-lg">
                <Image
                  src="/images/autonomous_harbor.jpg"
                  alt="Maritime Sovereign Harbor"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent p-6 flex flex-col justify-end text-parchment">
                  <span className="text-[10px] font-mono uppercase text-gold">Harbor Operations</span>
                  <p className="text-lg font-bold">St. Brendan Deepwater Port & Maritime Terminus</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. THE FIVE STATES */}
        {activeTab === 'territories' && (
          <div className="space-y-8">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Federal Territories</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">The Five Federated States</h2>
              <p className="text-sm text-navy/70 leading-relaxed">
                The republic is structured into five distinct territorial states, each possessing statutory self-governance under the Supreme Federal Covenant.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-navy text-lg">Antioch</h3>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Federal District & Capital</span>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Concentric administrative capital hosting the Covenant Assembly, Supreme Court, and National Ledger Validator clusters.
                </p>
              </div>

              <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-navy text-lg">St. Barbara</h3>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Aerospace & Defence</span>
                <p className="text-xs text-navy/70 leading-relaxed">
                  High-security state dedicated to aerospace research, naval installations, satellite telemetry, and defense technologies.
                </p>
              </div>

              <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-navy text-lg">Augustine</h3>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Academic & Life Sciences</span>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Center for advanced medical research, pharmaceutical manufacturing, tertiary polytechnics, and classical humanities.
                </p>
              </div>

              <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-navy text-lg">Benedict</h3>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Clean Industry & Energy</span>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Hub for zero-emission energy grids, desalinisation plants, green hydrogen, and precision robotics.
                </p>
              </div>

              <div className="p-6 bg-white border border-navy/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-navy text-lg">St. Brendan</h3>
                  <StatusBadge status="Planned" size="sm" />
                </div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Maritime Logistics & Trade</span>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Free trade deepwater shipping gateway with automated container handling, ferry links, and bonded customs facilities.
                </p>
              </div>

              <div className="p-6 bg-navy text-parchment rounded-sm space-y-3 flex flex-col justify-center">
                <span className="text-xs font-mono text-gold uppercase">Territorial Masterplan</span>
                <h4 className="text-base font-bold text-parchment">Interactive GIS Spatial Plan</h4>
                <p className="text-xs text-parchment/70">
                  Explore detailed engineering schematics, zoning rules, and nautical coordinates.
                </p>
                <Link href="/development" className="text-xs text-gold font-bold hover:underline inline-flex items-center gap-1 pt-1">
                  View Development Plan <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 5. CIVIC ARCHITECTURE */}
        {activeTab === 'institutions' && (
          <div className="space-y-8">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Separation of Powers</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">Institutional Architecture</h2>
              <p className="text-sm text-navy/70 leading-relaxed">
                Aletheia combines parliamentary scrutiny, state representation, and algorithmic registry oversight to ensure corruption-resistant governance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-white border border-navy/10 rounded-sm space-y-3">
                <div className="icon-sovereign"><Building2 className="w-5 h-5 text-gold" /></div>
                <h3 className="font-bold text-navy text-base">Covenant Assembly</h3>
                <p className="text-xs text-navy/70 leading-relaxed">
                  61-member unicameral parliament elected by proportional representation to debate, amend, and enact statutory legislation.
                </p>
                <Link href="/government#assembly" className="text-xs text-navy font-bold hover:text-gold flex items-center gap-1">
                  Assembly Details <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="p-5 bg-white border border-navy/10 rounded-sm space-y-3">
                <Shield className="w-6 h-6 text-navy" />
                <h3 className="font-bold text-navy text-base">Council of the States</h3>
                <p className="text-xs text-navy/70 leading-relaxed">
                  15-member senate safeguarding territorial autonomy and ensuring equal representation across all five constituent states.
                </p>
                <Link href="/government#senate" className="text-xs text-navy font-bold hover:text-gold flex items-center gap-1">
                  Senate Overview <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="p-5 bg-white border border-navy/10 rounded-sm space-y-3">
                <Lock className="w-6 h-6 text-laurel" />
                <h3 className="font-bold text-navy text-base">The Judiciary & High Court</h3>
                <p className="text-xs text-navy/70 leading-relaxed">
                  Independent constitutional court interpreting the Covenant, alongside automated smart-contract arbitration tribunals.
                </p>
                <Link href="/government#judiciary" className="text-xs text-navy font-bold hover:text-gold flex items-center gap-1">
                  Judicial Framework <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

      </section>

      {/* ── CALL TO ACTION BANNER ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <StarOfTruth size={40} className="mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">
            Become a part of the Aletheian Covenant.
          </h2>
          <p className="text-parchment/70 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Whether as an e-resident building an international enterprise or as an investor in sovereign infrastructure, the gateway to Aletheia is open.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/e-residency"
              className="px-6 py-3 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Start E-Residency Application
            </Link>
            <Link
              href="/citizenship"
              className="px-6 py-3 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Explore Citizenship
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
