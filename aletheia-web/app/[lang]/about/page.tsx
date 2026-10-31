'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import Image from 'next/image';
import { ArrowRight, Mail } from 'lucide-react';

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="Founding Team"
        image="teamTable"
        title="The People Building Aletheia"
        lead="Aletheia is being founded by a small team, in the open. Here is who we are and how to reach us."
      />

      {/* Founder */}
      <section className="py-16 lg:py-24 border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4">
            <div className="relative aspect-[4/5] bg-white border border-navy/15 rounded-sm overflow-hidden shadow-institutional">
              <Image
                src="/images/founders/emeka-iwuagwu.webp"
                alt={t("Emeka Iwuagwu, founder of Aletheia")}
                fill
                sizes="(min-width: 1024px) 380px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
          <div className="lg:col-span-8 space-y-5">
            <div className="eyebrow">{t("Founder")}</div>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-navy tracking-tight">Emeka Iwuagwu</h2>
              <p className="text-sm font-semibold text-gold-shadow">{t("Founder of Aletheia · Senior Software Engineer · Real Estate Professional")}</p>
            </div>
            <div className="space-y-4 text-navy/80 leading-[1.85] max-w-3xl">
              <p>{t("Emeka Iwuagwu founded Aletheia and leads its founding team. He is a senior software engineer with more than sixteen years of experience designing and building software systems, and has worked for more than nine years in real estate.")}</p>
              <p>{t("Those two disciplines meet in Aletheia. A nation that keeps its promises needs institutions whose records can be checked, which is what its digital platform, its public registers and AletheiaChain are built to do. A nation also needs ground to stand on, planned, financed and built with care, which is the work of the seastead and its first platform.")}</p>
              <p>{t("A long interest in world politics, economics and the way nations are governed led him to a simple question: what would a state look like if it were designed from the first day to be lawful, accountable and provable? Aletheia is his answer, offered for others to examine, improve and join.")}</p>
              <p>{t("As founder, he convenes the founding team, leads the drafting of the Constitution and the design of Aletheia’s institutions, and is responsible for the project until those institutions are established. Under the draft Constitution, every public office, the Chancellor’s included, will be filled by election or lawful appointment.")}</p>
            </div>
            <a href="mailto:info@stateofaletheia.org" className="inline-flex items-center gap-2 text-sm font-semibold text-navy underline underline-offset-4 decoration-gold">
              <Mail className="w-4 h-4 text-gold" aria-hidden="true" />
              info@stateofaletheia.org
            </a>
          </div>
        </div>
      </section>

      {/* Founding team */}
      <section className="py-14 lg:py-16 bg-parchment-light border-b border-navy/08">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="eyebrow">{t("The Founding Team")}</div>
            <h2 className="text-2xl font-bold text-navy tracking-tight">{t("More founders and advisers will join")}</h2>
            <p className="text-sm text-navy/75 leading-relaxed">{t("Aletheia seeks founders and advisers in international and maritime law, public finance, marine engineering and governance. Each will be introduced here, with their consent, as they join.")}</p>
          </div>
          <div className="md:col-span-4 flex md:justify-end">
            <Link href="/founding-members" className="btn-sovereign-gold px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 group">
              <span>{t("Register interest")}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
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
