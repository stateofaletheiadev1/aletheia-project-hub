import Link from 'next/link';
import Image from 'next/image';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { routeMetadata } from '@/lib/routes';
import { unsplash, type PhotoKey } from '@/lib/imagery';
import {
  Anchor,
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Languages,
  Microscope,
  Scale,
  Sprout,
  Stethoscope,
} from 'lucide-react';

export const metadata = routeMetadata('/education');

const STAGES: { age: string; title: string; desc: string; image: PhotoKey }[] = [
  { age: 'Ages 3–6', title: 'Early Years', desc: 'Play-based learning, two languages from the start, and free places in every canton.', image: 'earlyLearning' },
  { age: 'Ages 6–18', title: 'Covenant Schools', desc: 'A broad European curriculum with civics, mathematics, sciences, classics and the maritime arts.', image: 'classroom' },
  { age: 'Ages 18+', title: 'University & Polytechnic', desc: 'The National University and a maritime polytechnic, tuition-free for citizens and residents.', image: 'lecture' },
  { age: 'Lifelong', title: 'Open Learning', desc: 'Micro-credentials recorded on the ledger and recognised across the European Qualifications Framework.', image: 'tabletWork' },
];

const FACULTIES = [
  { icon: Stethoscope, name: 'Medicine & Health Sciences' },
  { icon: Scale, name: 'Law & Covenant Governance' },
  { icon: Cpu, name: 'Computing & Cryptography' },
  { icon: Anchor, name: 'Maritime Science & Engineering' },
  { icon: Sprout, name: 'Energy, Climate & Agriculture' },
  { icon: BookOpen, name: 'Humanities & Classics' },
];

export default function EducationPage() {
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow="Ministry of Education & Research"
        status="Planned"
        image="libraryAisle"
        title={<>A republic is only as wise as its <span className="text-gold-metallic">schools.</span></>}
        lead="From first words to doctoral research, education in Aletheia is free at the point of learning, bilingual by design, and every research grant is published for the public to see."
      >
        <Link href="#university" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">
          National University <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="#scholarships" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">Scholarships &amp; grants</Link>
      </PageHero>

      {/* ── STAGES ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">A Lifetime of Learning</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">Four stages, one unbroken promise.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STAGES.map((s) => (
              <div key={s.title} className="photo-card group sovereign-card-premium rounded-sm flex flex-col">
                <div className="relative h-48">
                  <Image src={unsplash(s.image, 700)} alt="" fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/75 to-transparent" />
                  <span className="absolute bottom-3 left-4 text-[10px] font-mono font-bold uppercase tracking-wider text-gold-tint">{s.age}</span>
                </div>
                <div className="photo-card-body p-6 space-y-2">
                  <h3 className="text-lg font-bold text-navy">{s.title}</h3>
                  <p className="text-sm text-navy/62 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UNIVERSITY ── */}
      <section id="university" className="guilloche-hero relative overflow-hidden text-parchment section-xl">
        <div className="orb-gold w-[520px] h-[520px] -top-40 -right-40 opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-6 space-y-7">
            <div className="flex items-center gap-3">
              <div className="eyebrow" style={{ color: '#E4C689' }}>The National University of Aletheia</div>
              <StatusBadge status="Proposed" size="sm" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
              Six faculties at Port Luke, <span className="text-gold-metallic">Augustine State.</span>
            </h2>
            <p className="text-parchment/70 leading-[1.85] font-light">
              A research university chartered to guarantee academic freedom, co-located with the Augustine Medical Campus.
              The draft charter is open for public comment in the{' '}
              <Link href="/news/national-university-charter" className="text-gold underline-offset-4 hover:underline">Official Gazette</Link>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FACULTIES.map(({ icon: Icon, name }) => (
                <div key={name} className="flex items-center gap-3 p-3.5 bg-navy/50 border border-gold/15 rounded-sm hover:border-gold/45 transition-colors">
                  <Icon className="w-4 h-4 text-gold shrink-0" />
                  <span className="text-sm font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="photo-card relative h-72 rounded-sm border border-gold/25 col-span-2">
              <Image src={unsplash('library', 1200)} alt="A long university library hall lined with books" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="photo-card relative h-44 rounded-sm border border-gold/25">
              <Image src={unsplash('laboratory', 600)} alt="Engineering laboratory" fill sizes="25vw" className="object-cover" />
            </div>
            <div className="photo-card relative h-44 rounded-sm border border-gold/25">
              <Image src={unsplash('bookStack', 600)} alt="A stack of books" fill sizes="25vw" className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── LANGUAGES ── */}
      <section className="section-lg bg-parchment-light border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <div className="eyebrow">Bilingual by Design</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">English, plus one more official language.</h2>
            <p className="text-navy/65 leading-[1.85] font-light">
              Civic proficiency in English and one further official language is a condition of naturalisation — so every school teaches both from
              the earliest years, and adult residents study free of charge.
            </p>
            <Link href="/society#languages" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
              The five official languages <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['English', 'Deutsch', 'Nederlands', 'Српски', 'Italiano'].map((l, i) => (
              <div key={l} className={`stat-tile rounded-sm p-5 flex flex-col gap-2 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`} style={{ background: '#0E1B31' }}>
                <Languages className="w-4 h-4 text-gold" />
                <span className="text-lg font-bold text-parchment">{l}</span>
                <span className="text-[10px] uppercase tracking-wider text-parchment/45">{i === 0 ? 'Language of state' : 'Official language'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOLARSHIPS ── */}
      <section id="scholarships" className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">Scholarships &amp; Research Grants</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy">Every euro of research funding, in public view.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: GraduationCap, title: 'Covenant Scholarships', desc: 'Full maintenance for citizens and residents studying at partner European universities, with a duty to return and serve.', status: 'Planned' as const },
              { icon: FlaskConical, title: 'Sovereign Research Grants', desc: 'Competitive grants awarded by an independent council. Every award, reviewer score and output published on the ledger.', status: 'Planned' as const },
              { icon: Microscope, title: 'Open Science Mandate', desc: 'Publicly funded research is published open-access, with datasets released under open licences.', status: 'Proposed' as const },
            ].map(({ icon: Icon, title, desc, status }) => (
              <div key={title} className="feature-card rounded-sm p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="icon-sovereign"><Icon className="w-5 h-5 text-gold" /></div>
                  <StatusBadge status={status} size="sm" />
                </div>
                <h3 className="text-lg font-bold text-navy">{title}</h3>
                <p className="text-sm text-navy/62 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-banner py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-3xl font-bold text-parchment">Build the republic. Start by learning it.</h2>
            <p className="text-parchment/60 text-sm font-light">Read the Covenant every Aletheian student studies, or explore the path to membership.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/constitution" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm">Read the Covenant</Link>
            <Link href="/citizenship" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">Path to citizenship</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
