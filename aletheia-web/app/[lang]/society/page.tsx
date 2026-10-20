'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { unsplash, type PhotoKey } from '@/lib/imagery';
import { ArrowRight, Church, Home, Landmark, Music, Sailboat, Trees, Users } from 'lucide-react';

const LANGUAGES = [
  { name: 'English', native: 'English', role: 'Language of state, law and the Gazette' },
  { name: 'German', native: 'Deutsch', role: 'Official language' },
  { name: 'Dutch', native: 'Nederlands', role: 'Official language' },
  { name: 'Serbian', native: 'Српски', role: 'Official language' },
  { name: 'Italian', native: 'Italiano', role: 'Official language' },
];

const PILLARS = [
  { icon: Church, title: 'Heritage & conscience', desc: 'A Christian civic heritage expressed in the national arms, with freedom of religion and conscience guaranteed equally to every person.' },
  { icon: Users, title: 'Family & community', desc: 'Strong families and neighbourhood associations are the first institutions of the Sovereign Covenant State; the State serves them, never the reverse.' },
  { icon: Home, title: 'Housing by leasehold', desc: 'Land would be held in covenant trust and leased on transparent, ledger-recorded terms, with the dividend funding public services instead of income tax.' },
  { icon: Trees, title: 'Forty percent green', desc: 'A proposed constitutional floor of green coverage in every residential canton: parks, allotments and shoreline walks within reach of every home.' },
];

const CALENDAR = [
  { month: 1, day: 20, name: 'Covenant Day', desc: 'Anniversary of the Covenant’s publication, with a public reading of the Preamble.' },
  { month: 5, day: 16, name: 'St. Brendan’s Day', desc: 'Festival of the sea: blessing of the fleet and a maritime regatta.' },
  { month: 8, day: 28, name: 'Feast of St. Augustine', desc: 'Day of learning: universities and libraries open their doors to all.' },
  { month: 12, day: 4, name: 'St. Barbara’s Day', desc: 'Honouring those who serve in emergency services and civil protection.' },
];

const GALLERY: { image: PhotoKey; alt: string }[] = [
  { image: 'coastalVillage', alt: 'Colourful houses on a rocky European coastline' },
  { image: 'forestPath', alt: 'Sunlight through a forest path' },
  { image: 'europeanTown', alt: 'Historic European town street with flowers' },
  { image: 'friendsSunset', alt: 'Friends embracing at sunset on a hillside' },
  { image: 'coastSunrise', alt: 'Sunrise over a calm sea and beach' },
  { image: 'alpineLake', alt: 'Boat on a turquoise mountain lake' },
  { image: 'highlands', alt: 'Green highlands under a dramatic sky' },
];

export default function SocietyPage() {
  const { t, tx, intl } = useI18n();
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow={t("Life in Aletheia")}
        image="friendsSunset"
        imagePosition="center 40%"
        title={<>{t("A people bound by")}{' '}<span className="text-gold-metallic">{t("covenant")}</span>{t(", not by chance.")}</>}
        lead={t("Five languages, one shared civic oath, and a maritime culture rooted in European heritage. This is what everyday life in the Sovereign Covenant State is being built to feel like.")}
      >
        <Link href="#languages" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">{t("Languages & culture")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/founding-members" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("Become a founding member")}</Link>
      </PageHero>

      {/* ── PILLARS ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">{t("The Social Covenant")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("What holds a covenant society together.")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PILLARS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card rounded-sm p-7 space-y-4">
                <div className="icon-sovereign"><Icon className="w-5 h-5 text-gold" /></div>
                <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                <p className="text-sm text-navy/62 leading-relaxed">{tx(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILMSTRIP ── */}
      <section className="bg-navy-deep py-10 overflow-hidden border-y border-gold/20" aria-label={t("Photographs of European coastal and community life")} data-no-reveal>
        <div className="flex gap-5 w-max animate-filmstrip">
          {[...GALLERY, ...GALLERY].map((g, i) => (
            <div key={i} className="photo-card relative w-[340px] h-[230px] rounded-sm border border-gold/20 shrink-0" aria-hidden={i >= GALLERY.length}>
              <Image src={unsplash(g.image, 700)} alt={tx(i < GALLERY.length ? g.alt : '')} fill sizes="340px" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* ── LANGUAGES ── */}
      <section id="languages" className="section-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-14">
          <div className="lg:col-span-5 space-y-5">
            <div className="eyebrow">{t("Proposed Official Languages")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("Five voices, equal in dignity.")}</h2>
            <p className="text-navy/65 leading-[1.85] font-light">{t("Under the proposed Official Languages & Diplomatic Communication Act, every citizen could address the State in any official language and receive an answer in it. English is the working language of law and the Gazette.")}</p>
            <Link href="/laws/languages-act" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">{t("Read the Act")}{' '}<ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <ul className="lg:col-span-7 divide-y divide-navy/10 border-y border-navy/10">
            {LANGUAGES.map((l, i) => (
              <li key={l.name} className="hover-gold-row flex items-center justify-between gap-6 py-5 px-2">
                <div className="flex items-baseline gap-5">
                  <span className="font-mono text-xs text-gold-shadow">0{tx(i + 1)}</span>
                  <span className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{tx(l.native)}</span>
                  {tx(l.native !== l.name && <span className="text-sm text-navy/45 hidden sm:inline">{tx(l.name)}</span>)}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-navy/50 text-right">{tx(l.role)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── MARITIME CULTURE ── */}
      <section className="relative overflow-hidden text-parchment min-h-[560px] flex items-center">
        <div className="absolute inset-0 animate-ken-burns" aria-hidden="true">
          <Image src={unsplash('oceanWave', 2000)} alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#060C14]/95 via-[#0E1B31]/75 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-xl space-y-6">
            <div className="eyebrow" style={{ color: '#E4C689' }}>{t("A Maritime People")}</div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">{t("The sea is our border, our road and our inheritance.")}</h2>
            <p className="text-parchment/72 leading-[1.85] font-light">{t("Sailing clubs in every port, a national regatta on St. Brendan's Day, and maritime craft taught in every school: the culture Aletheia hopes to grow faces outward, to the sea and the world beyond it.")}</p>
            <div className="flex flex-wrap gap-6 pt-2">
              {[
                { icon: Sailboat, label: 'National Regatta' },
                { icon: Music, label: 'Festival of the Fleet' },
                { icon: Landmark, label: 'Maritime Museum' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-2 text-sm font-semibold"><Icon className="w-4 h-4 text-gold" /> {tx(label)}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CIVIC CALENDAR ── */}
      <section className="section-lg bg-parchment-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-3">
              <div className="eyebrow">{t("The Civic Calendar")}</div>
              <h2 className="text-4xl font-bold tracking-tight text-navy">{t("National days of the Sovereign Covenant State.")}</h2>
            </div>
            <StatusBadge status="Proposed" size="sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CALENDAR.map((c) => (
              <div key={c.name} className="sovereign-card-premium rounded-sm overflow-hidden">
                <div className="bg-navy px-6 py-4 border-b border-gold/30">
                  <span className="text-gold font-mono text-sm font-bold">{new Date(Date.UTC(2026, c.month - 1, c.day)).toLocaleDateString(intl, { day: 'numeric', month: 'long', timeZone: 'UTC' })}</span>
                </div>
                <div className="p-6 space-y-2">
                  <h3 className="text-lg font-bold text-navy">{tx(c.name)}</h3>
                  <p className="text-sm text-navy/62 leading-relaxed">{tx(c.desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="section-lg border-t border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { href: '/healthcare', title: 'Health & Social Care', desc: 'The proposed covenant healthcare model.', image: 'stethoscope' as const },
            { href: '/education', title: 'Education & Research', desc: 'Proposed schools and a National University.', image: 'bookshelf' as const },
            { href: '/development', title: 'The Seastead', desc: 'Where Aletheia could be built, and the Antioch design studies.', image: 'highlands' as const },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="photo-card group relative h-72 rounded-sm border border-gold/20 shadow-institutional">
              <Image src={unsplash(c.image, 800)} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/40 to-transparent" />
              <div className="photo-card-body absolute bottom-0 p-6 text-parchment space-y-1">
                <h3 className="text-xl font-bold flex items-center gap-2">{tx(c.title)} <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform" /></h3>
                <p className="text-sm text-parchment/70">{tx(c.desc)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
