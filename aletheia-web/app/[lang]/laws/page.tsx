'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  BookOpen,
  Search,
  Calendar,
  ArrowRight,
  Hash,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export interface StatuteMeta {
  slug: string;
  code: string;
  title: string;
  article: string;
  date: string;
  hash: string;
  summary: string;
  pages: number;
}

export const STATUTES: StatuteMeta[] = [
  {
    slug: 'constitutional-supremacy',
    code: 'ACT-2026-01',
    title: 'Constitutional Supremacy & Judicial Review Act',
    article: 'Constitution Article 1 § 3',
    date: '2026-01-20',
    hash: '8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    summary: 'Would affirm the supremacy of the Covenant over ordinary statutes, and give the High Court jurisdiction to void unconstitutional acts.',
    pages: 18,
  },
  {
    slug: 'languages-act',
    code: 'ACT-2026-02',
    title: 'Official Languages & Diplomatic Communication Act',
    article: 'Constitution Article 2 § 2',
    date: '2026-01-28',
    hash: 'adfff80b8341114fbd4a689b0cea99e489ce1b3133272696963edd636d0a13e2',
    summary: 'Would designate English, German, Dutch, Serbian and Italian as official languages, regulating translations, Gazette publications and travel-document inscriptions.',
    pages: 14,
  },
  {
    slug: 'maritime-zones',
    code: 'ACT-2026-03',
    title: 'Maritime Zones Act',
    article: 'Constitution Article 3 § 4',
    date: '2026-02-05',
    hash: 'fdd4edf14bb8710d0bb0da90a2e997f381b4950851ab3d794f7497dce07be806',
    summary: 'Provides that Aletheia would claim no maritime zone beyond what the Law of the Sea allows its platforms.',
    pages: 26,
  },
  {
    slug: 'nationality-act',
    code: 'ACT-2026-04',
    title: 'Nationality & Naturalisation Act',
    article: 'Constitution Article 8 § 5',
    date: '2026-02-14',
    hash: '62c38c614d4e59bbd1aa762296f101f262c3f731034383dccc46d0ff9ecb879a',
    summary: 'Would set the criteria for citizenship by birth and by naturalisation through physical residence, and forbid citizenship for payment.',
    pages: 32,
  },
  {
    slug: 'e-residency-act',
    code: 'ACT-2026-05',
    title: 'Digital E-Residency & Virtual Jurisdiction Act',
    article: 'Constitution Article 9 § 4',
    date: '2026-02-22',
    hash: '55902148ea20914801fa8892ca3401ef6291a0123ca78091ecb87201948ba209',
    summary: 'Would define the rights of digital identity holders, online incorporation and legal standing, and exclude physical residence.',
    pages: 24,
  },
  {
    slug: 'monetary-act',
    code: 'ACT-2026-06',
    title: 'Monetary Architecture Act',
    article: 'Constitution Article 14 § 6',
    date: '2026-03-04',
    hash: 'bee5ed66b8935fd4ee0c11db3adb79337ed73bdd5299f54a9dbd0476991b8450',
    summary: 'Would create the Aletheian Guilder (AEY), make the Reserve Bank of Aletheia its sole issuer, and prohibit monetary financing of the State.',
    pages: 28,
  },
  {
    slug: 'executive-act',
    code: 'ACT-2026-07',
    title: 'Executive Cabinet & Ministerial Portfolios Act',
    article: 'Constitution Article 15 § 5',
    date: '2026-03-12',
    hash: '9920184fa9802ecb8720918ba340291ef732014890ecb8201948ea20914801fa',
    summary: 'Would impose the constitutional maximum of nine ministries, with their responsibilities, oaths of office and parliamentary oversight.',
    pages: 20,
  },
  {
    slug: 'adss-act',
    code: 'ACT-2026-08',
    title: 'Aletheian Defence & Security Service (ADSS) Governance Act',
    article: 'Constitution Article 18 § 4',
    date: '2026-03-20',
    hash: '4a44d2a77acfb2e0b3842f3e71e2a227bb1f59e2cfa43d544dad655cf7a09040',
    summary: 'Would place every security service under civilian control, reserve policing to the Police Directorate, and set a coastguard rescue duty.',
    pages: 36,
  },
  {
    slug: 'cyber-resilience',
    code: 'ACT-2026-09',
    title: 'Critical National Infrastructure & Cyber Resilience Act',
    article: 'Constitution Article 19 § 3',
    date: '2026-03-29',
    hash: '66189023ebca87201948ea20914801e991204890ecb8201948ea20914801fa88',
    summary: 'Would set cryptographic standards, validator protection and the isolation of control systems in energy and maritime facilities.',
    pages: 30,
  },
];

export default function LawsIndexPage() {
  const { t, tx } = useI18n();
  const [search, setSearch] = useState('');

  const filtered = STATUTES.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="justice" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Sovereign Covenant State of Aletheia")}</span>
              </div>
              <StatusBadge status="Proposed" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Proposed Acts")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Draft legislation proposed under the draft Covenant of Aletheia. None has been enacted and none has legal force; each is published with a hash of its text.")}</p>
          </div>
        </div>
      </section>

      {/* ── CONTROLS & SEARCH ── */}
      <section className="py-6 bg-white border-b border-navy/15 sticky top-16 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search proposed Acts or keywords...")}
                className="w-full pl-9 pr-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
              />
            </div>
            <span className="text-xs font-mono text-navy/60">{t("Showing")}{' '}{tx(filtered.length)}{' '}{t("of")}{' '}{tx(STATUTES.length)}{' '}{t("Proposed Acts")}</span>
          </div>
        </div>
      </section>

      {/* ── LAWS GRID ── */}
      <section className="py-12 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((law) => (
            <div
              key={law.slug}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[10px] font-bold rounded-sm border border-navy/10">
                      {tx(law.code)}
                    </span>
                    <span className="text-[11px] font-mono text-gold font-bold">{tx(law.article)}</span>
                  </div>
                  <span className="text-[11px] font-mono text-navy/50 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {tx(law.date)}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-navy leading-snug">{tx(law.title)}</h2>
                <p className="text-xs text-navy/70 leading-relaxed">{tx(law.summary)}</p>
              </div>

              <div className="pt-4 border-t border-navy/10 flex items-center justify-between text-xs">
                <span className="text-navy/50 font-mono text-[11px] flex items-center gap-1">
                  <Hash className="w-3 h-3 text-gold" /> {law.hash.slice(0, 16)}...
                </span>
                <Link
                  href={`/laws/${law.slug}`}
                  className="px-4 py-1.5 bg-navy text-gold font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />{' '}{t("Read Full Act")}{' '}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
