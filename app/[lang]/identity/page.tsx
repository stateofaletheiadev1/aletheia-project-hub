'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StarOfTruth, HexagonCross } from '@/components/brand/Logo';
import { NationalFlag } from '@/components/brand/Flags';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

export default function IdentityPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="highlands" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Chancery of State")}</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">{t("National Symbols & Heraldic Insignia")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("The official heraldry, vexillology, and state insignia of The Sovereign Covenant State of Aletheia. Established by the National Symbols Act and protected under international copyright and diplomatic protocols.")}</p>
          </div>
        </div>
      </section>

      {/* ── 1. THE COAT OF ARMS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-navy/10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-5 flex justify-center">
            <div className="p-8 bg-white border border-navy/15 rounded-sm shadow-xl flex flex-col items-center space-y-4">
              <Image
                src="/coat_of_arms.png"
                alt={t("The Sovereign Coat of Arms of Aletheia")}
                width={260}
                height={260}
                className="object-contain"
                priority
              />
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-navy uppercase tracking-wider block">{t("The Sovereign Arms of Aletheia")}</span>
                <span className="text-[11px] font-mono text-gold italic font-semibold">{t("Motto: Veritas in Foedere")}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Heraldic Composition")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Sovereign Shield & Quarters")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Blazoned pursuant to Statute 2026-02, the arms unite European heraldic tradition with maritime and constitutional allegory.")}</p>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1.5">
                <strong className="text-navy block font-bold">{t("Quarter I: The Citadel Tower")}</strong>
                <p className="text-navy/70 leading-relaxed">{t("Gules, an embattled fortress tower with open portal, symbolizing territorial fortification and open hospitality.")}</p>
              </div>

              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1.5">
                <strong className="text-navy block font-bold">{t("Quarter II: Book & Sacred Heart")}</strong>
                <p className="text-navy/70 leading-relaxed">{t("An open codex surmounted by the flame of the Sacred Heart, representing Christian civic wisdom and moral duty.")}</p>
              </div>

              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1.5">
                <strong className="text-navy block font-bold">{t("Quarter III: The Wheat Sheaf")}</strong>
                <p className="text-navy/70 leading-relaxed">{t("A bound golden garb of wheat, signifying economic abundance, agrarian stewardship, and cooperative enterprise.")}</p>
              </div>

              <div className="p-4 bg-white border border-navy/10 rounded-sm space-y-1.5">
                <strong className="text-navy block font-bold">{t("Quarter IV: The Oceanic Caravel")}</strong>
                <p className="text-navy/70 leading-relaxed">{t("A three-masted exploratory galleon traversing azure waves, celebrating oceanic heritage and maritime exploration.")}</p>
              </div>
            </div>

            <div className="p-4 bg-parchment-light border border-navy/15 rounded-sm flex items-center gap-4">
              <HexagonCross size={32} />
              <div className="text-xs">
                <strong className="text-navy block font-bold">{t("Inescutcheon of Antioch (Central Badge)")}</strong>
                <span className="text-navy/70">{t("A hexagonal seal of navy and gold charged with a Latin cross, signifying the federal covenant center.")}</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 2. THE NATIONAL FLAG ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-navy/10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Vexillology & Standards")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Covenant Flag & Naval Ensign")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("The national flag displays the Star of Truth centered upon a field of Covenant Navy, bordered by bands of archival parchment. The proportions follow the classic maritime ratio of 2:3.")}</p>

            <div className="space-y-3 text-xs text-navy/75">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-navy border border-gold/40 shrink-0" />
                <span><strong>{t("Covenant Navy (#15294A):")}</strong>{' '}{t("The solemn depth of oceanic jurisdiction and eternal law.")}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-gold border border-navy/30 shrink-0" />
                <span><strong>{t("Aletheian Gold (#C49A4E):")}</strong>{' '}{t("The radiant light of the Star of Truth, justice, and nobility.")}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-parchment-light border border-navy/20 shrink-0" />
                <span><strong>{t("Parchment White (#F7F4EE):")}</strong>{' '}{t("Peace, constitutional transparency, and civic concord.")}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="p-8 bg-navy rounded-sm border border-gold/30 shadow-2xl space-y-4 text-center">
              <NationalFlag className="w-64 h-auto mx-auto shadow-md" />
              <div className="pt-2 text-[11px] font-mono text-gold tracking-widest uppercase">{t("National Civil & State Flag (Ratio 2:3)")}</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. THE PASSPORT SPECIMEN ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-covenant-burgundy/40 to-gold/20 rounded-2xl blur-xl opacity-60" />
              <div className="relative">
                <Image
                  src="/passport_cover.png"
                  alt={t("Aletheian Passport Booklet")}
                  width={280}
                  height={391}
                  className="object-contain"
                  style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5)) drop-shadow(0 6px 12px rgba(112,24,36,0.35))' }}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Diplomatic Travel Credentials")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Covenant Burgundy Passport")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Issued in deep Covenant Burgundy leather with hot-stamped gold foil heraldry, the biometric travel document is the premier sovereign identity credential of Aletheian citizens.")}</p>

            <ul className="space-y-3 text-xs text-navy/70">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("ICAO Doc 9303 Part 9:")}</strong>{' '}{t("Contactless cryptographic chip loaded with biometric facial and fingerprint records.")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Laser Polycarbonate:")}</strong>{' '}{t("Laser-engraved photo data page impervious to alteration or mechanical erasure.")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Multilingual Typography:")}</strong>{' '}{t("Inscribed in English, German, Dutch, Serbian, and Italian.")}</span>
              </li>
            </ul>

            <div className="pt-2">
              <Link
                href="/passport"
                className="px-6 py-3 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors inline-flex items-center gap-2"
              >{t("Explore Passport Specifications")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
