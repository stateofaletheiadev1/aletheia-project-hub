'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { Placeholder } from '@/components/ui/Placeholder';
import { ArrowRight, Mail, UserRound } from 'lucide-react';

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="Founding Team"
        image="teamTable"
        title="The People Building Aletheia"
        lead="Aletheia is being founded by a small team, in the open. Here is who we are, who advises us, and how to reach us."
      />

      {/* Founder */}
      <section className="py-16 lg:py-24 border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4">
            <div className="aspect-[4/5] bg-white border border-navy/15 rounded-sm flex flex-col items-center justify-center gap-4 p-6 text-center">
              <UserRound className="w-16 h-16 text-navy/20" aria-hidden="true" />
              <Placeholder>founder photo</Placeholder>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-5">
            <div className="eyebrow">{t("Founder")}</div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">
              <Placeholder>name, role</Placeholder>
            </h2>
            <Placeholder block>bio: background, why Aletheia, and what the founder is responsible for</Placeholder>
          </div>
        </div>
      </section>

      {/* Advisors */}
      <section className="py-16 lg:py-24 bg-parchment-light border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-3">
            <div className="eyebrow">{t("Advisors")}</div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Advice from people who have done it")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Aletheia seeks advice in international law, public finance, maritime engineering and governance. Advisors are listed here only with their consent.")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="sovereign-card-premium rounded-sm p-6 space-y-3">
                <UserRound className="w-8 h-8 text-navy/20" aria-hidden="true" />
                <Placeholder block>{`advisor ${n}: name, field, short bio (or remove this card)`}</Placeholder>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-navy-deep text-parchment rounded-sm border border-gold/25 p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gold" aria-hidden="true" />
                <h2 className="text-xl font-bold">{t("Contact the founding team")}</h2>
              </div>
              <p className="text-sm text-parchment/70 leading-relaxed">{t("For press, partnerships and diplomatic enquiries, use the contact page. Confidential enquiries from governments are welcome.")}</p>
            </div>
            <div className="md:col-span-4 flex flex-wrap gap-3 md:justify-end">
              <Link href="/contact" className="btn-sovereign-gold px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 group">
                <span>{t("Contact")}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/roadmap" className="btn-sovereign-ghost px-6 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider">{t("Roadmap")}</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
