'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Building2, Anchor, Zap, Globe2, AlertTriangle } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const SECTORS = [
  { icon: Anchor, tone: 'text-gold', title: 'Ports & Logistics', desc: 'Container berths, cold-chain storage and bunkering, within a territory agreed by treaty.' },
  { icon: Zap, tone: 'text-laurel', title: 'Clean Energy', desc: 'Offshore wind, subsea cables and green hydrogen, as set out in the design studies.' },
  { icon: Building2, tone: 'text-navy', title: 'Urban Development', desc: 'Housing, university campuses and laboratories in a future pilot zone.' },
  { icon: Globe2, tone: 'text-gold', title: 'Digital Connectivity', desc: 'Cable landing stations and data centres.' },
];

export default function InvestPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="handshake" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Investment & Partnerships")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Building Aletheia, Together")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("How partners and investors could one day take part in building Aletheia: in ports, clean energy and a pilot zone, alongside a host state. Nothing is offered today.")}</p>
          </div>
        </div>
      </section>

      {/* ── NOTHING IS OFFERED ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-parchment/80 leading-relaxed">{t("Aletheia offers no bonds, shares, tokens, currency or other investments, and accepts no investment through this site. Any future funding would be set out openly, through a lawful structure and only with the required authorisations.")}</p>
        </div>
      </section>

      {/* ── SECTORS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-gold uppercase tracking-wider">{t("Future Sectors")}</span>
            <h3 className="text-2xl font-bold text-navy">{t("Where Partnership Could Follow a Treaty")}</h3>
            <p className="text-xs text-navy/70">{t("Sectors drawn from the design studies. Each depends on a founding treaty and the consent of the host state.")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            {SECTORS.map(({ icon: Icon, tone, title, desc }) => (
              <div key={title} className="p-4 bg-parchment-light rounded-sm space-y-2">
                <Icon className={`w-5 h-5 ${tone}`} />
                <strong className="text-navy block font-bold">{tx(title)}</strong>
                <p className="text-navy/70">{tx(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Talk to the Founding Team")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Governments and organisations interested in a future partnership are welcome to write. Host-state discussions are confidential.")}</p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/host-nations"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("For Host Nations")}</Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Contact")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
