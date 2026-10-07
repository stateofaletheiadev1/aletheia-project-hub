'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  Shield,
  Anchor,
  Lock,
  Globe,
  Eye,
  Radio,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Cpu,
  Users,
  Zap,
} from 'lucide-react';

const DIRECTORATES = [
  {
    id: 'navy',
    code: 'ADSS-N',
    title: 'Navy & Coast Guard',
    subtitle: 'Maritime Sovereignty Division',
    icon: <Anchor className="w-6 h-6 text-gold" />,
    status: 'Planned' as const,
    href: '/adss#navy',
    mandate: 'Protects territorial waters, conducts search and rescue operations, enforces maritime exclusion zones, and maintains sector patrols around Aletheian sovereign platforms.',
    capabilities: [
      'Territorial water enforcement (12nm + 200nm EEZ)',
      'Search and rescue coordination',
      'Platform security and offshore installation protection',
      'Maritime boundary administration',
    ],
    commandBasis: 'Constitution Art. 22; Maritime Security Act',
  },
  {
    id: 'police',
    code: 'ADSS-P',
    title: 'Police Directorate',
    subtitle: 'Civil Law Enforcement',
    icon: <Shield className="w-6 h-6 text-gold" />,
    status: 'Planned' as const,
    href: '/adss#police',
    mandate: 'A constitutionally civilian law enforcement body with strict separation from military command. Accountable to the High Court and subject to independent oversight.',
    capabilities: [
      'Community policing and crime prevention',
      'Criminal investigations (civil jurisdiction only)',
      'Court order enforcement',
      'Independent civilian complaint authority',
    ],
    commandBasis: 'Constitution Art. 24; Civil Policing Act',
  },
  {
    id: 'immigration',
    code: 'ADSS-I',
    title: 'Immigration Directorate',
    subtitle: 'Border & Identity Administration',
    icon: <Globe className="w-6 h-6 text-gold" />,
    status: 'Under Development' as const,
    href: '/adss#immigration',
    mandate: 'Administers biometric border control, manages the Visa and Residency Registry, and coordinates with the National Identity Registry for passport issuance and revocation.',
    capabilities: [
      'Biometric border administration (land, sea, air)',
      'Visa issuance and revocation',
      'E-residency compliance monitoring',
      'International extradition coordination',
    ],
    commandBasis: 'Constitution Art. 25; Border Administration Act',
  },
  {
    id: 'cyber',
    code: 'ADSS-C',
    title: 'Cybersecurity Department',
    subtitle: 'Critical Infrastructure & Validator Protection',
    icon: <Lock className="w-6 h-6 text-gold" />,
    status: 'Operational' as const,
    href: '/adss/cybersecurity',
    mandate: 'Mandatory standalone agency mandated to protect StableChain validators, government infrastructure, and critical national networks from cyber threats. Operates a 24/7 CERT/CSIRT.',
    capabilities: [
      'StableChain validator cluster protection',
      '24/7 CERT/CSIRT operations center',
      'National Critical Infrastructure monitoring',
      'Penetration testing and red team operations',
    ],
    commandBasis: 'Constitution Art. 26; Cybersecurity Sovereignty Act',
  },
];

const OVERSIGHT_PRINCIPLES = [
  {
    icon: <Users className="w-4 h-4 text-gold" />,
    title: 'Civilian Constitutional Authority',
    desc: 'The Ministry of Security exercises full civilian oversight over ADSS. No military command exists — all directorates report to elected ministers, not generals.',
  },
  {
    icon: <Eye className="w-4 h-4 text-gold" />,
    id: 'intelligence',
    title: 'Intelligence Oversight Committee',
    desc: 'A Standing Parliamentary Committee reviews all intelligence activities. No signals collection without a High Court warrant. Strict surveillance statute.',
  },
  {
    icon: <AlertTriangle className="w-4 h-4 text-gold" />,
    title: 'Proportionality Doctrine',
    desc: 'Constitutional prohibition on force disproportionate to threat. Independent complaints authority with binding remedial powers.',
  },
  {
    icon: <Radio className="w-4 h-4 text-gold" />,
    id: 'emergency',
    title: 'Emergency Coordination Centre',
    desc: '24/7 National Emergency & Civil Protection Centre coordinates disaster response, maritime rescue, and critical infrastructure incidents.',
  },
];

export default function ADSSPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-20 pb-28 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0">
          <Image
            src="/images/cyber_defence.jpg"
            alt={t("Aletheian Defence and Security Service")}
            fill
            className="object-cover opacity-12 mix-blend-luminosity"
            priority
          />
        </div>
        {/* Ambient orbs */}
        <div className="orb-gold w-[460px] h-[460px] -top-24 -left-32 opacity-50 animate-orb-float-1" />
        <div className="orb-burgundy w-[340px] h-[340px] bottom-0 right-8 opacity-45 animate-orb-float-2" />

        {/* Crosshair watermark */}
        <div className="absolute inset-0 flex items-center justify-end pr-24 opacity-[0.04] pointer-events-none" aria-hidden>
          <svg width="400" height="400" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="180" stroke="#C49A4E" strokeWidth="1"/>
            <circle cx="200" cy="200" r="120" stroke="#C49A4E" strokeWidth="0.8"/>
            <circle cx="200" cy="200" r="60" stroke="#C49A4E" strokeWidth="0.6"/>
            <line x1="0" y1="200" x2="400" y2="200" stroke="#C49A4E" strokeWidth="0.5"/>
            <line x1="200" y1="0" x2="200" y2="400" stroke="#C49A4E" strokeWidth="0.5"/>
          </svg>
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/60 rounded-[3px]">
                <StarOfTruth size={14} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">{t("ADSS Directorate")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Aletheian Defence")}<br />
              <span className="text-gold-metallic">{t("& Security Service")}</span>
            </h1>

            <p className="text-base sm:text-lg text-parchment/65 leading-relaxed font-light max-w-2xl">{t("A unified, constitutionally civilian security apparatus covering naval sovereignty, civil law enforcement, border administration, and cybersecurity — with strict proportionality doctrine and independent oversight.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/adss/cybersecurity" className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm">{t("Cybersecurity Department")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/constitution#art-46" className="btn-sovereign-ghost px-6 py-3.5 rounded-sm flex items-center gap-2 text-sm">{t("Constitutional Mandate")}</Link>
            </div>
          </div>

          {/* Directive strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Directorates', value: '4', sub: 'Unified structure' },
              { label: 'Civilian Command', value: '100%', sub: 'No military chain' },
              { label: 'CERT/CSIRT', value: '24/7', sub: 'Cyber operations' },
              { label: 'Intelligence Warrant', value: 'Required', sub: 'High Court order' },
            ].map((m) => (
              <div key={m.label} className="bg-navy-deep/80 border border-gold/15 rounded-[4px] p-4">
                <span className="text-[10px] uppercase tracking-[0.16em] text-parchment/40 font-semibold block mb-1">{tx(m.label)}</span>
                <span className="text-2xl font-bold text-parchment">{tx(m.value)}</span>
                <span className="text-[10px] text-parchment/30 block mt-1">{tx(m.sub)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIRECTORATES ── */}
      <section className="py-20 lg:py-28 bg-parchment-light border-b border-navy/[0.08]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("Structure")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">{t("Four unified directorates, one constitutional mandate.")}</h2>
          </div>

          <div className="space-y-5">
            {DIRECTORATES.map((dir) => (
              <div
                key={dir.id}
                id={dir.id}
                className="bg-white border border-navy/[0.08] rounded-[4px] overflow-hidden hover:shadow-[0_4px_24px_-4px_rgba(21,41,74,0.08)] transition-all"
              >
                <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-navy/[0.06]">
                  {/* Identity */}
                  <div className="lg:col-span-3 p-5 bg-parchment-canvas/50 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-navy/[0.05] rounded-[3px] flex items-center justify-center">
                          {tx(dir.icon)}
                        </div>
                        <StatusBadge status={dir.status} size="sm" />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-gold/60 block mb-0.5">{tx(dir.code)}</span>
                        <h3 className="text-[15px] font-bold text-navy leading-tight">{tx(dir.title)}</h3>
                        <p className="text-[11px] text-navy/50 mt-0.5">{tx(dir.subtitle)}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] text-navy/35 font-mono block">{tx(dir.commandBasis)}</span>
                    </div>
                  </div>

                  {/* Mandate */}
                  <div className="lg:col-span-5 p-5">
                    <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-navy/30 block mb-2">{t("Mandate")}</span>
                    <p className="text-[13px] text-navy/70 leading-relaxed">{tx(dir.mandate)}</p>
                  </div>

                  {/* Capabilities */}
                  <div className="lg:col-span-4 p-5">
                    <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-navy/30 block mb-2">{t("Key Capabilities")}</span>
                    <ul className="space-y-1.5">
                      {dir.capabilities.map((cap) => (
                        <li key={cap} className="flex items-start gap-2 text-[12px] text-navy/65">
                          <CheckCircle className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                          {tx(cap)}
                        </li>
                      ))}
                    </ul>
                    <Link href={dir.href} className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-bold text-navy hover:text-gold transition-colors uppercase tracking-wider">{t("View Directorate")}{' '}<ArrowRight className="w-3 h-3 text-gold" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OVERSIGHT ── */}
      <section className="py-20 lg:py-28 bg-navy text-parchment border-b border-gold/15">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold block mb-2">{t("Constitutional Accountability")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment leading-tight">{t("Civilian oversight is not optional — it is constitutional law.")}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {OVERSIGHT_PRINCIPLES.map((p, i) => (
              <div
                key={i}
                id={'id' in p ? p.id : undefined}
                className="p-5 bg-navy-deep/60 border border-parchment/[0.06] rounded-[4px] hover:border-gold/20 transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 bg-parchment/[0.05] rounded-[3px] flex items-center justify-center">
                    {tx(p.icon)}
                  </div>
                  <h3 className="text-[14px] font-bold text-parchment">{tx(p.title)}</h3>
                </div>
                <p className="text-[12px] text-parchment/55 leading-relaxed">{tx(p.desc)}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 p-5 bg-navy-deep/80 border border-gold/20 rounded-[4px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold block">{t("Cybersecurity Department — Operational")}</span>
              <p className="text-[12px] text-parchment/55">{t("The ADSS Cybersecurity Department is the only currently operational directorate. A 24/7 CERT/CSIRT protects StableChain validators and national digital infrastructure.")}</p>
            </div>
            <Link
              href="/adss/cybersecurity"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-navy font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-gold-tint transition-colors"
            >{t("View Cybersecurity Dept")}{' '}<ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CYBERSECURITY SPOTLIGHT ── */}
      <section className="py-20 lg:py-28 bg-parchment-canvas">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Image
                src="/images/cyber_defence.jpg"
                alt={t("Aletheian Cybersecurity Operations")}
                width={640}
                height={440}
                className="w-full object-cover rounded-[4px]"
              />
            </div>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold">{t("ADSS-C Spotlight")}</span>
                <StatusBadge status="Operational" size="sm" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-navy leading-tight">{t("Cybersecurity Department: protecting the sovereign ledger.")}</h2>
              <p className="text-navy/65 leading-relaxed">{t("As a digital-first state, Aletheia's most critical national asset is its StableChain validator infrastructure. The Cybersecurity Department operates as a mandatory standalone agency — completely independent from other government ministries — to eliminate political interference in technical security decisions.")}</p>
              <div className="space-y-2">
                {[
                  { icon: <Cpu className="w-3.5 h-3.5 text-gold" />, label: 'StableChain Validator Protection' },
                  { icon: <Zap className="w-3.5 h-3.5 text-gold" />, label: '24/7 CERT/CSIRT Operations Center' },
                  { icon: <Lock className="w-3.5 h-3.5 text-gold" />, label: 'Zero-Day Disclosure Programme' },
                  { icon: <Eye className="w-3.5 h-3.5 text-gold" />, label: 'National Infrastructure Threat Intelligence' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[13px] text-navy/75">
                    <div className="w-6 h-6 bg-navy/[0.04] rounded-[2px] flex items-center justify-center shrink-0">
                      {tx(item.icon)}
                    </div>
                    {tx(item.label)}
                  </div>
                ))}
              </div>
              <Link href="/adss/cybersecurity" className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-parchment font-bold text-[12px] uppercase tracking-wider rounded-[3px] hover:bg-navy-deep border border-gold/20 transition-all group">{t("Cybersecurity Department")}{' '}<ArrowRight className="w-3.5 h-3.5 text-gold group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
