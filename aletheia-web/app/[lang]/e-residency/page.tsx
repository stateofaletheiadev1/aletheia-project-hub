'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth } from '@/components/brand/Logo';
import { ImageCaption } from '@/components/ui/ImageCaption';
import {
  Globe,
  Zap,
  Shield,
  CheckCircle,
  ArrowRight,
  Building2,
  Cpu,
  Lock,
  Clock,
  Star,
  ChevronDown,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: <Globe className="w-5 h-5 text-gold" />,
    title: 'European-Minded Law',
    desc: 'Proposed: operate under Aletheian constitutional law, designed with European standards in mind.',
  },
  {
    icon: <Zap className="w-5 h-5 text-gold" />,
    title: 'Online Incorporation',
    desc: 'Proposed: form a company online, with its charter recorded on StableChain.',
  },
  {
    icon: <Shield className="w-5 h-5 text-gold" />,
    title: 'No Personal Income Tax',
    desc: 'The draft Constitution proposes that neither citizens nor e-residents would pay personal income tax.',
  },
  {
    icon: <Lock className="w-5 h-5 text-gold" />,
    title: 'Cryptographic Identity',
    desc: 'Proposed: a digital identity credential, with personal data kept off the ledger.',
  },
  {
    icon: <Building2 className="w-5 h-5 text-gold" />,
    title: 'Payments, When Licensed',
    desc: 'Payment services would follow only through properly licensed providers. AEY is not issued to the public.',
  },
  {
    icon: <Cpu className="w-5 h-5 text-gold" />,
    title: 'Digital-First Public Services',
    desc: 'Proposed: registration and dispute resolution delivered online.',
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'A Founding Treaty',
    desc: 'E-residency would be offered only once Aletheia is established by treaty and has the lawful authority to do so.',
    time: 'Planned',
  },
  {
    step: '02',
    title: 'Application',
    desc: 'An online application with identity verification, under published rules.',
    time: 'Proposed',
  },
  {
    step: '03',
    title: 'Background Checks',
    desc: 'Identity and background checks against international registries, as the law would require.',
    time: 'Proposed',
  },
  {
    step: '04',
    title: 'Digital Identity',
    desc: 'A digital identity credential and access to online services.',
    time: 'Proposed',
  },
];

const FAQS = [
  {
    q: 'Can I apply for e-residency now?',
    a: 'No. Aletheia accepts no applications in its founding phase. E-residency is a proposal; it would be offered only once Aletheia is established by treaty. You can register interest as a Founding Member instead.',
  },
  {
    q: 'Would e-residency be the same as citizenship?',
    a: 'No. E-residency would give digital access to Aletheia\'s business services. It would not confer citizenship, the right to live in Aletheia, or a travel document.',
  },
  {
    q: 'Is there a fee?',
    a: 'No fee is charged, because nothing is offered. Any future fee would be set by law and published in advance.',
  },
  {
    q: 'Would my data be private?',
    a: 'That is the design: personal data stored off-ledger and encrypted, with only cryptographic hashes on the public ledger.',
  },
];

export default function EResidencyPage() {
  const { t, tx } = useI18n();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-20 pb-28 lg:pt-32 lg:pb-40">
        {/* Photographic maritime overlay */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero_maritime.jpg"
            alt=""
            fill
            className="object-cover opacity-10 mix-blend-luminosity"
            priority
          />
          <ImageCaption position="bottom-right" />
        </div>
        {/* Ambient orbs */}
        <div className="orb-gold w-[420px] h-[420px] -top-20 -right-20 opacity-55 animate-orb-float-1" />
        <div className="orb-burgundy w-[300px] h-[300px] bottom-0 left-12 opacity-40 animate-orb-float-2" />

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/60 rounded-[3px]">
                <StarOfTruth size={14} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">{t("E-Residency · Proposed")}</span>
              </div>

              <h1 className="heading-hero">{t("A digital residency,")}<br />
                <span className="text-gold-metallic">{t("by design.")}</span></h1>

              <p className="text-base sm:text-lg text-parchment/65 leading-relaxed font-light max-w-xl">{t("A proposed digital residency for entrepreneurs, developers and professionals: online company formation, a digital identity and European-minded law. It is not available today, and no applications are accepted.")}</p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link href="/founding-members" className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm">{t("Register interest as a Founding Member")}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="#how-it-works" className="btn-sovereign-ghost px-6 py-3.5 rounded-sm text-sm">{t("How It Would Work")}</Link>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-[11px] text-parchment/40">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-gold/60" />
                  <span>{t("Online company formation (proposed)")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-gold/60" />
                  <span>{t("No personal income tax (proposed)")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-gold/60" />
                  <span>{t("European-minded law (proposed)")}</span>
                </div>
              </div>
            </div>

            {/* Application card */}
            <div className="lg:col-span-5">
              <div className="bg-navy-deep/90 border border-gold/25 rounded-[4px] p-6 space-y-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold">{t("E-Residency")}</span>
                  <StatusBadge asset="eResidency" size="sm" />
                </div>
                <div className="border-t border-parchment/[0.07] pt-4 space-y-3">
                  <div className="text-2xl font-bold text-parchment">{t("Not yet available")}</div>
                  <div className="space-y-2">
                    {[
                      'No applications are accepted',
                      'No fee is charged',
                      'No identity documents are collected',
                      'Offered only after a founding treaty',
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-[12px] text-parchment/70">
                        <CheckCircle className="w-3.5 h-3.5 text-laurel shrink-0" />
                        {tx(f)}
                      </div>
                    ))}
                  </div>
                </div>
                <Link
                  href="/founding-members"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors"
                >{t("Register interest")}{' '}<ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <p className="text-[10px] text-parchment/40 text-center">{t("Free. Aletheia does not sell citizenship, residency, passports or currency.")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="py-20 lg:py-28 bg-parchment-light border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("The Proposal")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">{t("Designed for the independent professional.")}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => (
              <div
                key={i}
                className="bg-white border border-navy/[0.07] rounded-[4px] p-5 hover:shadow-[0_4px_24px_-4px_rgba(21,41,74,0.08)] hover:border-gold/20 transition-all"
              >
                <div className="w-9 h-9 bg-navy/[0.04] rounded-[3px] flex items-center justify-center mb-4">
                  {tx(b.icon)}
                </div>
                <h3 className="text-[14px] font-bold text-navy mb-2">{tx(b.title)}</h3>
                <p className="text-[12px] text-navy/60 leading-relaxed">{tx(b.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-parchment-canvas border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("The Process")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy">{t("How e-residency would work.")}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS_STEPS.map((s, i) => (
              <div key={s.step} className="relative">
                {tx(i < PROCESS_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-[calc(100%_-_12px)] w-[calc(100%_-_24px)] h-px bg-gradient-to-r from-gold/30 to-transparent z-10" />
                ))}
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-navy rounded-[4px] flex flex-col items-center justify-center border border-gold/20 relative">
                    <span className="text-[10px] text-gold/60 font-mono">{tx(s.step)}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-navy">{tx(s.title)}</h3>
                  <p className="text-[12px] text-navy/60 leading-relaxed">{tx(s.desc)}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gold font-semibold">
                    <Clock className="w-3 h-3" />
                    {tx(s.time)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 lg:py-28 bg-parchment-light border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("Common Questions")}</span>
              <h2 className="text-3xl font-bold tracking-tight text-navy leading-tight mb-4">{t("Everything you need to know.")}</h2>
              <p className="text-[13px] text-navy/60 leading-relaxed">{t("Have a specific question? Write to the founding team.")}</p>
              <Link href="/contact" className="inline-flex items-center gap-2 mt-4 text-[12px] font-bold text-navy hover:text-gold uppercase tracking-wider transition-colors">{t("Contact")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold" />
              </Link>
            </div>
            <div className="lg:col-span-8 space-y-2">
              {FAQS.map((faq, i) => (
                <div key={i} className="border border-navy/[0.08] rounded-[4px] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-navy/[0.02] transition-colors"
                  >
                    <span className="text-[13px] font-semibold text-navy pr-4">{tx(faq.q)}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gold shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {tx(openFaq === i && (
                    <div className="px-4 pb-4 text-[12px] text-navy/65 leading-relaxed border-t border-navy/[0.06]">
                      <p className="pt-3">{tx(faq.a)}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── APPLY CTA ── */}
      <section id="apply" className="py-20 lg:py-28 bg-navy text-parchment">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <StarOfTruth size={48} className="mx-auto" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">{t("Want to take part now?")}</h2>
            <p className="text-parchment/60 leading-relaxed">{t("Aletheia is forming its founding community. Registering interest is free and confers no status, rights or residency.")}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/founding-members"
                className="px-8 py-3.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors flex items-center gap-2 group"
              >{t("Register interest as a Founding Member")}<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="text-[11px] text-parchment/40">{t("Registering interest is free. Aletheia does not sell citizenship, residency, passports or currency.")}</p>
          </div>
        </div>
      </section>

    </div>
  );
}
