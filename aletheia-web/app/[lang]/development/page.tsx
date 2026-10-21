'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { useState } from 'react';
import { NationalMap, NationalMapLegend, REGION_COLORS, type RegionId } from '@/components/development/NationalMap';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHero } from '@/components/ui/PageHero';
import { HexagonCross } from '@/components/brand/Logo';
import { unsplash, type PhotoKey } from '@/lib/imagery';
import type { ManualStatus } from '@/lib/status';
import { MontevideoTable } from '@/components/ui/StatusTables';
import { SeasteadPrinciples } from '@/components/development/SeasteadPrinciples';
import { LeaseLessons } from '@/components/development/LeaseLessons';
import { BuildFinancing } from '@/components/development/BuildFinancing';
import { Anchor, ArrowRight, Building2, CheckCircle, Cpu, Fish, Globe, GraduationCap, Shield, Sprout, TreePine, Wheat, Zap } from 'lucide-react';

const DISTRICTS = [
  { name: 'Civic Core', ring: 'Ring 0 — Central', desc: 'The Constitutional Plaza, Covenant Assembly Hall, High Court and Chancellery, arranged around the Star of Truth.', icon: Building2 },
  { name: 'Financial Quarter', ring: 'Ring 1 — Inner', desc: 'Treasury, the Reserve Bank of Aletheia, the StableChain validator cluster and licensed financial institutions.', icon: Cpu },
  { name: 'Maritime & Port District', ring: 'Ring 2 — Coastal', desc: 'A coastguard station, customs and immigration facilities and a free-trade processing zone.', icon: Anchor },
  { name: 'Energy & Industrial Zone', ring: 'Ring 3 — Perimeter', desc: 'Offshore wind substation, SMR facility, hydrogen production and desalination infrastructure.', icon: Zap },
  { name: 'Residential Cantons', ring: 'Rings 1–2 — Interspersed', desc: 'Four mixed-use cantons with mandatory green coverage, woven between civic and commercial zones.', icon: TreePine },
  { name: 'International District', ring: 'Ring 2 — North Sector', desc: 'Embassies, trade missions, an airport terminal and conference facilities.', icon: Globe },
];

const PRINCIPLES = [
  { label: 'Six Radial Avenues', desc: 'Emanating from the Constitutional Plaza, each named after a founding covenant principle.' },
  { label: 'Hexagonal Block Grid', desc: 'Consistent with the Star of Truth motif — efficiency, symmetry and civic legibility.' },
  { label: 'Ledger-First Infrastructure', desc: 'Land titles, building permits and utility connections recorded immutably on StableChain.' },
  { label: '40% Green Coverage', desc: 'A proposed constitutional floor on residential and civic zones, with no development without tree offsets.' },
  { label: 'Underground Utility Spine', desc: 'Power, water, fibre and waste routed below grade to protect the street-level civic realm.' },
  { label: 'Walkable 15-Minute City', desc: 'Every residence within a 15-minute walk of work, school, healthcare and transit.' },
];

interface State {
  id: string;
  name: string;
  capital: string;
  quarter: string;
  mandate: string;
  desc: string;
  image: PhotoKey;
  icon: typeof Shield;
  accent: string;
  focus: string[];
  link: { href: string; label: string };
}

const STATES: State[] = [
  {
    id: 'barbara',
    name: 'St. Barbara State',
    capital: 'Port Michael',
    quarter: 'Quarter I · The Tower',
    mandate: 'Aerospace, resilience & cyber',
    desc: 'The guardian state: aerospace engineering, planned civil-protection and resilience functions, and the operations centre of the Aletheian Cybersecurity Department, under strict civilian command.',
    image: 'circuitGlow',
    icon: Shield,
    accent: 'bg-navy',
    focus: ['Coastguard & rescue station', 'Cyber Operations Centre', 'Aerospace test range'],
    link: { href: '/adss', label: 'Resilience & Civil Protection' },
  },
  {
    id: 'augustine',
    name: 'Augustine State',
    capital: 'Port Luke',
    quarter: 'Quarter II · Book & Heart',
    mandate: 'Medicine, learning & research',
    desc: 'The state of the mind and the body: the National University, the Augustine Medical Campus and a biomedical research park built around open science.',
    image: 'lecture',
    icon: GraduationCap,
    accent: 'bg-burgundy',
    focus: ['National University of Aletheia', 'Augustine Medical Campus', 'Biomedical Research Park'],
    link: { href: '/education', label: 'Education & Research' },
  },
  {
    id: 'benedict',
    name: 'Benedict State',
    capital: 'San José',
    quarter: 'Quarter III · Wheat & Sun',
    mandate: 'Energy, industry & agriculture',
    desc: 'The working state: offshore wind, small modular reactors, desalination, clean manufacturing and the agricultural heartland that feeds the Sovereign Covenant State.',
    image: 'offshoreWind',
    icon: Zap,
    accent: 'bg-gold',
    focus: ['Offshore wind array', 'SMR & green hydrogen hub', 'Desalination & clean manufacturing'],
    link: { href: '/energy', label: 'Clean Energy' },
  },
  {
    id: 'brendan',
    name: 'St. Brendan State',
    capital: 'Port Nicholas',
    quarter: 'Quarter IV · Caravel on Waves',
    mandate: 'Ports, trade & logistics',
    desc: 'The seafaring state: a deepwater container terminal, ferry links and a free-trade logistics zone that would connect Aletheia to the world.',
    image: 'containerShip',
    icon: Anchor,
    accent: 'bg-laurel',
    focus: ['Deepwater container terminal', 'Ferry & passenger hub', 'Free-trade logistics zone'],
    link: { href: '/infrastructure', label: 'Ports & Coastal Works' },
  },
];

const ROADMAP: { year: string; title: string; status: ManualStatus }[] = [
  { year: 'Phase 0', title: 'Founding community, digital institutions & StableChain testnet', status: 'Under Development' },
  { year: 'Phase 1', title: 'Founding Thesis, legal counsel & seastead engineering research', status: 'Planned' },
  { year: 'Phase 2', title: 'Platform design, site survey & seed funding', status: 'Planned' },
  { year: 'Phase 3', title: 'A pilot platform, built and owned by Aletheia', status: 'Planned' },
  { year: 'Vision', title: 'Antioch & the maritime districts', status: 'Vision' },
];

export default function DevelopmentPage() {
  const { t, tx } = useI18n();
  const [activeRegion, setActiveRegion] = useState<RegionId | null>(null);
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow={t("A Sovereign Seastead")}
        asset="territory"
        image="oceanAerial"
        title={<>{t("A seastead of our own,")}{' '}<span className="text-gold-metallic">{t("a capital by design.")}</span></>}
        lead={t("Aletheia will not lease land from another state. It will build its own territory at sea, beginning with a single pilot platform. Antioch and the four founding states are long-term design studies.")}
      >
        <Link href="#seastead" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">{t("The Seastead")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/founding-members" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("Register interest")}</Link>
      </PageHero>

      {/* ── STATS ── */}
      <section className="bg-navy-deep border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 md:divide-x divide-gold/15 gap-y-2">
          {[
            { v: 'At sea', l: 'Territory', s: 'Beginning with a pilot platform' },
            { v: '1 + 4', l: 'Districts & states', s: 'A long-term design study' },
            { v: '6', l: 'Radial avenues', s: 'From the Constitutional Plaza' },
            { v: '40%', l: 'Green coverage', s: 'Proposed constitutional floor' },
            { v: 'On-ledger', l: 'Land registry', s: 'Proposed: every title provable' },
          ].map((m) => (
            <div key={m.l} className="py-7 px-4 text-center space-y-1">
              <div className="big-stat-value">{tx(m.v)}</div>
              <div className="text-xs font-semibold text-parchment/90">{tx(m.l)}</div>
              <div className="text-[10px] text-parchment/40">{tx(m.s)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── A SOVEREIGN SEASTEAD ── */}
      <section id="seastead" className="section-xl border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-4">
            <div className="eyebrow">{t("A Sovereign Seastead")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("Aletheia will not lease land. It will build its own.")}</h2>
            <p className="text-navy/65 leading-[1.85] font-light">{t("Land leased from an existing state can be taken back, and a nation built on it would live under its landlord’s law. Aletheia will instead be a seastead: platforms that it designs, builds and owns outright, sited beyond any state’s exclusive economic zone under the freedoms of the high seas. It begins with a single pilot platform and grows platform by platform. Recognition as a state is not automatic; it must be earned, openly, from other nations.")}</p>
          </div>
          <SeasteadPrinciples />
          <LeaseLessons />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-2xl font-bold text-navy">{t("The path to statehood")}</h3>
              <p className="text-sm text-navy/62 leading-relaxed">{t("Aletheia measures itself honestly against the four Montevideo criteria:")}</p>
              <MontevideoTable />
            </div>
            <div className="lg:col-span-5 bg-navy-deep text-parchment rounded-sm border border-gold/25 p-7 space-y-4">
              <h3 className="text-lg font-bold">{t("Everything below is a design study")}</h3>
              <p className="text-sm text-parchment/72 leading-relaxed font-light">{t("Antioch and the four founding states describe Aletheia’s long-term national design. They are design studies for the future, not current holdings. They would be built at sea, platform by platform, beginning with a single pilot platform.")}</p>
              <Link href="/roadmap" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold hover:text-gold-tint transition-colors group">{t("See the roadmap")}{' '}<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINANCING THE BUILD ── */}
      <section id="financing" className="section-xl border-b border-navy/08 bg-parchment-light scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BuildFinancing />
        </div>
      </section>

      {/* ── MAP ── */}
      <section id="map" className="section-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="eyebrow">{t("Design-Study Map")}</div>
              <StatusBadge asset="antioch" size="sm" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("Select a territory to explore its mandate.")}</h2>
            <p className="text-navy/65 leading-[1.85] font-light">{t("The design-study map: the Antioch Federal District at the centre, ringed by the four founding states, each carrying one quarter of the national arms and a distinct economic mandate. It shows no real place; the layout would be adapted to the platforms as they are built.")}</p>
            <ul className="space-y-2">
              {[{ id: 'antioch', name: 'Antioch Federal District', capital: 'Antioch' }, ...STATES].map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onMouseEnter={() => setActiveRegion(s.id as RegionId)}
                    onMouseLeave={() => setActiveRegion(null)}
                    onFocus={() => setActiveRegion(s.id as RegionId)}
                    onBlur={() => setActiveRegion(null)}
                    className={`group flex items-center justify-between py-3 px-4 bg-white border rounded-sm hover:border-gold/50 hover:shadow-institutional transition-all ${activeRegion === s.id ? 'border-gold/60 shadow-institutional' : 'border-navy/10'}`}
                  >
                    <span className="flex items-center gap-3 text-sm font-bold text-navy">
                      <span className="w-3 h-3 rounded-sm border border-navy/25" style={{ backgroundColor: REGION_COLORS[s.id as RegionId].fill }} /> {tx(s.name)}
                      <span className="text-[11px] font-normal text-navy/50">{tx(s.capital)}</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7">
            <figure className="bg-white rounded-sm border border-gold/30 shadow-elevated overflow-hidden">
              <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5 border-b border-navy/10">
                <span className="text-sm font-bold text-navy tracking-tight">{t("The Sovereign Covenant State of Aletheia")}</span>
                <span className="text-[11px] font-mono text-navy/55">{t("Design study · not a real location · grid in km from Covenant Square")}</span>
              </figcaption>
              <p className="sm:hidden px-5 pt-3 text-[11px] text-navy/55">{t("Swipe sideways to explore the full map.")}</p>
              <div className="overflow-x-auto">
                <div className="min-w-[620px]">
                  <NationalMap active={activeRegion} onActiveChange={setActiveRegion} />
                </div>
              </div>
              <div className="px-5 py-3.5 border-t border-navy/10 bg-parchment-light/40">
                <NationalMapLegend />
              </div>
            </figure>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <figure className="bg-white rounded-sm border border-gold/30 shadow-elevated overflow-hidden">
            <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 border-b border-navy/10">
              <span className="flex items-center gap-3">
                <span className="text-sm font-bold text-navy tracking-tight">{t("Strategic Blueprint")}</span>
                <StatusBadge asset="antioch" size="sm" />
              </span>
              <span className="text-[11px] font-mono text-navy/55">{t("Aerial concept · design study, not a real place")}</span>
            </figcaption>
            <a href="/images/national-blueprint.webp" target="_blank" rel="noopener" className="block relative">
              <Image
                src="/images/national-blueprint.webp"
                alt={t("Aerial concept of the Sovereign Covenant State of Aletheia: the Antioch Federal District at the centre, ringed by St. Barbara, Augustine, St. Brendan and Benedict States")}
                width={1168}
                height={784}
                sizes="(min-width:1280px) 1216px, 100vw"
                className="w-full h-auto"
              />
            </a>
          </figure>
        </div>
      </section>

      {/* ── ANTIOCH ── */}
      <section id="antioch" className="guilloche-hero relative overflow-hidden text-parchment section-xl">
        <div className="orb-gold w-[520px] h-[520px] -top-40 -left-40 opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center gap-3">
                <HexagonCross size={22} />
                <div className="eyebrow" style={{ color: '#E4C689' }}>{t("Antioch · Vision · design study")}</div>
                <StatusBadge asset="antioch" size="sm" />
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">{t("The concentric capital.")}</h2>
              <p className="text-parchment/70 leading-[1.85] font-light">{t("In the design study, six radial avenues connect three concentric rings to a central hexagonal plaza for the Covenant Assembly, the High Court and the ledger's validators. Every residence would sit within a fifteen-minute walk of work, school and care.")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRINCIPLES.map((p) => (
                  <div key={p.label} className="p-4 bg-navy/50 border border-gold/15 rounded-sm hover:border-gold/40 transition-colors space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold"><CheckCircle className="w-3.5 h-3.5 text-gold shrink-0" /> {tx(p.label)}</div>
                    <p className="text-xs text-parchment/55 leading-relaxed">{tx(p.desc)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-6 photo-card relative h-[520px] rounded-sm border border-gold/30 shadow-elevated">
              <Image src="/images/architecture_antioch.jpg" alt={t("Concept of Antioch's concentric civic architecture")} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/80 via-transparent to-transparent" />
            </div>
          </div>

          <div id="masterplan" className="space-y-6">
            <h3 className="text-2xl font-bold">{t("Six districts across four rings")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DISTRICTS.map(({ name, ring, desc, icon: Icon }) => (
                <div key={name} className="dark-feature-card rounded-sm p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-gold" />
                    <span className="text-[10px] font-mono text-gold-tint/70">{tx(ring)}</span>
                  </div>
                  <h4 className="text-base font-bold">{tx(name)}</h4>
                  <p className="text-xs text-parchment/60 leading-relaxed">{tx(desc)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOUR STATES ── */}
      <section className="section-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">{t("The Four Founding States")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("Four quarters of the arms. Four mandates of the Sovereign Covenant State.")}</h2>
            <p className="text-sm text-navy/60 leading-relaxed">{t("Design studies for the long term, not current holdings.")}</p>
          </div>

          {STATES.map((s, i) => {
            const Icon = s.icon;
            return (
              <article key={s.id} id={s.id} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                <div className={`lg:col-span-7 photo-card relative h-[380px] lg:h-[460px] rounded-sm border border-gold/20 shadow-elevated ${i % 2 ? 'lg:order-2' : ''}`}>
                  <Image src={unsplash(s.image, 1400)} alt="" fill sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/80 via-navy-deep/10 to-transparent" />
                  <div className="absolute bottom-6 left-6 text-parchment">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-tint block">{tx(s.quarter)}</span>
                    <span className="text-lg font-bold">{tx(s.mandate)}</span>
                  </div>
                </div>
                <div className="lg:col-span-5 space-y-5">
                  <div className={`h-1 w-16 ${s.accent}`} />
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-navy text-gold rounded-sm"><Icon className="w-5 h-5" /></div>
                    <StatusBadge asset="antioch" size="sm" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-navy tracking-tight">{tx(s.name)}</h3>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-gold-shadow">{t("Capital ·")}{' '}{tx(s.capital)}</span>
                  </div>
                  <p className="text-navy/65 leading-[1.85] font-light">{tx(s.desc)}</p>
                  <ul className="space-y-2">
                    {s.focus.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm font-medium text-navy"><CheckCircle className="w-4 h-4 text-laurel shrink-0" /> {tx(f)}</li>
                    ))}
                  </ul>
                  <Link href={s.link.href} className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
                    {tx(s.link.label)} <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── AGRICULTURE ── */}
      <section id="agriculture" className="relative overflow-hidden text-parchment">
        <div className="absolute inset-0 animate-ken-burns" aria-hidden="true">
          <Image src={unsplash('windMeadow', 2000)} alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#060C14]/95 via-[#0E1B31]/80 to-[#0E1B31]/30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="eyebrow" style={{ color: '#E4C689' }}>{t("Agriculture & Aquaculture")}</div>
              <StatusBadge status="Vision" size="sm" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">{t("Food security for a maritime nation.")}</h2>
            <p className="text-parchment/72 leading-[1.85] font-light">{t("A design study for a resilient food system in Benedict State: protected-climate agriculture powered by surplus wind, sustainable aquaculture, and desalinated irrigation.")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 content-center">
            {[
              { icon: Wheat, title: 'Protected-climate farming', desc: 'Year-round greenhouse cultivation on renewable heat and light.' },
              { icon: Fish, title: 'Sustainable aquaculture', desc: 'Offshore fish and seaweed farms co-located with wind arrays.' },
              { icon: Sprout, title: 'Soil & seed covenant', desc: 'Seed banks and soil health recorded on the national registry.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-navy-dark rounded-sm p-5 flex gap-4 border border-gold/20">
                <Icon className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <div><h3 className="text-sm font-bold">{tx(title)}</h3><p className="text-xs text-parchment/60 mt-1">{tx(desc)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section className="section-lg bg-parchment-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">{t("Development Roadmap")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy">{t("From covenant to capital.")}</h2>
          </div>
          <ol className="relative grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="hidden md:block absolute top-[22px] left-0 right-0 h-px bg-gradient-to-r from-laurel via-gold to-navy/20" aria-hidden="true" />
            {ROADMAP.map((r, i) => (
              <li key={r.year} className="relative space-y-3" data-reveal>
                <span className="relative z-10 inline-flex w-11 h-11 rounded-full bg-navy text-gold font-mono text-xs font-bold items-center justify-center border-2 border-parchment-light shadow-institutional">
                  {i}
                </span>
                <div className="space-y-2">
                  <span className="block font-mono text-sm font-bold text-gold-shadow">{tx(r.year)}</span>
                  <p className="text-sm font-semibold text-navy leading-snug">{tx(r.title)}</p>
                  <StatusBadge status={r.status} size="sm" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cta-banner py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-3xl font-bold text-parchment">{t("Help build the first platform.")}</h2>
            <p className="text-parchment/60 text-sm font-light">{t("Aletheia is forming its founding community: engineers, lawyers, financiers and future residents.")}</p>
          </div>
          <Link href="/founding-members" className="btn-sovereign-gold px-8 py-4 rounded-sm text-sm flex items-center gap-2 group">{t("Register interest")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
