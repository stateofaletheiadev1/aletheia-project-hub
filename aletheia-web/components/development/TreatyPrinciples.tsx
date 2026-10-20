'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

/** The three treaty-first principles, shared by the homepage and /development. */
export const TREATY_PRINCIPLES = [
  { num: 'I.', title: 'Consent before construction.', desc: 'No territory is planned for development until a host state has agreed, by treaty, to the terms on which Aletheia may govern it.', accent: 'bg-navy' },
  { num: 'II.', title: 'The host as partner.', desc: 'The host state is a co-architect of Aletheia, not a bystander. Every agreement must deliver lasting, measurable benefit to the host nation and its people: investment, employment, port and energy infrastructure, and shared revenue.', accent: 'bg-gold' },
  { num: 'III.', title: 'Land first, sea after.', desc: 'Aletheia’s first territory will be on dry land or existing coastline. Its maritime districts, ports and offshore energy works will be developed within that agreed territory, under the host state’s consent and international maritime law.', accent: 'bg-laurel' },
];

export function TreatyPrinciples() {
  const { tx } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {TREATY_PRINCIPLES.map(({ num, title, desc, accent }) => (
        <div key={num} className="sovereign-card-premium rounded-sm overflow-hidden flex flex-col">
          <div className={`h-[3px] w-full ${accent}`} />
          <div className="p-6 space-y-3 flex-1">
            <span className="font-serif text-gold font-bold text-sm">{tx(num)}</span>
            <h4 className="text-base font-bold text-navy leading-snug">{tx(title)}</h4>
            <p className="text-sm text-navy/62 leading-relaxed font-light">{tx(desc)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
