'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ServerCrash, KeyRound, Cpu, Bug, ArrowRight } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const MANDATES = [
  { icon: ServerCrash, title: 'Validator Protection', desc: 'DDoS protection, network failover and hardware security modules isolating the signing keys of AletheiaChain validators.' },
  { icon: KeyRound, title: 'Post-Quantum Cryptography', desc: 'A planned move to standardised post-quantum algorithms, so records signed today stay safe in future.' },
  { icon: Cpu, title: 'Isolated Control Systems', desc: 'Industrial control systems in energy and port facilities kept off the public internet, by design.' },
  { icon: Bug, title: 'Coordinated Disclosure', desc: 'A clear way for researchers to report vulnerabilities, with acknowledgement and credit.' },
];

export default function CybersecurityPage() {
  const { t, tx } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="circuitGlow" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Cybersecurity Department")}</span>
              </div>
              <StatusBadge asset="cyber" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Protecting Digital Infrastructure")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("A planned department to protect Aletheia’s digital infrastructure: the AletheiaChain validators, the registries and, in future, the networks of its platforms. Today, the founding team looks after the security of this website and AletheiaChain Mainnet Beta.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="#disclosure"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("Report a Vulnerability")}{' '}<Bug className="w-3.5 h-3.5" />
              </a>
              <Link
                href="/aletheiachain"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("About AletheiaChain")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── MANDATES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Zero-Trust by Design")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Four Planned Mandates")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Designed with reference to ENISA and BSI baseline standards.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {MANDATES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="feature-card rounded-sm p-6 space-y-3">
              <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-navy">{tx(title)}</h3>
              <p className="text-xs text-navy/70 leading-relaxed">{tx(desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DISCLOSURE ── */}
      <section id="disclosure" className="bg-navy text-parchment py-16 border-t border-gold/20 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <StarOfTruth size={36} />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Coordinated Vulnerability Disclosure")}</h2>
          <p className="text-sm text-parchment/70 leading-relaxed">{t("If you find a security problem in this website or AletheiaChain Mainnet Beta, please tell us privately and give us reasonable time to fix it before publishing. We will acknowledge your report and credit you if you wish. There is no paid bug bounty.")}</p>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2"><span className="text-gold font-semibold">{t("Report to:")}</span> <a href="mailto:security@aletheiagov.org" className="text-parchment underline underline-offset-4 decoration-gold">security@aletheiagov.org</a></div>
          </div>
          <Link href="/contact" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold hover:text-gold-tint transition-colors">{t("Contact the Founding Team")}{' '}<ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      </section>

    </div>
  );
}
