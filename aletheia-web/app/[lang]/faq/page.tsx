'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { PageHero } from '@/components/ui/PageHero';
import { ArrowRight, Mail, Plus } from 'lucide-react';

const FAQ: { group: string; items: { q: string; a: string; link?: { href: string; label: string } }[] }[] = [
  {
    group: 'About Aletheia',
    items: [
      { q: 'What is Aletheia today?', a: 'Aletheia is a sovereign, European-oriented maritime state founded on the Covenant. Its constitutional framework, digital platform and registries are being built in the open, and every institution on this site carries an explicit status — Operational, Under Development, Planned, Proposed or Vision — so aspiration is never presented as fact.', link: { href: '/transparency', label: 'How statuses work' } },
      { q: 'Where is Aletheia?', a: 'The territorial plan comprises the federal capital district of Antioch and four founding states — St. Barbara, Augustine, Benedict and St. Brendan — oriented to the North Sea, with a planned national territory of 6,500 km². Territorial development is at the Planned stage.', link: { href: '/development', label: 'Explore the territory' } },
      { q: 'What does “Veritas in Foedere” mean?', a: 'It is the national motto: “Truth in Covenant.” It expresses the founding idea that public institutions should be able to prove what they claim, and that membership of the nation rests on a mutual covenant rather than on commerce.' },
    ],
  },
  {
    group: 'Citizenship & Residency',
    items: [
      { q: 'Can I become a citizen by investing?', a: 'Yes, through the Covenant Investor route: a 250,000 AEY National Development Contribution, or 500,000 AEY in Covenant Development Bonds held for five years. There is no residence period, but every investor must clear enhanced due diligence on identity and source of funds, hold a clean criminal record and swear the public Covenant Oath. Citizenship is never auctioned and never granted without the Oath.', link: { href: '/citizenship/apply', label: 'Check your eligibility' } },
      { q: 'How does naturalisation work?', a: 'After five years of lawful, continuous residence, residents who are proficient in English and one further official language, have completed the Civic Integration Programme and hold a clean record may apply, and become citizens on swearing the Covenant Oath.', link: { href: '/citizenship', label: 'Citizenship standards' } },
      { q: 'What is the difference between e-residency and residency?', a: 'E-residency is a digital status for founders and remote companies: identity, company formation and settlement accounts. It conveys no right to live in Aletheia, no healthcare entitlement and no vote. Lawful residence is a physical permit to live, work and study.', link: { href: '/e-residency', label: 'E-Residency programme' } },
      { q: 'Will the Aletheian passport be recognised abroad?', a: 'The passport is specified to ICAO Doc 9303 (TD3 eMRTD) so that it can be read by automated border systems worldwide. Visa-free recognition depends on bilateral agreements, which are negotiated and published by the Ministry of Foreign Affairs & Justice.', link: { href: '/passport', label: 'Passport specification' } },
    ],
  },
  {
    group: 'Economy & Money',
    items: [
      { q: 'Is there really no income tax?', a: 'Personal income tax is prohibited by the Covenant. The State is funded by land leasehold dividends, payment-network and registry fees, maritime concessions, and the yield of the Covenant Endowment.', link: { href: '/treasury', label: 'How the Treasury is funded' } },
      { q: 'Is the AEY a cryptocurrency?', a: 'No. The Aletheian Guilder (AEY) is the proposed national currency, to be issued by the Reserve Bank of Aletheia in banknotes and on StableChain, national payment infrastructure with fixed fees. It is not a speculative token.', link: { href: '/aey', label: 'About the AEY' } },
      { q: 'How much has been raised to build Aletheia?', a: 'The National Registry & Revenue page publishes funds raised by source — endowment capital, development bonds, investor contributions and fees — and how they are allocated to the port, the capital and the energy grid.', link: { href: '/registry', label: 'National Registry & Revenue' } },
      { q: 'Who issues the AEY?', a: 'The Reserve Bank of Aletheia, under rules it publishes. Every issue is to be recorded in a public register, and digital issuance on StableChain can be verified by anyone.', link: { href: '/central-bank', label: 'Reserve Bank of Aletheia' } },
    ],
  },
  {
    group: 'This Platform',
    items: [
      { q: 'Is my personal data stored on a blockchain?', a: 'No. Personal and medical data is never written to the public ledger. StableChain stores only cryptographic hashes and receipts, which prove that a record or consent exists without revealing its content.', link: { href: '/privacy', label: 'Privacy notice' } },
      { q: 'How do I report a security vulnerability?', a: 'Please use the coordinated disclosure channel of the Aletheian Cybersecurity Department. Reports are acknowledged within 72 hours.', link: { href: '/adss/cybersecurity#disclosure', label: 'Responsible disclosure' } },
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
        lead={t("What Aletheia is today, what it is building, and how membership, money and your data work. If your question is not answered here, write to us.")}
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
                <p className="text-sm text-parchment/60">{t("The public registry answers every written enquiry.")}</p>
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
