'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Placeholder } from '@/components/ui/Placeholder';
import { Mail, Newspaper, Handshake, Landmark, Users, ArrowRight } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const ENQUIRIES = [
  { icon: Landmark, title: 'Government enquiries', desc: 'Governments and international bodies. Confidential by default.', subject: 'Government enquiry' },
  { icon: Newspaper, title: 'Press', desc: 'Journalists and researchers writing about Aletheia or new-country projects.', subject: 'Press enquiry' },
  { icon: Handshake, title: 'Partnerships', desc: 'Organisations interested in working with the founding team.', subject: 'Partnership enquiry' },
  { icon: Users, title: 'General', desc: 'Anything else. To join the founding community, register interest instead.', subject: 'General enquiry' },
];

export default function ContactPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="laptopPhone" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Contact")}</span>
              </div>
              <StatusBadge asset="platform" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Contact the Founding Team")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("For government enquiries, press, partnerships and general questions. Aletheia has no embassies, missions or offices; the founding team answers every message itself.")}</p>
          </div>
        </div>
      </section>

      {/* ── HOW TO REACH US ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-navy">{t("What are you writing about?")}</h2>
              <p className="text-xs text-navy/70 mt-1">{t("Put the type of enquiry in the subject line, so it reaches the right person quickly.")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ENQUIRIES.map(({ icon: Icon, title, desc, subject }) => (
                <div key={title} className="bg-white p-5 border border-navy/15 rounded-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gold" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-navy">{tx(title)}</h3>
                  </div>
                  <p className="text-xs text-navy/70 leading-relaxed">{tx(desc)}</p>
                  <p className="text-[11px] font-mono text-navy/50">{t("Subject:")}{' '}{tx(subject)}</p>
                </div>
              ))}
            </div>
            <Link href="/founding-members" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy hover:text-gold transition-colors group">
              <span>{t("Register interest as a Founding Member")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-navy text-parchment p-6 rounded-sm border border-gold/30 space-y-4">
              <span className="text-[10px] font-mono uppercase text-gold">{t("Write to us")}</span>
              <h3 className="text-lg font-bold text-parchment">{t("The Founding Team")}</h3>
              <div className="space-y-3 text-xs text-parchment/75">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                  <Placeholder>contact email address</Placeholder>
                </div>
                <p className="leading-relaxed">{t("We aim to reply within a few working days. Government enquiries are treated as confidential.")}</p>
              </div>
            </div>
            <p className="text-xs text-navy/60 leading-relaxed">{t("Aletheia does not sell citizenship, residency, passports or currency. Anyone offering them in Aletheia’s name is not acting for us.")}</p>
          </div>

        </div>
      </section>

    </div>
  );
}
