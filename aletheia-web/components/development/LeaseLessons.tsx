'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

/** Three documented cases of leased or granted territory being taken back. Sources are linked. */
export const LEASE_LESSONS = [
  {
    place: 'Hong Kong',
    years: '1898–1997',
    title: 'A lease runs out.',
    desc: 'In 1898 Qing China leased Hong Kong’s New Territories to Britain for 99 years. When the lease expired on 30 June 1997, the territory returned to China, and the rest of Hong Kong with it.',
    source: { label: 'Hong Kong Government Yearbook 1997', href: 'https://www.yearbook.gov.hk/1997/ch25/e25c.htm' },
  },
  {
    place: 'Madagascar',
    years: '2008–2009',
    title: 'A new government cancels it.',
    desc: 'In 2008 Madagascar agreed a 99-year lease of about 1.3 million hectares with a foreign company. In March 2009 the country’s new leader cancelled it, saying the constitution did not allow the land to be sold or rented.',
    source: { label: 'Reuters, 18 March 2009', href: 'https://farmlandgrab.org/post/2836-madagascar-s-new-leader-says-daewoo-land-deal-off' },
  },
  {
    place: 'Honduras',
    years: '2013–2024',
    title: 'A special zone is struck down.',
    desc: 'Honduras changed its constitution in 2013 to allow self-governing zones. Congress voted to repeal the law in 2022, and in September 2024 the Supreme Court declared the zones unconstitutional. The best-known zone is now pursuing an international arbitration claim of nearly US$10.8 billion.',
    source: { label: 'UNCTAD Investment Dispute Settlement Navigator', href: 'https://investmentpolicy.unctad.org/investment-dispute-settlement/country/92/honduras/respondent' },
  },
];

export function LeaseLessons() {
  const { t, tx } = useI18n();
  return (
    <div className="space-y-5">
      <div className="max-w-3xl space-y-2">
        <h3 className="text-2xl font-bold text-navy">{t("Why not lease land?")}</h3>
        <p className="text-sm text-navy/65 leading-relaxed">{t("A lease, a concession or a special zone lasts only as long as the goodwill of the state that grants it. History is clear on the point:")}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {LEASE_LESSONS.map((c) => (
          <article key={c.place} className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
            <div className="h-[3px] w-full bg-burgundy" />
            <div className="p-6 space-y-3 flex-1 flex flex-col">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-navy">{tx(c.place)}</span>
                <span className="font-mono text-[11px] text-gold-shadow">{c.years}</span>
              </div>
              <h4 className="text-base font-bold text-navy leading-snug">{tx(c.title)}</h4>
              <p className="text-sm text-navy/65 leading-relaxed font-light flex-1">{tx(c.desc)}</p>
              <a href={c.source.href} target="_blank" rel="noopener noreferrer" className="text-[11px] text-navy/50 hover:text-gold-shadow underline underline-offset-2 decoration-navy/20">
                {t("Source:")}{' '}{tx(c.source.label)}
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="text-sm font-semibold text-navy max-w-3xl">{t("A platform that Aletheia builds and owns does not depend on anyone’s goodwill. That is why Aletheia will build.")}</p>
    </div>
  );
}
