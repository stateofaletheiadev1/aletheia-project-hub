'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

/** The three seastead principles, shared by the homepage and /development. */
export const SEASTEAD_PRINCIPLES = [
  { num: 'I.', title: 'Built, not borrowed.', desc: 'Aletheia will not lease land from another state. Its territory will be platforms it designs, builds and owns outright, so no landlord can reclaim the ground beneath it.', accent: 'bg-navy' },
  { num: 'II.', title: 'Lawful at sea.', desc: 'Platforms would be sited beyond any state’s exclusive economic zone, under the freedoms the United Nations Convention on the Law of the Sea grants to all, and Aletheia would claim no more than international law allows.', accent: 'bg-gold' },
  { num: 'III.', title: 'One platform first.', desc: 'Aletheia begins with a single pilot platform of modest size. Its districts, port and offshore energy works would grow platform by platform, as the community and its funding grow.', accent: 'bg-laurel' },
];

export function SeasteadPrinciples() {
  const { tx } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {SEASTEAD_PRINCIPLES.map(({ num, title, desc, accent }) => (
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
