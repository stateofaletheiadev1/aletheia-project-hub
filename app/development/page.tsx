import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHero } from '@/components/ui/PageHero';
import { HexagonCross } from '@/components/brand/Logo';
import { unsplash, type PhotoKey } from '@/lib/imagery';
import type { NationalStatus } from '@/lib/status';
import { Anchor, ArrowRight, Building2, CheckCircle, Cpu, Fish, Globe, GraduationCap, Shield, Sprout, TreePine, Wheat, Zap } from 'lucide-react';

const DISTRICTS = [
  { name: 'Civic Core', ring: 'Ring 0 — Central', desc: 'The Constitutional Plaza, Covenant Assembly Hall, High Court and Chancellery, arranged around the Star of Truth.', icon: Building2 },
  { name: 'Financial Quarter', ring: 'Ring 1 — Inner', desc: 'Treasury, Central Bank, the StableChain validator cluster and licensed financial institutions.', icon: Cpu },
  { name: 'Maritime & Port District', ring: 'Ring 2 — Coastal', desc: 'Coast Guard headquarters, customs and immigration facilities and the free-trade processing zone.', icon: Anchor },
  { name: 'Energy & Industrial Zone', ring: 'Ring 3 — Perimeter', desc: 'Offshore wind substation, SMR facility, hydrogen production and desalination infrastructure.', icon: Zap },
  { name: 'Residential Cantons', ring: 'Rings 1–2 — Interspersed', desc: 'Four mixed-use cantons with mandatory green coverage, woven between civic and commercial zones.', icon: TreePine },
  { name: 'International District', ring: 'Ring 2 — North Sector', desc: 'Embassy row, trade missions, the ICAO-compliant airport terminal and conference facilities.', icon: Globe },
];

const PRINCIPLES = [
  { label: 'Six Radial Avenues', desc: 'Emanating from the Constitutional Plaza, each named after a founding covenant principle.' },
  { label: 'Hexagonal Block Grid', desc: 'Consistent with the Star of Truth motif — efficiency, symmetry and civic legibility.' },
  { label: 'Ledger-First Infrastructure', desc: 'Land titles, building permits and utility connections recorded immutably on StableChain.' },
  { label: '40% Green Coverage', desc: 'A constitutional floor on residential and civic zones. No development without arboricultural offset.' },
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
    mandate: 'Aerospace, defence & cyber',
    desc: 'The guardian state: aerospace engineering, secure maritime installations and the operations centre of the Aletheian Cybersecurity Department, under strict civilian command.',
    image: 'circuitGlow',
    icon: Shield,
    accent: 'bg-navy',
    focus: ['ADSS naval & coast guard base', 'National Cyber Operations Centre', 'Aerospace test range'],
    link: { href: '/adss', label: 'Defence & Security Service' },
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
    desc: 'The working state: offshore wind, small modular reactors, desalination, clean manufacturing and the agricultural heartland that feeds the Republic.',
    image: 'offshoreWind',
    icon: Zap,
    accent: 'bg-gold',
    focus: ['1.2 GW offshore wind array', 'SMR & green hydrogen hub', 'Desalination & clean manufacturing'],
    link: { href: '/energy', label: 'Sovereign Energy Grid' },
  },
  {
    id: 'brendan',
    name: 'St. Brendan State',
    capital: 'Port Nicholas',
    quarter: 'Quarter IV · Caravel on Waves',
    mandate: 'Ports, trade & logistics',
    desc: 'The seafaring state: a deepwater container terminal, naval docks, North Sea ferry links and the free-trade logistics zone that connects Aletheia to the world.',
    image: 'containerShip',
    icon: Anchor,
    accent: 'bg-laurel',
    focus: ['Deepwater container terminal', 'North Sea ferry & passenger hub', 'Free-trade logistics zone'],
    link: { href: '/infrastructure', label: 'Maritime Infrastructure' },
  },
];

const ROADMAP: { year: string; title: string; status: NationalStatus }[] = [
  { year: '2026', title: 'Constitution, registries & digital platform', status: 'Operational' },
  { year: '2027', title: 'Geotechnical surveys & port concessions', status: 'Under Development' },
  { year: '2028', title: 'Antioch civic core & St. Brendan terminal', status: 'Planned' },
  { year: '2030', title: 'Offshore wind, university & medical campus', status: 'Planned' },
  { year: '2035', title: 'Four founding states fully inhabited', status: 'Vision' },
];

/** Schematic territorial map: Antioch at the centre, four states in quadrants. */
function TerritoryMap() {
  const regions = [
    { id: 'barbara', label: 'St. Barbara', d: 'M20 20 H190 L190 150 L130 190 H20 Z', tx: 80, ty: 95 },
    { id: 'augustine', label: 'Augustine', d: 'M210 20 H380 V190 H270 L210 150 Z', tx: 300, ty: 95 },
    { id: 'benedict', label: 'Benedict', d: 'M20 210 H130 L190 250 V380 H20 Z', tx: 80, ty: 305 },
    { id: 'brendan', label: 'St. Brendan', d: 'M270 210 H380 V380 H210 V250 Z', tx: 300, ty: 305 },
  ];
  return (
    <svg viewBox="0 0 400 400" className="w-full h-auto" role="img" aria-labelledby="map-title">
      <title id="map-title">Schematic map of Antioch and the four founding states</title>
      <defs>
        <pattern id="map-hex" width="18" height="15.6" patternUnits="userSpaceOnUse">
          <polygon points="9,0.5 17.5,4.5 17.5,11 9,15 0.5,11 0.5,4.5" fill="none" stroke="#C49A4E" strokeOpacity="0.12" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="#0B1626" />
      <rect width="400" height="400" fill="url(#map-hex)" />
      {regions.map((r) => (
        <a key={r.id} href={`#${r.id}`} className="group cursor-pointer" aria-label={`${r.label} State`}>
          <path d={r.d} className="fill-[#15294A] stroke-[#C49A4E]/50 transition-all duration-300 group-hover:fill-[#1C3660] group-hover:stroke-[#E4C689] group-focus:fill-[#1C3660]" strokeWidth="1.2" />
          <text x={r.tx} y={r.ty} textAnchor="middle" className="fill-[#F4EEDF] text-[13px] font-bold tracking-wide pointer-events-none">{r.label}</text>
          <text x={r.tx} y={r.ty + 16} textAnchor="middle" className="fill-[#C49A4E] text-[9px] uppercase tracking-[0.2em] pointer-events-none">State</text>
        </a>
      ))}
      <a href="#antioch" className="group cursor-pointer" aria-label="Antioch Federal District">
        <circle cx="200" cy="200" r="70" fill="none" stroke="#C49A4E" strokeOpacity="0.25" strokeDasharray="3 4" className="animate-rotate-slow origin-center" style={{ transformBox: 'fill-box' }} />
        <polygon points="200,145 248,172 248,228 200,255 152,228 152,172" className="fill-[#701824] stroke-[#E4C689] transition-all duration-300 group-hover:fill-[#8a1f2e]" strokeWidth="1.5" />
        <text x="200" y="198" textAnchor="middle" className="fill-[#F4EEDF] text-[14px] font-bold pointer-events-none">Antioch</text>
        <text x="200" y="214" textAnchor="middle" className="fill-[#E4C689] text-[8px] uppercase tracking-[0.2em] pointer-events-none">Federal District</text>
      </a>
      <text x="390" y="394" textAnchor="end" className="fill-[#C49A4E]/50 text-[8px] font-mono">SCHEMATIC · NOT TO SCALE</text>
    </svg>
  );
}

export default function DevelopmentPage() {
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow="Territorial Development"
        status="Planned"
        image="oceanAerial"
        title={<>A capital and four states, <span className="text-gold-metallic">designed from first principles.</span></>}
        lead="Antioch is planned as a concentric, hexagonal 15-minute city at the heart of four specialised maritime states — with every land title, permit and utility connection anchored to the public ledger."
      >
        <Link href="#map" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">
          Explore the map <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/economy#bonds" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">Infrastructure bonds</Link>
      </PageHero>

      {/* ── STATS ── */}
      <section className="bg-navy-deep border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-gold/15">
          {[
            { v: '1 + 4', l: 'Districts & states', s: 'Antioch and four founding states' },
            { v: '6', l: 'Radial avenues', s: 'From the Constitutional Plaza' },
            { v: '40%', l: 'Green coverage', s: 'Constitutional floor' },
            { v: 'On-ledger', l: 'Land registry', s: 'Every title provable' },
          ].map((m) => (
            <div key={m.l} className="py-7 px-4 text-center space-y-1">
              <div className="big-stat-value">{m.v}</div>
              <div className="text-xs font-semibold text-parchment/90">{m.l}</div>
              <div className="text-[10px] text-parchment/40">{m.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MAP ── */}
      <section id="map" className="section-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="eyebrow">Interactive Territorial Map</div>
              <StatusBadge status="Under Development" size="sm" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">Select a territory to explore its mandate.</h2>
            <p className="text-navy/65 leading-[1.85] font-light">
              Each state carries one of the four quarters of the national arms and a distinct economic mandate. A GIS-grade spatial plan
              with zoning layers is in development; this schematic shows the constitutional arrangement.
            </p>
            <ul className="space-y-2">
              {[{ id: 'antioch', name: 'Antioch Federal District', accent: 'bg-burgundy' }, ...STATES].map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="group flex items-center justify-between py-3 px-4 bg-white border border-navy/10 rounded-sm hover:border-gold/50 hover:shadow-institutional transition-all">
                    <span className="flex items-center gap-3 text-sm font-bold text-navy">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.accent}`} /> {s.name}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-sm overflow-hidden border border-gold/30 shadow-elevated gold-glow">
              <TerritoryMap />
            </div>
          </div>
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
                <div className="eyebrow" style={{ color: '#E4C689' }}>Antioch · Federal District</div>
                <StatusBadge status="Planned" size="sm" />
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">The concentric capital.</h2>
              <p className="text-parchment/70 leading-[1.85] font-light">
                Six radial avenues connect three concentric rings to a central hexagonal plaza housing the Covenant Assembly, the High Court
                and the state validator vaults. Every residence sits within a fifteen-minute walk of work, school and care.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRINCIPLES.map((p) => (
                  <div key={p.label} className="p-4 bg-navy/50 border border-gold/15 rounded-sm hover:border-gold/40 transition-colors space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold"><CheckCircle className="w-3.5 h-3.5 text-gold shrink-0" /> {p.label}</div>
                    <p className="text-xs text-parchment/55 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-6 photo-card relative h-[520px] rounded-sm border border-gold/30 shadow-elevated">
              <Image src="/images/architecture_antioch.jpg" alt="Concept of Antioch's concentric civic architecture" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/80 via-transparent to-transparent" />
            </div>
          </div>

          <div id="masterplan" className="space-y-6">
            <h3 className="text-2xl font-bold">Six districts across four rings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DISTRICTS.map(({ name, ring, desc, icon: Icon }) => (
                <div key={name} className="dark-feature-card rounded-sm p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-gold" />
                    <span className="text-[10px] font-mono text-gold-tint/70">{ring}</span>
                  </div>
                  <h4 className="text-base font-bold">{name}</h4>
                  <p className="text-xs text-parchment/60 leading-relaxed">{desc}</p>
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
            <div className="eyebrow">The Four Founding States</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">Four quarters of the arms. Four mandates of the Republic.</h2>
          </div>

          {STATES.map((s, i) => {
            const Icon = s.icon;
            return (
              <article key={s.id} id={s.id} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                <div className={`lg:col-span-7 photo-card relative h-[380px] lg:h-[460px] rounded-sm border border-gold/20 shadow-elevated ${i % 2 ? 'lg:order-2' : ''}`}>
                  <Image src={unsplash(s.image, 1400)} alt="" fill sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/80 via-navy-deep/10 to-transparent" />
                  <div className="absolute bottom-6 left-6 text-parchment">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-tint block">{s.quarter}</span>
                    <span className="text-lg font-bold">{s.mandate}</span>
                  </div>
                </div>
                <div className="lg:col-span-5 space-y-5">
                  <div className={`h-1 w-16 ${s.accent}`} />
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-navy text-gold rounded-sm"><Icon className="w-5 h-5" /></div>
                    <StatusBadge status="Planned" size="sm" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-navy tracking-tight">{s.name}</h3>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-gold-shadow">Capital · {s.capital}</span>
                  </div>
                  <p className="text-navy/65 leading-[1.85] font-light">{s.desc}</p>
                  <ul className="space-y-2">
                    {s.focus.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm font-medium text-navy"><CheckCircle className="w-4 h-4 text-laurel shrink-0" /> {f}</li>
                    ))}
                  </ul>
                  <Link href={s.link.href} className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
                    {s.link.label} <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
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
              <div className="eyebrow" style={{ color: '#E4C689' }}>Agriculture &amp; Aquaculture</div>
              <StatusBadge status="Proposed" size="sm" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">Food security for a maritime republic.</h2>
            <p className="text-parchment/72 leading-[1.85] font-light">
              The Ministry of Agriculture &amp; Environment plans a resilient food system for Benedict State: protected-climate agriculture powered
              by surplus wind, sustainable North Sea aquaculture, and desalinated irrigation.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 content-center">
            {[
              { icon: Wheat, t: 'Protected-climate farming', d: 'Year-round greenhouse cultivation on renewable heat and light.' },
              { icon: Fish, t: 'Sustainable aquaculture', d: 'Offshore fish and seaweed farms co-located with wind arrays.' },
              { icon: Sprout, t: 'Soil & seed covenant', d: 'Seed banks and soil health recorded on the national registry.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="glass-navy-dark rounded-sm p-5 flex gap-4 border border-gold/20">
                <Icon className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <div><h3 className="text-sm font-bold">{t}</h3><p className="text-xs text-parchment/60 mt-1">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section className="section-lg bg-parchment-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">Development Roadmap</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy">From covenant to capital.</h2>
          </div>
          <ol className="relative grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="hidden md:block absolute top-[22px] left-0 right-0 h-px bg-gradient-to-r from-laurel via-gold to-navy/20" aria-hidden="true" />
            {ROADMAP.map((r) => (
              <li key={r.year} className="relative space-y-3" data-reveal>
                <span className="relative z-10 inline-flex w-11 h-11 rounded-full bg-navy text-gold font-mono text-xs font-bold items-center justify-center border-2 border-parchment-light shadow-institutional">
                  {r.year.slice(2)}
                </span>
                <div className="space-y-2">
                  <span className="block font-mono text-sm font-bold text-gold-shadow">{r.year}</span>
                  <p className="text-sm font-semibold text-navy leading-snug">{r.title}</p>
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
            <h2 className="text-3xl font-bold text-parchment">Invest in the infrastructure of a new republic.</h2>
            <p className="text-parchment/60 text-sm font-light">Covenant Development Bonds fund the physical build-out of Antioch — denominated in AEY, fully on-ledger, with quarterly audited reporting.</p>
          </div>
          <Link href="/invest" className="btn-sovereign-gold px-8 py-4 rounded-sm text-sm flex items-center gap-2 group">
            Sovereign investment <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
