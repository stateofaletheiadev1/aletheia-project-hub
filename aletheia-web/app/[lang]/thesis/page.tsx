'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { Scale, Landmark, Coins, Globe2, Handshake } from 'lucide-react';

const SECTIONS = [
  {
    id: 'legal-structure',
    icon: Scale,
    title: 'Legal Structure',
    body: [
      'Today Aletheia is a founding project, not a state. The founders are establishing a founding entity, a non-profit foundation or association in a well-regarded jurisdiction, which will hold the project’s assets, contracts and records and answer for them under that jurisdiction’s law. Its name and registered address will be published when it is registered.',
      'Aletheia would come to exercise lawful authority in stages: by building and owning its first platform; by ratifying its Constitution in a referendum of its founding members; and by seeking recognition from other states under international law. The Constitution enters into force only when all of its conditions are met, and until then no one acts with public authority in Aletheia’s name.',
    ],
  },
  {
    id: 'governance',
    icon: Landmark,
    title: 'Governance Architecture',
    body: [
      'The draft Constitution sets out a federal democratic republic: a Covenant Assembly of 61 members, a Council of States of 15, a Chancellor elected by the citizens for at most two five-year terms, a cabinet capped at nine ministries, and a High Court of nine Justices serving single twelve-year terms. An independent Reserve Bank, an Auditor-General and an Ombudsman complete it.',
      'Until those institutions exist, the founding team, led by the founder, governs the project, and publishes its work: the Constitution and its editions, and the founding records. A Constitutional Convention of founding members will settle the final text before it is put to a referendum.',
    ],
  },
  {
    id: 'economic-model',
    icon: Coins,
    title: 'Economic Model',
    body: [
      'In the founding phase the project is funded by its founders. Further funding will be received only through the founding entity, under published terms and with legal advice: founding contributions, grants and infrastructure partners. Aletheia takes no money through its websites.',
      'A future State would levy no tax on personal income, capital gains or inheritance. It would be funded by ground leases and concessions on its platforms, by fees for public services, and by the yield of a permanent Covenant Endowment Fund.',
      'The Aletheian Guilder would be issued only by an independent Reserve Bank under published rules, and would become legal tender only once Aletheia has the lawful authority to designate it. The Bank’s reserves are never spent on construction or lent to the State.',
    ],
  },
  {
    id: 'sites',
    icon: Globe2,
    title: 'Seastead Sites',
    body: [
      'Platforms would be sited beyond any state’s exclusive economic zone and continental shelf, so that the ground Aletheia stands on belongs to no one else.',
      'The criteria under study are: water depth and seabed suited to moored or fixed structures; sea state and exposure to storms; distance from recognised shipping lanes, which must stay clear; access to ports and supply routes; and the sensitivity of the marine environment. The sea areas under study will be published once surveys are commissioned, and before any site is chosen.',
    ],
  },
  {
    id: 'diplomacy',
    icon: Handshake,
    title: 'Diplomatic Strategy',
    body: [
      'Aletheia will seek recognition only when it can show what recognition requires: a permanently inhabited territory, a resident population, an effective government under its Constitution, and the capacity to keep international obligations.',
      'Until then, its diplomacy is preparation: publishing its Constitution and records, taking the advice of international and maritime lawyers, and building relations with maritime, academic and civil-society partners. It approaches other states openly, claims nothing beyond what the Law of the Sea allows, and will settle any dispute by peaceful means.',
    ],
  },
];

export default function ThesisPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">
      <PageHero
        eyebrow="Founding Thesis"
        image="lawLibrary"
        title="The Founding Thesis"
        lead="The reasoning behind Aletheia: how it would be structured, governed and funded, where its platforms might be sited, and how it intends to earn recognition."
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
            {SECTIONS.map(({ id, icon: Icon, title, body }) => (
              <article key={id} id={id} className="sovereign-card-premium rounded-sm p-7 space-y-4 scroll-mt-28">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-navy text-gold rounded-sm">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-bold text-navy">{tx(title)}</h2>
                </div>
                <div className="space-y-3 text-navy/80 leading-[1.8]">
                  {body.map((para) => (
                    <p key={para}>{tx(para)}</p>
                  ))}
                </div>
              </article>
            ))}

            <p className="text-sm text-navy/70 leading-relaxed">
              {t("This is the first edition of the Founding Thesis, October 2026. It will grow as legal advice and engineering studies are published. See also the")}{' '}
              <Link href="/roadmap" className="font-semibold text-navy underline underline-offset-2 decoration-gold">{t("roadmap")}</Link>{' '}
              {t("and the")}{' '}
              <Link href="/development#seastead" className="font-semibold text-navy underline underline-offset-2 decoration-gold">{t("seastead principles")}</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
