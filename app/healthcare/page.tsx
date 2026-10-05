import Link from 'next/link';
import Image from 'next/image';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { routeMetadata } from '@/lib/routes';
import { unsplash } from '@/lib/imagery';
import type { NationalStatus } from '@/lib/status';
import {
  Activity,
  ArrowRight,
  Baby,
  HeartPulse,
  Hospital,
  KeyRound,
  LifeBuoy,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';

export const metadata = routeMetadata('/healthcare');

const PRINCIPLES = [
  { icon: HeartPulse, title: 'Universal by covenant', desc: 'Every citizen and lawful resident is covered from the first day of residence. Care is never conditional on employment.' },
  { icon: Baby, title: 'Children & mothers first', desc: 'Maternity, paediatric and preventive care carry no point-of-care charge, funded directly by the Covenant Endowment.' },
  { icon: KeyRound, title: 'Patient-held records', desc: 'Medical records belong to the patient. Clinicians gain access only by explicit, revocable, logged consent.' },
  { icon: ShieldCheck, title: 'Audited outcomes', desc: 'Waiting times, outcomes and spending per facility are published openly and reviewed by the Auditor-General.' },
];

const PATHWAY = [
  { step: '01', title: 'Neighbourhood clinic', desc: 'Every residence within 15 minutes of a family-medicine clinic — the Antioch walkability standard.' },
  { step: '02', title: 'Specialist referral', desc: 'Digital referral with a published maximum wait for each specialty, tracked against the national target.' },
  { step: '03', title: 'Augustine Medical Campus', desc: 'Tertiary hospital, trauma centre and teaching faculty co-located with the National University.' },
  { step: '04', title: 'Recovery & home care', desc: 'Rehabilitation, community nursing and family support coordinated from discharge onwards.' },
];

const SERVICES: { icon: typeof Hospital; title: string; desc: string; status: NationalStatus }[] = [
  { icon: Hospital, title: 'St. Luke National Research Hospital', desc: 'Teaching hospital and trauma centre at the heart of the Augustine Medical Campus, Port Luke.', status: 'Planned' },
  { icon: Stethoscope, title: 'Family Medicine Network', desc: 'Primary-care clinics integrated into every residential canton of Antioch.', status: 'Planned' },
  { icon: Activity, title: 'National Health Registry', desc: 'Consent ledger and patient-held record standard (HL7 FHIR R5).', status: 'Under Development' },
  { icon: LifeBuoy, title: 'Maritime Medical Rescue', desc: 'Helicopter and vessel-borne emergency care with the ADSS Coast Guard.', status: 'Planned' },
];

export default function HealthcarePage() {
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow="Ministry of Health & Social Well-being"
        status="Planned"
        image="pharma"
        title={<>Care that is <span className="text-gold-metallic">owed</span>, not sold.</>}
        lead="Aletheia treats health as a covenant obligation of the State to every member of the community: universal coverage, patient-owned records, and outcomes published for anyone to audit."
      >
        <Link href="#registry" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">
          The Health Registry <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/government" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">All ministries</Link>
      </PageHero>

      {/* ── METRICS ── */}
      <section className="bg-navy-deep border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-gold/15">
          {[
            { v: '100%', l: 'Population coverage', s: 'Citizens & lawful residents' },
            { v: '€0', l: 'Maternity & paediatrics', s: 'At the point of care' },
            { v: '15 min', l: 'Walk to primary care', s: 'Antioch design target' },
            { v: 'FHIR R5', l: 'Record standard', s: 'Patient-held, portable' },
          ].map((m) => (
            <div key={m.l} className="py-7 px-4 text-center space-y-1">
              <div className="big-stat-value">{m.v}</div>
              <div className="text-xs font-semibold text-parchment/90">{m.l}</div>
              <div className="text-[10px] text-parchment/40">{m.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRINCIPLES ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-3">
            <div className="eyebrow">Founding Principles</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">Four promises written into the health covenant.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card rounded-sm p-7 space-y-4">
                <div className="icon-sovereign"><Icon className="w-5 h-5 text-gold" /></div>
                <h3 className="text-base font-bold text-navy">{title}</h3>
                <p className="text-sm text-navy/62 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REGISTRY ── */}
      <section id="registry" className="bg-parchment-light section-xl border-y border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-6 relative">
            <div className="photo-card relative h-[460px] rounded-sm border border-gold/20 shadow-elevated">
              <Image src={unsplash('clinician', 1200)} alt="A clinician reviewing a patient record on a laptop" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-transparent" />
            </div>
            <div className="hidden sm:block absolute -bottom-8 -right-6 w-60 bg-navy-deep text-parchment p-5 rounded-sm border border-gold/30 shadow-elevated space-y-2 animate-float">
              <div className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase tracking-[0.18em]">
                <KeyRound className="w-3.5 h-3.5" /> Consent receipt
              </div>
              <p className="text-xs text-parchment/75 leading-relaxed">Dr. access granted · cardiology · expires in 30 days · revocable</p>
            </div>
          </div>
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="eyebrow">National Health Registry</div>
              <StatusBadge status="Under Development" size="sm" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-[1.15]">
              Your record, your keys. <span className="text-navy/55 font-light">The State keeps only the receipt.</span>
            </h2>
            <div className="space-y-4 text-navy/70 leading-[1.85] font-light">
              <p>
                Clinical data never touches the public ledger. Records stay encrypted with the patient&apos;s own keys; StableChain stores only
                a hash of each consent grant, so access is provable without anything sensitive ever being published.
              </p>
              <p>
                Every view of a record by a clinician generates an entry the patient can inspect from the citizen portal — and challenge
                before the independent Health Ombudsman.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {['End-to-end encrypted records', 'Revocable, time-boxed consent', 'Full access log for patients', 'GDPR-aligned data rights'].map((t) => (
                <li key={t} className="flex items-center gap-2 text-navy font-medium">
                  <ShieldCheck className="w-4 h-4 text-laurel shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CARE PATHWAY ── */}
      <section className="guilloche-hero relative overflow-hidden text-parchment section-xl">
        <div className="orb-burgundy w-[420px] h-[420px] -bottom-32 right-0 opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow" style={{ color: '#E4C689' }}>The Care Pathway</div>
            <h2 className="text-4xl font-bold tracking-tight">From the clinic around the corner to the national campus.</h2>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-5 relative">
            <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-gold/0 via-gold/50 to-gold/0" aria-hidden="true" />
            {PATHWAY.map((p) => (
              <li key={p.step} className="dark-feature-card rounded-sm p-6 space-y-3 relative">
                <span className="w-12 h-12 rounded-full bg-navy-deep border border-gold/50 flex items-center justify-center font-mono font-bold text-gold">{p.step}</span>
                <h3 className="text-base font-bold">{p.title}</h3>
                <p className="text-xs text-parchment/62 leading-relaxed">{p.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── INSTITUTIONS ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="eyebrow">Institutions</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy">The health estate of the Republic.</h2>
            </div>
            <Link href="/development#augustine" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
              Augustine State <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="photo-card lg:row-span-2 relative min-h-[420px] rounded-sm border border-gold/20 shadow-elevated">
              <Image src={unsplash('laboratory', 1000)} alt="Researcher working in a biomedical laboratory" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/30 to-transparent" />
              <div className="photo-card-body absolute bottom-0 p-7 text-parchment space-y-2">
                <StatusBadge status="Planned" size="sm" />
                <h3 className="text-2xl font-bold">Biomedical Research Park</h3>
                <p className="text-sm text-parchment/70">Open-data clinical research, with every grant published on the ledger.</p>
              </div>
            </div>
            {SERVICES.map(({ icon: Icon, title, desc, status }) => (
              <div key={title} className="sovereign-card-premium rounded-sm p-6 flex gap-4">
                <div className="p-2.5 bg-navy text-gold rounded-sm h-fit"><Icon className="w-5 h-5" /></div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-navy">{title}</h3>
                    <StatusBadge status={status} size="sm" />
                  </div>
                  <p className="text-sm text-navy/62 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-banner py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-gold text-[11px] font-bold uppercase tracking-[0.2em]"><Users className="w-4 h-4" /> Who is covered</div>
            <h2 className="text-3xl font-bold text-parchment">Coverage begins the day lawful residence begins.</h2>
            <p className="text-parchment/60 text-sm font-light">E-residency is a digital status and does not include healthcare. Lawful residents and citizens are covered in full.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/immigration" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm">Residence permits</Link>
            <Link href="/citizenship" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">Citizenship</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
