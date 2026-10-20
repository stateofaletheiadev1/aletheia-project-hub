'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { ArrowRight, Mail, Plus } from 'lucide-react';

const FAQ: { group: string; items: { q: string; a: string; link?: { href: string; label: string } }[] }[] = [
  {
    group: 'About Aletheia',
    items: [
      { q: 'What is Aletheia today?', a: 'Aletheia is a new-country project in its founding phase. It is not a recognised state, holds no territory, exercises no legal authority, and issues no passports, legal currency or citizenship. What exists today is this platform, the draft Constitution, the founding documents and the StableChain testnet. Every institution on this site carries an explicit status, so aspiration is never presented as fact.', link: { href: '/transparency', label: 'Status & disclaimers' } },
      { q: 'Where is Aletheia?', a: 'Aletheia holds no territory. Its first territory is to be secured by treaty or long-term leasehold with a recognised host state, on dry land or existing coastline first, beginning with a pilot zone. Antioch and the four founding states are long-term design studies; their scale and location will be set by treaty.', link: { href: '/development#treaty', label: 'Territory by treaty' } },
      { q: 'What does “Veritas in Foedere” mean?', a: 'It is the national motto: “Truth in Covenant.” It expresses the founding idea that public institutions should be able to prove what they claim, and that membership of the nation rests on a mutual covenant rather than on commerce.' },
    ],
  },
  {
    group: 'Membership & Citizenship',
    items: [
      { q: 'Can I buy citizenship or a passport?', a: 'No. Aletheia does not sell citizenship, residency, passports or currency, and accepts no applications. Citizenship will be conferred only by birth or naturalisation, under a founding treaty. Anyone offering Aletheian citizenship or documents for money is not acting for Aletheia.', link: { href: '/founding-members', label: 'Become a founding member' } },
      { q: 'How can I take part now?', a: 'Register interest as a Founding Member. It is free, it confers no status or rights, and it tells us you would like to follow and support the founding of Aletheia.', link: { href: '/founding-members', label: 'Register interest' } },
      { q: 'How would naturalisation work?', a: 'As proposed in the draft Constitution: after five years of lawful, continuous residence in an Aletheian territory, residents proficient in English and one further official language, who have completed civic integration and hold a clean record, could apply, and would become citizens on swearing the Covenant Oath.', link: { href: '/citizenship', label: 'Proposed citizenship standards' } },
      { q: 'What would the difference be between e-residency and residency?', a: 'E-residency is proposed as a digital status for founders and remote companies, conveying no right to live in Aletheia, no healthcare and no vote. Lawful residence would be a permit to live, work and study in an Aletheian territory. Neither is available today.', link: { href: '/e-residency', label: 'E-Residency (proposed)' } },
      { q: 'Is there an Aletheian passport?', a: 'No. There is a design concept for a future travel document. Aletheia issues no passports, and none will be issued unless it is established by treaty and has the lawful authority to do so.', link: { href: '/design/travel-document', label: 'Travel document design concept' } },
    ],
  },
  {
    group: 'Economy & Money',
    items: [
      { q: 'Would there really be no income tax?', a: 'The draft Constitution proposes to prohibit personal income tax. A future State would be funded by land leasehold dividends, payment and registry fees, concessions and the yield of the Covenant Endowment.', link: { href: '/treasury', label: 'The proposed revenue model' } },
      { q: 'Is the AEY a cryptocurrency?', a: 'No. The Aletheian Guilder (AEY) is the proposed national currency. AEY is not currently issued to the public and is not legal tender or e-money. Any future issuance would take place only through a properly licensed issuer, in compliance with applicable law (including the EU’s MiCA regulation).', link: { href: '/aey', label: 'About the AEY' } },
      { q: 'Is Aletheia raising money?', a: 'Aletheia does not sell citizenship, residency, passports, currency or bonds. Any future funding of the founding phase would be set out openly, through a lawful structure, in the Founding Thesis.', link: { href: '/thesis', label: 'Founding Thesis' } },
      { q: 'Who would issue the AEY?', a: 'The Reserve Bank of Aletheia, the proposed monetary institution, under rules it would publish, and only as a properly licensed issuer.', link: { href: '/central-bank', label: 'Reserve Bank of Aletheia' } },
    ],
  },
  {
    group: 'This Platform',
    items: [
      { q: 'Is my personal data stored on a blockchain?', a: 'No. Personal data is never written to a public ledger. If you register interest, your details are stored encrypted and used only to contact you about the founding of Aletheia.', link: { href: '/privacy', label: 'Privacy notice' } },
      { q: 'How do I report a security vulnerability?', a: 'Please use the coordinated disclosure channel described on the cybersecurity page.', link: { href: '/adss/cybersecurity#disclosure', label: 'Responsible disclosure' } },
    ],
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.flatMap((g) =>
    g.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  ),
};

export default function FaqPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col bg-parchment-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        eyebrow={t("Public Information")}
        image="readingNews"
        title={<>{t("Plain answers to")}{' '}<span className="text-gold-metallic">{t("honest questions.")}</span></>}
        lead={t("What Aletheia is today, what it plans to build, and how membership, money and your data would work. If your question is not answered here, write to us.")}
      />

      <section className="section-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <nav className="lg:col-span-3 lg:sticky lg:top-28 h-fit space-y-1" aria-label={t("FAQ sections")}>
            <div className="eyebrow mb-4">{t("Sections")}</div>
            {FAQ.map((g) => (
              <a key={g.group} href={`#${slug(g.group)}`} className="block py-2 px-3 text-sm font-semibold text-navy/65 border-l-2 border-navy/10 hover:border-gold hover:text-navy transition-colors">
                {tx(g.group)}
              </a>
            ))}
          </nav>

          <div className="lg:col-span-9 space-y-14">
            {FAQ.map((g) => (
              <div key={g.group} id={slug(g.group)} className="space-y-5">
                <h2 className="text-2xl font-bold text-navy tracking-tight">{tx(g.group)}</h2>
                <div className="space-y-3">
                  {g.items.map((item) => (
                    <details key={item.q} className="group sovereign-card-premium rounded-sm open:shadow-elevated open:border-gold/40">
                      <summary className="flex items-center justify-between gap-6 cursor-pointer list-none p-6 [&::-webkit-details-marker]:hidden">
                        <span className="text-base font-bold text-navy">{tx(item.q)}</span>
                        <span className="w-8 h-8 shrink-0 rounded-full border border-gold/40 flex items-center justify-center text-gold transition-transform duration-300 group-open:rotate-45 group-open:bg-navy">
                          <Plus className="w-4 h-4" />
                        </span>
                      </summary>
                      <div className="px-6 pb-6 -mt-1 space-y-4 animate-fade-in">
                        <p className="text-sm text-navy/70 leading-[1.85]">{tx(item.a)}</p>
                        {tx(item.link && (
                          <Link href={item.link.href} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-shadow hover:text-navy transition-colors">
                            {tx(item.link.label)} <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}

            <div className="cta-banner rounded-sm p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-parchment">{t("Still have a question?")}</h2>
                <p className="text-sm text-parchment/60">{t("The founding team answers every written enquiry.")}</p>
              </div>
              <Link href="/contact" className="btn-sovereign-gold px-6 py-3 rounded-sm text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />{' '}{t("Contact us")}</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
