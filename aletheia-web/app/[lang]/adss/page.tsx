'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarOfTruth } from '@/components/brand/Logo';
import type { AssetKey, ManualStatus } from '@/lib/status';
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

const DIRECTORATES: { id: string; code: string; title: string; subtitle: string; icon: React.ReactNode; asset?: AssetKey; status?: ManualStatus; href: string; mandate: string; capabilities: string[]; commandBasis: string }[] = [
  {
    id: 'navy',
    code: 'ADSS-R',
    title: 'Coastguard & Rescue',
    subtitle: 'Search, Rescue & Coastal Safety',
    icon: <Anchor className="w-6 h-6 text-gold" />,
    status: 'Planned',
    href: '/adss#navy',
    mandate: 'Would conduct search and rescue and keep the waters around Aletheia’s platforms safe, in cooperation with neighbouring coastguards.',
    capabilities: [
      'Search and rescue coordination',
      'Coastal and harbour safety',
      'Protection of offshore installations',
      'Cooperation with neighbouring coastguards',
    ],
    commandBasis: 'Draft Constitution Art. 188; proposed Maritime Safety Act',
  },
  {
    id: 'police',
    code: 'ADSS-P',
    title: 'Police Directorate',
    subtitle: 'Civil Law Enforcement',
    icon: <Shield className="w-6 h-6 text-gold" />,
    asset: 'police',
    href: '/adss#police',
    mandate: 'A proposed civilian police service, separate from every other service, accountable to the High Court and subject to independent oversight.',
    capabilities: [
      'Community policing and crime prevention',
      'Criminal investigations (civil jurisdiction only)',
      'Court order enforcement',
      'Independent civilian complaint authority',
    ],
    commandBasis: 'Draft Constitution Art. 189; proposed Civil Policing Act',
  },
  {
    id: 'immigration',
    code: 'ADSS-I',
    title: 'Immigration Directorate',
    subtitle: 'Border & Residence Administration',
    icon: <Globe className="w-6 h-6 text-gold" />,
    asset: 'immigration',
    href: '/adss#immigration',
    mandate: 'Would administer border checks and residence permits on Aletheia’s platforms. It issues nothing today.',
    capabilities: [
      'Border administration',
      'Visa and residence permits',
      'E-residency compliance',
      'Cooperation with neighbouring states',
    ],
    commandBasis: 'Draft Constitution Art. 181, 188; proposed Border Administration Act',
  },
  {
    id: 'cyber',
    code: 'ADSS-C',
    title: 'Cybersecurity Department',
    subtitle: 'Digital Infrastructure & Validator Protection',
    icon: <Lock className="w-6 h-6 text-gold" />,
    asset: 'cyber',
    href: '/adss/cybersecurity',
    mandate: 'A planned standalone department to protect StableChain validators, government systems and critical networks from cyber threats.',
    capabilities: [
      'Validator protection',
      'A computer emergency response team',
      'Infrastructure monitoring',
      'Coordinated vulnerability disclosure',
    ],
    commandBasis: 'Draft Constitution Art. 196; proposed Cyber Resilience Act',
  },
];

const OVERSIGHT_PRINCIPLES = [
  {
    icon: <Users className="w-4 h-4 text-gold" />,
    title: 'Civilian Constitutional Authority',
    desc: 'A civilian minister would oversee every service. All directorates would report to elected ministers.',
  },
  {
    icon: <Eye className="w-4 h-4 text-gold" />,
    id: 'intelligence',
    title: 'Independent Oversight',
    desc: 'A standing parliamentary committee would review every security function. No surveillance without a High Court warrant.',
  },
  {
    icon: <AlertTriangle className="w-4 h-4 text-gold" />,
    title: 'Proportionality Doctrine',
    desc: 'A proposed constitutional ban on disproportionate force, with an independent complaints authority.',
  },
  {
    icon: <Radio className="w-4 h-4 text-gold" />,
    id: 'emergency',
    title: 'Emergency Coordination',
    desc: 'A planned centre to coordinate disaster response and rescue. Aletheia runs no emergency service today.',
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
            alt=""
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
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">{t("Resilience & Civil Protection")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Resilience &")}<br />
              <span className="text-gold-metallic">{t("Civil Protection")}</span>
            </h1>

            <p className="text-base sm:text-lg text-parchment/65 leading-relaxed font-light max-w-2xl">{t("Planned civil-protection and resilience functions under civilian command: rescue, civilian policing, border administration and cybersecurity, with independent oversight. None operates today.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/adss/cybersecurity" className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm">{t("Cybersecurity Department")}{' '}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/constitution#article-188" className="btn-sovereign-ghost px-6 py-3.5 rounded-sm flex items-center gap-2 text-sm">{t("Draft Constitutional Mandate")}</Link>
            </div>
          </div>

          {/* Directive strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Planned Functions', value: '4', sub: 'Under one civilian minister' },
              { label: 'Civilian Command', value: '100%', sub: 'By design' },
              { label: 'Operating Today', value: 'None', sub: 'Before statehood' },
              { label: 'Surveillance Warrant', value: 'Required', sub: 'High Court order, as proposed' },
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
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">{t("Four planned functions, one civilian mandate.")}</h2>
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
                        {dir.asset ? <StatusBadge asset={dir.asset} size="sm" /> : dir.status ? <StatusBadge status={dir.status} size="sm" /> : null}
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
                    <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-navy/30 block mb-2">{t("Planned Capabilities")}</span>
                    <ul className="space-y-1.5">
                      {dir.capabilities.map((cap) => (
                        <li key={cap} className="flex items-start gap-2 text-[12px] text-navy/65">
                          <CheckCircle className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                          {tx(cap)}
                        </li>
                      ))}
                    </ul>
                    <Link href={dir.href} className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-bold text-navy hover:text-gold transition-colors uppercase tracking-wider">{t("Learn More")}{' '}<ArrowRight className="w-3 h-3 text-gold" />
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
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment leading-tight">{t("Civilian oversight, written into the draft Constitution.")}</h2>
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
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold block">{t("Cybersecurity Department — Planned")}</span>
              <p className="text-[12px] text-parchment/55">{t("The Cybersecurity Department is planned, to protect Aletheia’s digital infrastructure. Security reports about this website are welcome now.")}</p>
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
            <div className="relative">
              <Image
                src="/images/cyber_defence.jpg"
                alt={t("A security operations room")}
                width={640}
                height={440}
                className="w-full object-cover rounded-[4px]"
              />
            </div>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold">{t("Cybersecurity Spotlight")}</span>
                <StatusBadge asset="cyber" size="sm" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-navy leading-tight">{t("Cybersecurity Department: protecting the ledger.")}</h2>
              <p className="text-navy/65 leading-relaxed">{t("For a digital-first state, the StableChain validators would be critical national infrastructure. The planned Cybersecurity Department would be a standalone agency, independent of the ministries, to keep politics out of technical security decisions.")}</p>
              <div className="space-y-2">
                {[
                  { icon: <Cpu className="w-3.5 h-3.5 text-gold" />, label: 'StableChain Validator Protection' },
                  { icon: <Zap className="w-3.5 h-3.5 text-gold" />, label: 'Computer Emergency Response Team (planned)' },
                  { icon: <Lock className="w-3.5 h-3.5 text-gold" />, label: 'Coordinated Vulnerability Disclosure' },
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
