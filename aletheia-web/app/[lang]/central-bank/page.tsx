'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AeyNotice } from '@/components/ui/AeyNotice';
import { ArrowUpRight, Landmark } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { RESERVE_BANK } from '@/lib/reserve-bank';

const FUNCTIONS = [
  { value: 'Issue', label: 'The Aletheian Guilder' },
  { value: 'Policy', label: 'Monetary Policy' },
  { value: 'Payments', label: 'Settlement & Oversight' },
  { value: 'Record', label: 'Public Register & Statistics' },
];

export default function CentralBankPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="marketChart" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Banca Centralis Aletheiae")}</span>
              </div>
              <StatusBadge asset="reserveBank" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Reserve Bank of Aletheia")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("The monetary institution being established for the Sovereign Covenant State of Aletheia, and the issuer of its currency, the Aletheian Guilder. Its purpose: money that keeps its value, payments that work, and a public record anyone can check.")}</p>

            <div className="pt-2">
              <a
                href={RESERVE_BANK.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-sovereign-gold inline-flex px-7 py-3.5 rounded-sm items-center gap-2.5 group text-sm"
              >
                <span>{t("Visit the Reserve Bank")}</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCTIONS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {FUNCTIONS.map(({ value, label }) => (
              <div key={value} className="space-y-1">
                <span className="text-2xl font-bold text-gold">{tx(value)}</span>
                <p className="text-xs text-parchment/70 uppercase tracking-wide">{tx(label)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRINCIPLES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Founding Principles")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("A Currency Held to Account")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("The Guilder is intended as a fiat currency, trusted for the rules that govern it. The Reserve Bank is to issue it only under published rules, record every issue in a public register, and explain each decision.")}</p>

            <div className="space-y-3 text-xs text-navy/75">
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1">
                <strong className="text-navy block font-bold">{t("Separation from Fiscal Politics:")}</strong>
                <span>{t("The body that issues money does not spend it. The Reserve Bank is kept apart from the Treasury and does not finance the State’s budget.")}</span>
              </div>
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1">
                <strong className="text-navy block font-bold">{t("Independent and Accountable:")}</strong>
                <span>{t("The Bank is intended to decide monetary policy within its legal mandate, and in return to publish its decisions, its reasons and its accounts.")}</span>
              </div>
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1">
                <strong className="text-navy block font-bold">{t("Modern Payments:")}</strong>
                <span>{t("Settlement in central bank money, the digital Guilder on the AletheiaChain, and payment standards aligned with European practice.")}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-navy text-parchment p-8 rounded-sm border border-gold/30 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="icon-sovereign"><Landmark className="w-5 h-5 text-gold" /></div>
              <h3 className="text-lg font-bold text-parchment">{t("The Reserve Bank’s Website")}</h3>
            </div>
            <p className="text-xs text-parchment/75 leading-relaxed">{t("Monetary policy, issuance, the banknote series, publications and statistics are published by the Reserve Bank of Aletheia on its own website.")}</p>
            <a
              href={RESERVE_BANK.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-gold hover:text-gold-tint transition-colors"
            >
              <span>{RESERVE_BANK.host}</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>

        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("The Proposed Currency: The Aletheian Guilder (AEY)")}</h2>
          <AeyNotice tone="dark" className="max-w-2xl mx-auto text-left" />
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Learn more about the technical, monetary, and settlement characteristics of the Aletheian Guilder (AEY).")}</p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/aey"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("The Aletheian Guilder (AEY)")}</Link>
            <Link
              href="/economy"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Economy & Monetary Policy")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
