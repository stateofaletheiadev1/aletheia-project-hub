'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Anchor,
  Compass,
  Ship,
  Waves,
  ArrowRight,
} from 'lucide-react';

const MARITIME_DIVISIONS = [
  {
    title: 'Commercial Port Operations & Terminals',
    desc: 'Would supervise a deepwater port, container handling, bonded warehouses and cold-chain logistics, as set out in the St. Brendan design study.',
    icon: Anchor,
  },
  {
    title: 'Vessel Registry (Proposed)',
    desc: 'A ship registry, should Aletheia gain the lawful authority to keep one. No vessel can be registered with Aletheia today.',
    icon: Ship,
  },
  {
    title: 'Oceanographic Stewardship & Marine Reserves',
    desc: 'Would monitor the marine environment around Aletheia’s platforms, protect marine ecosystems and enforce zero-discharge rules.',
    icon: Waves,
  },
  {
    title: 'Autonomous Navigation & Hydrography',
    desc: 'Would publish nautical charts, run vessel traffic services and collect marine weather data, in cooperation with neighbouring states.',
    icon: Compass,
  },
];

export default function MinistryMaritimePage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="absolute inset-0">
          <Image
            src="/images/autonomous_harbor.jpg"
            alt={t("Design study of a harbour")}
            fill
            className="object-cover opacity-20 mix-blend-luminosity"
            priority
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Proposed Ministry")}</span>
              </div>
              <StatusBadge asset="institutions" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Ministry of Maritime Affairs & Ports")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("A proposed ministry for ports, shipping and marine stewardship around Aletheia’s platforms, under the Law of the Sea. It does not exist yet and exercises no authority.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/infrastructure"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("Port Design Studies")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/laws/maritime-zones"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("Maritime Zones Act (proposed)")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY METRICS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">{t("Vision")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Port Nicholas Design Study")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">{t("UNCLOS")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Any Maritime Zone")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">{t("UNCLOS")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("The Governing Law of the Sea")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">{t("None")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Vessels Registered")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MINISTERIAL DIVISIONS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Proposed Directorates")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Maritime Portfolios")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("How a future maritime ministry would be organised, once the first platform is built.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {MARITIME_DIVISIONS.map((div, idx) => (
            <div
              key={idx}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center shrink-0">
                  <div.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-navy">{tx(div.title)}</h3>
              </div>
              <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{tx(div.desc)}</p>
            </div>
          ))}
        </div>

        {/* ── VESSEL FLAGGING PORTAL BANNER ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3">
            <span className="text-xs font-bold text-gold uppercase tracking-wider block">{t("Vessel Registration")}</span>
            <h3 className="text-2xl font-bold text-navy">{t("Aletheia does not register vessels")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Aletheia is not a flag state and cannot register ships, yachts or any other vessel. A registry would be possible only after statehood, and only under international maritime law.")}</p>
          </div>

          <div className="lg:col-span-4 flex justify-end">
            <Link
              href="/development#seastead"
              className="px-6 py-3 bg-navy text-gold font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-2"
            >{t("The Seastead")}{' '}<ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("A Maritime Nation Governed by Covenant")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Read how Aletheia intends to build its own territory at sea, and the design studies for its maritime future.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/development"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("The Seastead")}</Link>
            <Link
              href="/government"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("All Ministries")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
