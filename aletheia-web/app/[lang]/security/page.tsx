'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShieldAlert, ArrowRight, CheckCircle2, Siren } from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import type { AssetKey, ManualStatus } from '@/lib/status';

const DIRECTORATES: { id: string; title: string; tag: string; asset?: AssetKey; status?: ManualStatus; mandate: string; assets: string[] }[] = [
  {
    id: 'maritime',
    title: 'Coastguard & Rescue',
    tag: 'Search, Rescue & Coastal Safety',
    status: 'Planned',
    mandate: 'Would provide search and rescue and coastal safety in the waters around Aletheia’s platforms, in cooperation with neighbouring coastguards.',
    assets: ['Rescue vessels', 'Air-sea rescue helicopters', 'Coastal radar', 'Cooperation with neighbouring states'],
  },
  {
    id: 'police',
    title: 'Civilian Police Directorate',
    tag: 'Lawful Order & Community Safety',
    asset: 'police',
    mandate: 'Would be dedicated to civilian crime prevention, transparent investigation and community policing, separate from every other service, with body cameras and judicial oversight.',
    assets: ['Community bureaus', 'Cyber-crime unit', 'Independent ombudsman oversight', 'No militarisation'],
  },
  {
    id: 'emergency',
    title: 'Civil Protection & Disaster Response',
    tag: 'Resilience & Emergency Response',
    status: 'Planned',
    mandate: 'Would protect residents against storm surges, structural failures, fires and medical emergencies.',
    assets: ['Flood barrier teams', 'Firefighting vessels', 'Aeromedical evacuation', 'Public warning system'],
  },
  {
    id: 'cyber',
    title: 'Cybersecurity Department',
    tag: 'Digital Infrastructure',
    asset: 'cyber',
    mandate: 'Would protect the AletheiaChain validators, identity registries, power grids and telecommunications from cyber attack.',
    assets: ['Computer emergency response team', 'Hardware-held keys', 'Threat intelligence', 'Zero-trust architecture'],
  },
];

export default function SecurityPage() {
  const { t, tx } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="dataMesh" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Proposed Ministry")}</span>
              </div>
              <StatusBadge status="Planned" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Resilience & Civil Protection")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("Planned civil-protection and resilience functions under civilian command: rescue, policing, emergency response and the protection of digital infrastructure. None exists yet, and none will operate before statehood.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/adss"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("Resilience Overview")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/adss/cybersecurity"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("Cybersecurity Department")}</Link>
            </div>

            <div className="p-4 bg-navy-deep/80 border border-gold/25 rounded-sm flex items-start gap-3 max-w-2xl text-xs">
              <ShieldAlert className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div>
                <strong className="text-parchment block">{t("Civilian Supremacy, by Design")}</strong>
                <span className="text-parchment/70">{t("Under the draft Covenant, every security service would answer to civilian courts and parliamentary committees.")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DIRECTORATES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Proposed Structure")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Four Planned Functions")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Each would answer to a civilian minister, with policing kept fully separate from every other service.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {DIRECTORATES.map((dir) => (
            <div key={dir.id} className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-bold text-gold uppercase tracking-wider block">{tx(dir.tag)}</span>
                  {dir.asset ? <StatusBadge asset={dir.asset} size="sm" /> : dir.status ? <StatusBadge status={dir.status} size="sm" /> : null}
                </div>
                <h3 className="text-xl font-bold text-navy">{tx(dir.title)}</h3>
                <p className="text-xs text-navy/70 leading-relaxed">{tx(dir.mandate)}</p>
                <div className="pt-3 border-t border-navy/10 space-y-2">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Planned Capabilities:")}</span>
                  <div className="grid grid-cols-2 gap-2 text-xs text-navy/70">
                    {dir.assets.map((a) => (
                      <div key={a} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0" />
                        <span>{tx(a)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-navy/10 flex items-center justify-end text-xs">
                <Link href={dir.id === 'cyber' ? '/adss/cybersecurity' : '/adss'} className="text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors">
                  {t("Learn More")}{' '}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── NO EMERGENCY SERVICE ── */}
        <div className="mt-16 bg-white border border-burgundy/25 rounded-sm p-8 shadow-sm space-y-3">
          <span className="text-xs font-bold text-burgundy uppercase tracking-wider flex items-center gap-1.5">
            <Siren className="w-4 h-4" />{' '}{t("In an Emergency")}</span>
          <h3 className="text-2xl font-bold text-navy">{t("Aletheia runs no emergency or rescue service")}</h3>
          <p className="text-sm text-navy/70 leading-relaxed">{t("In an emergency, contact the local emergency services where you are. At sea, use VHF channel 16 or the maritime distress system to reach the coastguard responsible for those waters.")}</p>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Security Under Civilian Law")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Read the limits the draft Covenant would place on every security service.")}</p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link href="/adss" className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all">{t("Resilience Overview")}</Link>
            <Link href="/constitution#article-188" className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors">{t("Draft Constitution, Article 188")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
