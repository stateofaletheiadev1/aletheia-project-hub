'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { CountUp } from '@/components/ui/CountUp';
import { ArrowRight, Building2, Landmark, Users, FileCheck2, KeyRound, EyeOff } from 'lucide-react';

const DESIGN = [
  { icon: FileCheck2, title: 'What it would record', desc: 'Citizens, lawful residents, e-residents and companies, each entered with the date and the document that created the entry.' },
  { icon: KeyRound, title: 'How it would be checked', desc: 'Each entry would be hashed onto StableChain, so its existence can be proved without publishing anything personal.' },
  { icon: EyeOff, title: 'What it would never publish', desc: 'Personal data stays off the ledger and encrypted. Only counts and hashes would be public.' },
];

export default function RegistryPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col bg-parchment-canvas">
      <PageHero
        eyebrow="The Founding Register"
        image="paperwork"
        title={<>{t("The register,")}{' '}<span className="text-gold-metallic">{t("as it stands.")}</span></>}
        lead="Aletheia accepts no applications in its founding phase, so the register holds no citizens, e-residents or companies. When it opens, every count will be published here."
      >
        <Link href="/founding-members" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm flex items-center gap-2 group">{t("Register interest as a Founding Member")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link href="/transparency" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("Status & Disclaimers")}</Link>
      </PageHero>

      {/* ── THE COUNTS ── */}
      <section className="bg-navy-deep border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 sm:divide-x divide-gold/15">
          {[
            { icon: Landmark, label: 'Citizens', sub: 'Citizenship only by birth or naturalisation, once Aletheia is established as a state' },
            { icon: Users, label: 'E-residents', sub: 'E-residency is proposed; no applications are accepted' },
            { icon: Building2, label: 'Registered companies', sub: 'Incorporation is proposed; nothing is registered' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="py-8 px-6 text-center space-y-2">
              <Icon className="w-5 h-5 text-gold mx-auto" aria-hidden="true" />
              <div className="big-stat-value"><CountUp value={0} /></div>
              <div className="text-xs font-semibold text-parchment/90">{tx(label)}</div>
              <div className="text-[11px] text-parchment/45 max-w-[16rem] mx-auto">{tx(sub)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WOULD WORK ── */}
      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <div className="eyebrow">{t("Register Design")}</div>
            <h2 className="text-4xl font-bold tracking-tight text-navy">{t("How the register would work.")}</h2>
            <p className="text-sm text-navy/65 leading-relaxed">{t("The design of a future national register, once Aletheia has a territory and the lawful authority to keep one.")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DESIGN.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="sovereign-card-premium rounded-sm p-6 space-y-3">
                <div className="icon-sovereign"><Icon className="w-5 h-5 text-gold" /></div>
                <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                <p className="text-sm text-navy/62 leading-relaxed">{tx(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOTHING IS SOLD ── */}
      <section className="cta-banner py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-3xl font-bold text-parchment">{t("Nothing is sold.")}</h2>
            <p className="text-parchment/60 text-sm font-light">{t("Aletheia does not sell citizenship, residency, passports or currency, and raises no money through this site. Registering interest is free.")}</p>
          </div>
          <Link href="/founding-members" className="btn-sovereign-gold px-7 py-3.5 rounded-sm text-sm shrink-0">{t("Become a founding member")}</Link>
        </div>
      </section>
    </div>
  );
}
