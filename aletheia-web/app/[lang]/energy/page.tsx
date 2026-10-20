'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Wind,
  Waves,
  Atom,
  Droplets,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export default function EnergyPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="offshoreWind" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Clean Energy · Design Study")}</span>
              </div>
              <StatusBadge status="Vision" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Clean Energy: a Design Study")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("A design study for zero-emission power combining offshore floating wind, wave energy and small modular reactors (SMRs), with green hydrogen. Nothing is built or contracted; any project would follow a founding treaty, with the host state.")}</p>
          </div>
        </div>
      </section>

      {/* ── GRID STATS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Design Target: Zero-Carbon")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("1.2 GW")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Design Target Capacity")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("400 kV")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Design Study: HVDC Link")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("By Treaty")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Location & Scale")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 GENERATION PILLARS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Energy Matrix")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Quad-Pillar Clean Generation Stack")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("By not relying on a single source, the design aims for highly reliable baseload power.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="icon-sovereign"><Wind className="w-5 h-5 text-gold" /></div>
            <h3 className="text-base font-bold text-navy">{t("Offshore Wind")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Floating turbines moored in high-wind waters, sized in the study at around 600 MW.")}</p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-4 group">
            <Atom className="w-8 h-8 text-navy" />
            <h3 className="text-base font-bold text-navy">{t("Small Modular Reactors")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Passively safe small modular reactors for steady baseload power, subject to the host state’s nuclear regulation.")}</p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <Waves className="w-8 h-8 text-laurel" />
            <h3 className="text-base font-bold text-navy">{t("Wave Energy Converters")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Oscillating water columns built into harbour breakwaters, turning wave surge into power.")}</p>
          </div>

          <div className="feature-card rounded-sm p-6 space-y-3 group">
            <div className="icon-sovereign"><Droplets className="w-5 h-5 text-gold" /></div>
            <h3 className="text-base font-bold text-navy">{t("Green Hydrogen")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed">{t("Electrolysers using surplus generation to produce hydrogen for industry and shipping.")}</p>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Built with a Host Nation")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Energy works would be developed with, and for the benefit of, a host state. No procurement, concession or investment is open.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/host-nations"

              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("For Host Nations")}</Link>
            <Link
              href="/development"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Territory by Treaty")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
