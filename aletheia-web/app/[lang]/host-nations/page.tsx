'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { ArrowRight, Coins, Anchor, Eye, Lock, Scale, Users } from 'lucide-react';

const BENEFITS = [
  { icon: Coins, title: 'Long-term lease income', desc: 'A predictable, long-term income from land or coastline that is underused today.' },
  { icon: Anchor, title: 'Investment in ports and clean energy', desc: 'Private investment in port, energy and digital infrastructure within the agreed territory.' },
  { icon: Users, title: 'Employment and shared revenue', desc: 'Jobs for the host nation’s people, and a share of revenue written into the agreement.' },
];

const PRINCIPLES = [
  { icon: Scale, title: 'Consent before construction', desc: 'Nothing is planned for development until the host state has agreed, by treaty, to the terms on which Aletheia may govern.' },
  { icon: Eye, title: 'A transparent partner', desc: 'Aletheia is designed so that its public records can be checked: what it commits to, it publishes.' },
  { icon: Lock, title: 'Confidential by default', desc: 'Discussions with governments are confidential. Nothing is published without the host state’s agreement.' },
];

export default function HostNationsPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="For Host Nations"
        image="coastalVillage"
        title="A Partnership, by Treaty"
        lead="Aletheia offers governments a way to turn underused land or coastline into a high-value partnership: long-term lease income, private investment in ports and clean energy, and a transparent, auditable partner."
      />

      {/* Mutual benefit */}
      <section className="py-16 lg:py-24 border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-3">
            <div className="eyebrow">{t("Mutual Benefit")}</div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("The host as partner, not bystander")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("The host state is a co-architect of Aletheia. Every agreement must deliver lasting, measurable benefit to the host nation and its people.")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="sovereign-card-premium rounded-sm p-6 space-y-3">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                <p className="text-sm text-navy/65 leading-relaxed">{tx(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="py-16 lg:py-24 bg-parchment-light border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-3">
            <div className="eyebrow">{t("How We Work")}</div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Land first, sea after")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Aletheia’s first territory would be on dry land or existing coastline, beginning with a pilot zone of modest size. Maritime districts, ports and offshore energy works would follow within the agreed territory, under the host state’s consent and international maritime law.")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRINCIPLES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card rounded-sm p-6 space-y-3">
                <Icon className="w-5 h-5 text-gold" aria-hidden="true" />
                <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
                <p className="text-sm text-navy/65 leading-relaxed">{tx(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Confidential enquiries */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-navy-deep text-parchment rounded-sm border border-gold/25 p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <h2 className="text-xl font-bold">{t("Confidential enquiries")}</h2>
              <p className="text-sm text-parchment/70 leading-relaxed">{t("We welcome confidential discussions with interested states. Write to us through the contact page and mark your message as a host-state enquiry.")}</p>
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <Link href="/contact" className="btn-sovereign-gold px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 group">
                <span>{t("Contact")}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
          <p className="text-xs text-navy/55 mt-8">{t("Aletheia is in its founding phase. It is not a recognised state, holds no territory and exercises no legal authority.")}</p>
        </div>
      </section>
    </div>
  );
}
