'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Globe2,
  Scale,
  ShieldCheck,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const DIPLOMATIC_PILLARS = [
  {
    title: 'A Founding Treaty',
    desc: 'The first task: negotiating, openly and by consent, a treaty or long-term leasehold with a recognised host state, beginning with a pilot zone.',
  },
  {
    title: 'Covenants & Agreements',
    desc: 'After a founding treaty, agreements on trade, navigation and environmental stewardship, negotiated under the Vienna Convention on the Law of Treaties.',
  },
  {
    title: 'Justice & Arbitration',
    desc: 'A proposed legal system and commercial arbitration, designed to enforce awards under the 1958 New York Convention once Aletheia can lawfully accede to it.',
  },
  {
    title: 'Consular Protection & Documents',
    desc: 'Consular protection and a travel document, only once Aletheia has the lawful authority. Today there is a design concept, not a document.',
  },
];

export default function MinistryForeignAffairsPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="assembly" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Proposed Ministry")}</span>
              </div>
              <StatusBadge asset="institutions" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Ministry of Foreign Affairs & Justice")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("The proposed ministry for host-state relations, treaties, justice and arbitration, in accordance with international law and the UN Charter. It does not exist yet, and Aletheia has signed no treaty.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/host-nations"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("For Host Nations")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/government"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("Cabinet Directory")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATUTORY RESPONSIBILITIES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Ministerial Mandate")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Four Pillars of External Action")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("As proposed in the Executive Government Act, the Ministry would conduct foreign policy, treaties and the administration of justice. It does not exist yet.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {DIPLOMATIC_PILLARS.map((pillar, idx) => (
            <div
              key={idx}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center shrink-0">
                  {tx(idx === 0 ? <Globe2 className="w-5 h-5" /> : idx === 1 ? <Scale className="w-5 h-5" /> : idx === 2 ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />)}
                </div>
                <h3 className="text-lg font-bold text-navy">{tx(pillar.title)}</h3>
              </div>
              <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{tx(pillar.desc)}</p>
            </div>
          ))}
        </div>

        {/* ── DIPLOMATIC TREATY REPOSITORY ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/10 pb-4">
            <div>
              <span className="text-xs font-bold text-gold uppercase tracking-wider block">{t("Treaty Register")}</span>
              <h3 className="text-2xl font-bold text-navy">{t("Treaties & Agreements")}</h3>
            </div>
            <Link
              href="/documents"
              className="text-xs text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
            >{t("All Public Documents")}{' '}<ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 bg-parchment-light border border-navy/10 rounded-sm space-y-2">
            <h4 className="text-sm font-bold text-navy">{t("No treaties or agreements")}</h4>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Aletheia has signed no treaty or agreement with any state or organisation. The first would be a founding treaty with a host state; it will be published here when it exists.")}</p>
          </div>
        </div>

      </section>

      {/* ── DIPLOMATIC MISSIONS CALLOUT ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Host-State & Government Enquiries")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Governments and international bodies may write to the founding team. Host-state enquiries are confidential.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Contact the Founding Team")}</Link>
            <Link
              href="/government"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("All Ministries Directory")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
