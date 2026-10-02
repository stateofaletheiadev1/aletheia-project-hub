'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  Globe,
  Zap,
  Shield,
  CheckCircle,
  ArrowRight,
  Building2,
  Cpu,
  Lock,
  FileText,
  Users,
  Clock,
  Star,
  ChevronDown,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: <Globe className="w-5 h-5 text-gold" />,
    title: 'EU-Adjacent Legal Environment',
    desc: 'Operate under Aletheian constitutional law — designed to mirror EU standards without full EU regulatory overhead.',
  },
  {
    icon: <Zap className="w-5 h-5 text-gold" />,
    title: '15-Minute Digital Incorporation',
    desc: 'No lawyers, no notaries, no paper. Your company charter is a sovereign NFT minted on StableChain.',
  },
  {
    icon: <Shield className="w-5 h-5 text-gold" />,
    title: 'Zero Personal Income Tax',
    desc: 'Aletheia funds its government through institutional revenue. Citizens and e-residents pay no personal income tax.',
  },
  {
    icon: <Lock className="w-5 h-5 text-gold" />,
    title: 'Cryptographic Identity',
    desc: 'Your e-resident identity is biometrically anchored to the National Identity Registry — unforgeble and portable.',
  },
  {
    icon: <Building2 className="w-5 h-5 text-gold" />,
    title: 'AEY Banking Access',
    desc: 'Open an AEY-denominated sovereign account. 100% reserve-backed, instant settlement, and provable on-ledger.',
  },
  {
    icon: <Cpu className="w-5 h-5 text-gold" />,
    title: 'Digital-First Public Services',
    desc: 'All government services — from business registration to dispute resolution — run on the StableChain portal.',
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Submit Your Application',
    desc: 'Complete the e-residency application form online. Upload identity documents and biometric data for verification.',
    time: '~20 minutes',
  },
  {
    step: '02',
    title: 'Background Verification',
    desc: 'Our automated system cross-checks identity and background against Interpol, EU, and international registries.',
    time: '3–5 business days',
  },
  {
    step: '03',
    title: 'Approval & Digital Identity Issuance',
    desc: 'Upon approval, your cryptographic identity credential is minted on StableChain and linked to the National Registry.',
    time: '1 business day',
  },
  {
    step: '04',
    title: 'Activate Your E-Residency Portal',
    desc: 'Access your dashboard. Register a company, open an account, file documents, and engage with civic services.',
    time: 'Immediate access',
  },
];

const FAQS = [
  {
    q: 'Is Aletheia E-Residency the same as citizenship?',
    a: 'No. E-Residency grants you digital access to Aletheia\'s administrative and business infrastructure. It does not confer citizenship, the right to physically reside in Aletheia, or an Aletheian passport. See the Citizenship section for naturalisation pathways.',
  },
  {
    q: 'What is the annual fee?',
    a: 'The e-residency fee is 500 AEY per year, payable in AEY or major fiat currencies. This covers all digital services, company filing tools, and StableChain portal access.',
  },
  {
    q: 'Can I open a bank account?',
    a: 'Yes. E-residents can open an AEY-denominated sovereign digital account through the Aletheia Digital Bank. Physical banking relationships with partner institutions will be available upon territorial establishment.',
  },
  {
    q: 'Is my data private?',
    a: 'Aletheia operates under a constitutional data sovereignty framework. Your personal data is stored on-chain in encrypted form. Only you and authorised judicial processes can decrypt personal records. The state cannot access your business data without a High Court order.',
  },
  {
    q: 'How does business tax work?',
    a: 'Aletheia levies a flat corporate fee schedule (not a percentage income tax) on registered entities. There is no personal income tax. Full tax schedule is published in the Public Finance Act.',
  },
];

export default function EResidencyPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="relative bg-navy text-parchment overflow-hidden pt-20 pb-28 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0">
          <Image
            src="/images/hero_maritime.jpg"
            alt="Aletheia E-Residency"
            fill
            className="object-cover opacity-15 mix-blend-luminosity"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-navy-deep via-navy/98 to-navy-subtle/90" />
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/60 rounded-[3px]">
                <StarOfTruth size={14} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">E-Residency Programme</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.07] text-parchment">
                The world&apos;s most sovereign digital residency.
              </h1>

              <p className="text-base sm:text-lg text-parchment/65 leading-relaxed font-light max-w-xl">
                Aletheia E-Residency gives global entrepreneurs, developers, and professionals access to a cryptographically sovereign digital state — with zero income tax, 15-minute company formation, and EU-adjacent legal standards.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link href="#apply" className="px-6 py-3 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors flex items-center gap-2 group">
                  Apply Now — 500 AEY/year
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="#how-it-works" className="px-6 py-3 border border-parchment/20 text-parchment font-semibold text-[12px] uppercase tracking-wider rounded-[3px] hover:border-parchment/40 hover:bg-parchment/5 transition-all">
                  How It Works
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-[11px] text-parchment/40">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-gold/60" />
                  <span>15-min company registration</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-gold/60" />
                  <span>Zero personal income tax</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-gold/60" />
                  <span>EU-adjacent legal framework</span>
                </div>
              </div>
            </div>

            {/* Application card */}
            <div className="lg:col-span-5">
              <div className="bg-navy-deep/90 border border-gold/25 rounded-[4px] p-6 space-y-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold">Annual E-Residency Permit</span>
                  <StatusBadge status="Operational" size="sm" />
                </div>
                <div className="border-t border-parchment/[0.07] pt-4 space-y-3">
                  <div className="text-3xl font-bold text-parchment">500 AEY <span className="text-[14px] text-parchment/40 font-normal">/ year</span></div>
                  <div className="space-y-2">
                    {[
                      'Digital identity credential (StableChain NFT)',
                      'Unlimited company registration access',
                      'AEY digital bank account eligibility',
                      'Full civic portal access',
                      'Priority support queue',
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-[12px] text-parchment/70">
                        <CheckCircle className="w-3.5 h-3.5 text-laurel shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <Link
                  href="#apply"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors"
                >
                  Begin Application <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <p className="text-[10px] text-parchment/30 text-center">Applications reviewed within 3–5 business days</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="py-20 lg:py-28 bg-parchment-light border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">Why Aletheia</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">
              Built for the sovereign individual.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => (
              <div
                key={i}
                className="bg-white border border-navy/[0.07] rounded-[4px] p-5 hover:shadow-[0_4px_24px_-4px_rgba(21,41,74,0.08)] hover:border-gold/20 transition-all"
              >
                <div className="w-9 h-9 bg-navy/[0.04] rounded-[3px] flex items-center justify-center mb-4">
                  {b.icon}
                </div>
                <h3 className="text-[14px] font-bold text-navy mb-2">{b.title}</h3>
                <p className="text-[12px] text-navy/60 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-parchment-canvas border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">The Process</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy">
              From application to active residency.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS_STEPS.map((s, i) => (
              <div key={s.step} className="relative">
                {i < PROCESS_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-[calc(100%_-_12px)] w-[calc(100%_-_24px)] h-px bg-gradient-to-r from-gold/30 to-transparent z-10" />
                )}
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-navy rounded-[4px] flex flex-col items-center justify-center border border-gold/20 relative">
                    <span className="text-[10px] text-gold/60 font-mono">{s.step}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-navy">{s.title}</h3>
                  <p className="text-[12px] text-navy/60 leading-relaxed">{s.desc}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gold font-semibold">
                    <Clock className="w-3 h-3" />
                    {s.time}
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
              <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">Common Questions</span>
              <h2 className="text-3xl font-bold tracking-tight text-navy leading-tight mb-4">
                Everything you need to know.
              </h2>
              <p className="text-[13px] text-navy/60 leading-relaxed">
                Have a specific question? Contact our E-Residency Secretariat via the official contact portal.
              </p>
              <Link href="/contact" className="inline-flex items-center gap-2 mt-4 text-[12px] font-bold text-navy hover:text-gold uppercase tracking-wider transition-colors">
                Contact E-Residency Office <ArrowRight className="w-3.5 h-3.5 text-gold" />
              </Link>
            </div>
            <div className="lg:col-span-8 space-y-2">
              {FAQS.map((faq, i) => (
                <div key={i} className="border border-navy/[0.08] rounded-[4px] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-navy/[0.02] transition-colors"
                  >
                    <span className="text-[13px] font-semibold text-navy pr-4">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gold shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-[12px] text-navy/65 leading-relaxed border-t border-navy/[0.06]">
                      <p className="pt-3">{faq.a}</p>
                    </div>
                  )}
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
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">
              Ready to join Aletheia?
            </h2>
            <p className="text-parchment/60 leading-relaxed">
              The E-Residency application takes approximately 20 minutes. Your identity is verified, your digital credential is minted on StableChain, and your civic portal access is activated within 5 business days.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/portal/apply"
                className="px-8 py-3.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors flex items-center gap-2 group"
              >
                Begin E-Residency Application
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="text-[11px] text-parchment/30">
              Application fee: 500 AEY / year · Reviewed within 3–5 business days · Cryptographic identity credential issued on approval
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
