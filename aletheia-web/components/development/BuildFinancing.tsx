'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { Anchor, Handshake, Landmark, Link2, ShieldCheck } from 'lucide-react';

/** How the building of the platforms would be paid for, kept apart from the reserves of the Reserve Bank. */
export const FUNDING_SOURCES = [
  {
    icon: Anchor,
    title: 'Ground leases and concessions',
    desc: 'Long-term leases of platform space for homes and businesses, and concessions for the port, energy and services, paid to the Treasury on published terms.',
  },
  {
    icon: Landmark,
    title: 'Founding contributions',
    desc: 'Contributions from founding members and patrons who choose to support the first platform, received through a lawful structure under published terms.',
  },
  {
    icon: Handshake,
    title: 'Infrastructure partners',
    desc: 'Engineering, shipbuilding and project-finance partners, under agreements that are published and tested for value for money before they are signed.',
  },
  {
    icon: Link2,
    title: 'StableChain',
    desc: 'Every contribution, payment and contract for the build recorded on StableChain, so that anyone can follow the money from receipt to the steel in the water. Once the network is live, its fixed fees would be paid to the Treasury.',
  },
];

export function BuildFinancing({ heading = true }: { heading?: boolean }) {
  const { t, tx } = useI18n();
  return (
    <div className="space-y-8">
      {heading && (
        <div className="max-w-3xl space-y-4">
          <div className="eyebrow">{t("Financing the Build")}</div>
          <h2 className="text-4xl font-bold tracking-tight text-navy leading-tight">{t("Building the islands without touching the reserves.")}</h2>
          <p className="text-navy/65 leading-[1.85] font-light">{t("Building platforms is a construction project; issuing money is not, and Aletheia keeps the two strictly apart. The reserves held by the Reserve Bank of Aletheia serve monetary policy alone. Under the draft Constitution they may never be spent on construction or lent to the State; the build is paid for from its own sources.")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {FUNDING_SOURCES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="sovereign-card-premium rounded-sm p-6 space-y-3">
            <div className="w-9 h-9 rounded-sm bg-navy/[0.06] text-navy flex items-center justify-center">
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
            <p className="text-sm text-navy/65 leading-relaxed font-light">{tx(desc)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-navy-deep text-parchment rounded-sm border border-gold/25 p-6 sm:p-7 flex gap-4">
          <ShieldCheck className="w-6 h-6 text-gold shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-2">
            <h3 className="font-bold">{t("The reserves stay where they are")}</h3>
            <p className="text-sm text-parchment/75 leading-relaxed font-light">{t("The Reserve Bank may not lend to the State or pay for its works, and no reserve is pledged to any construction contract. Money for the build and the reserves of the Reserve Bank are recorded separately, so each can be checked on its own.")}</p>
            <Link href="/constitution#article-160" className="inline-block text-xs font-bold uppercase tracking-wider text-gold hover:text-gold-tint">{t("Draft Constitution, Article 160")}</Link>
          </div>
        </div>
        <p className="lg:col-span-4 self-center text-xs text-navy/60 leading-relaxed">{t("Funding is not open yet. Aletheia takes no money through this site; any future round will be announced with its terms and its lawful structure.")}</p>
      </div>
    </div>
  );
}
