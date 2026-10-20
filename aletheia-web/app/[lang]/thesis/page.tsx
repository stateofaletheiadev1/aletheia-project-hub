'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { Placeholder } from '@/components/ui/Placeholder';
import { Scale, Landmark, Coins, Globe2, Handshake } from 'lucide-react';

const SECTIONS = [
  { id: 'legal-structure', icon: Scale, title: 'Legal Structure', placeholder: 'the legal form of the founding entity, the governing law, and how a treaty would give Aletheia authority' },
  { id: 'governance', icon: Landmark, title: 'Governance Architecture', placeholder: 'how the draft Constitution’s institutions would be brought into being, and who governs in the meantime' },
  { id: 'economic-model', icon: Coins, title: 'Economic Model', placeholder: 'how the founding phase is funded, the revenue model of a future territory, and the licensed route for any currency' },
  { id: 'host-regions', icon: Globe2, title: 'Preferred Host Regions', placeholder: 'the regions under study and the criteria for a host state' },
  { id: 'diplomacy', icon: Handshake, title: 'Diplomatic Strategy', placeholder: 'how host-state discussions are approached, and the path to recognition after a treaty' },
];

export default function ThesisPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="Founding Thesis"
        image="lawLibrary"
        title="The Founding Thesis"
        lead="The reasoning behind Aletheia: how it would be structured, governed and funded, where it might be hosted, and how it intends to reach a founding treaty."
        status="Under Development"
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <nav aria-label={t("Contents")} className="lg:col-span-3">
            <div className="lg:sticky lg:top-28 space-y-2">
              <div className="eyebrow mb-3">{t("Contents")}</div>
              {SECTIONS.map(({ id, title }) => (
                <a key={id} href={`#${id}`} className="block text-sm text-navy/70 hover:text-navy hover:underline underline-offset-2 decoration-gold">{tx(title)}</a>
              ))}
            </div>
          </nav>

          <div className="lg:col-span-9 space-y-8">
            {SECTIONS.map(({ id, icon: Icon, title, placeholder }) => (
              <article key={id} id={id} className="sovereign-card-premium rounded-sm p-7 space-y-4 scroll-mt-28">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-navy text-gold rounded-sm">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-bold text-navy">{tx(title)}</h2>
                </div>
                <Placeholder block>{placeholder}</Placeholder>
              </article>
            ))}

            <p className="text-sm text-navy/65 leading-relaxed">
              {t("Until the Thesis is published, the")}{' '}
              <Link href="/roadmap" className="font-semibold text-navy underline underline-offset-2 decoration-gold">{t("roadmap")}</Link>{' '}
              {t("and the")}{' '}
              <Link href="/development#treaty" className="font-semibold text-navy underline underline-offset-2 decoration-gold">{t("treaty-first principles")}</Link>{' '}
              {t("set out the approach.")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
