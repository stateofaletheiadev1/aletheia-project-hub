'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const ENTITY_TYPES = [
  {
    id: 'sarl',
    name: 'Aletheia Private Limited (Ltd)',
    idealFor: 'Tech start-ups, digital consultancies, e-commerce and software ventures.',
    fee: 'To be set by law',
    time: 'Design target: minutes',
    features: [
      '1 to 50 shareholders',
      'No minimum paid-up share capital',
      'Remote digital contract and governance execution',
      'No corporate income tax, as proposed',
      'Digital corporate seal and cryptographic charter',
    ],
  },
  {
    id: 'corp',
    name: 'Joint Stock Corporation (Corp)',
    idealFor: 'Larger enterprises, shipping lines and industrial companies.',
    fee: 'To be set by law',
    time: 'Design target: one day',
    features: [
      'Registered shareholders only, with a public register of beneficial owners',
      'On-chain share registers',
      'A board of directors under the Companies Act',
      'Financial reporting to published standards',
      'Anti-money-laundering checks on every incorporation',
    ],
  },
  {
    id: 'foundation',
    name: 'Covenant Foundation',
    idealFor: 'Non-profit endowments, research and charitable purposes.',
    fee: 'To be set by law',
    time: 'Design target: two days',
    features: [
      'Perpetual legal succession independent of founders',
      'Fiduciary duties set by statute',
      'Council and guardian oversight',
      'Public register of foundations and their purposes',
      'Annual published accounts',
    ],
  },
];

export default function BusinessPage() {
  const { t, tx } = useI18n();
  const [selectedEntity, setSelectedEntity] = useState('sarl');

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="relative guilloche-bg text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-36 border-b border-gold/30">
        <HeroBackdrop image="studioOffice" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 border border-gold/40 bg-navy-deep/90 rounded-sm gold-glow">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Business Platform · Proposed")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Company formation,")}{' '}<span className="text-gold-metallic">{t("by design.")}</span>
            </h1>

            <p className="text-base sm:text-lg text-parchment/80 leading-relaxed font-light max-w-2xl">{t("A proposed paperless company registry, drawing on English commercial-law principles and cryptographic registries. It is not open: no company can be formed in Aletheia today, and no fees are charged.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/founding-members"

                className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group"
              >
                <span>{t("Register interest as a Founding Member")}</span>
                <ArrowRight className="w-4 h-4 text-navy group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/economy"
                className="btn-sovereign-navy px-6 py-3.5 rounded-sm flex items-center gap-2"
              >{t("Monetary System & AEY")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY ADVANTAGES ── */}
      <section className="bg-navy-deep border-b border-gold/20 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">0%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Proposed Corporate Income Tax")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("Minutes")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Design Target: Incorporation")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("None")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Companies Registered")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">{t("APN")}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">{t("Payment Rails in Development")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORPORATE FORMS DIRECTORY ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Proposed Entities")}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight">{t("Proposed Company Structures")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Structures proposed in a draft Companies Act. None is available yet.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ENTITY_TYPES.map((entity) => (
            <div
              key={entity.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedEntity === entity.id}
              onClick={() => setSelectedEntity(entity.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedEntity(entity.id); } }}
              className={`sovereign-card cursor-pointer rounded-sm p-7 flex flex-col justify-between transition-all bg-white relative overflow-hidden group ${
                selectedEntity === entity.id
                  ? 'border-gold shadow-xl ring-1 ring-gold/40'
                  : 'border-navy/15 hover:border-gold/50'
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-5">
                <div className="flex justify-between items-start">
                  <div className={`p-2.5 rounded-sm ${selectedEntity === entity.id ? 'bg-gold/15 text-gold-shadow' : 'bg-navy/5 text-navy group-hover:text-gold-shadow transition-colors'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 bg-parchment-canvas border border-navy/10 rounded-sm text-[10px] font-mono text-navy font-bold">
                    {tx(entity.time)}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-navy">{tx(entity.name)}</h3>
                  <p className="text-xs text-navy/70 leading-relaxed mt-1 font-light">{tx(entity.idealFor)}</p>
                </div>

                <div className="py-3.5 border-y border-navy/10 flex items-baseline justify-between bg-parchment-canvas/50 px-3 -mx-3 rounded-sm">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-navy/50 block font-semibold">{t("Annual Fee")}</span>
                    <span className="text-xl font-bold font-mono text-navy tracking-tight">{tx(entity.fee)}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gold font-mono uppercase px-2 py-0.5 border border-gold/30 bg-gold/10 rounded-sm">{t("Proposed")}</span>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Proposed Features:")}</span>
                  <ul className="space-y-2 text-xs text-navy/70 font-light">
                    {entity.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                        <span>{tx(feat)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-navy/10">
                <Link
                  href="/founding-members"
                  className="btn-sovereign-navy w-full py-3 rounded-sm text-center block transition-all"
                >{t("Register Interest")}</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4-STEP FORMATION PROCESS ── */}
      <section className="py-16 bg-parchment-light border-y border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("How It Would Work")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Four Steps, as Designed")}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                01
              </span>
              <h4 className="text-sm font-bold text-navy">{t("Digital Identity")}</h4>
              <p className="text-xs text-navy/70 leading-relaxed">{t("Identity verification and a digital credential, once e-residency exists.")}</p>
            </div>

            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                02
              </span>
              <h4 className="text-sm font-bold text-navy">{t("Name & Structure")}</h4>
              <p className="text-xs text-navy/70 leading-relaxed">{t("Check a company name and set out shareholdings online.")}</p>
            </div>

            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                03
              </span>
              <h4 className="text-sm font-bold text-navy">{t("Digital Signature")}</h4>
              <p className="text-xs text-navy/70 leading-relaxed">{t("Sign the articles of incorporation with a cryptographic key.")}</p>
            </div>

            <div className="p-5 bg-white border border-navy/15 rounded-sm space-y-3">
              <span className="w-7 h-7 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold font-mono">
                04
              </span>
              <h4 className="text-sm font-bold text-navy">{t("Registry Inscription")}</h4>
              <p className="text-xs text-navy/70 leading-relaxed">{t("The charter is recorded on StableChain. Banking would depend on licensed partner institutions.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Interested in Building a Business Here?")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("The business platform is a proposal. Register interest to follow its progress; nothing is offered or charged.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/founding-members"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Register interest as a Founding Member")}</Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Contact the Founding Team")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
