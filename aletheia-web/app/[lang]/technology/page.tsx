'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  KeyRound,
  ArrowRight,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const REGISTRIES = [
  {
    id: 'identity',
    title: 'National Identity & Civil Status Registry',
    subtitle: 'Public-Key Identity, by Design',
    status: 'Planned' as const,
    desc: 'Would issue W3C Verifiable Credentials and use zero-knowledge authentication for citizens and residents. It holds no records today.',
    specs: ['W3C Verifiable Credentials', 'Zero-knowledge age checks', 'Hardware-held signing keys', 'Privacy by design (GDPR Art. 25)'],
  },
  {
    id: 'companies',
    title: 'Commercial & Corporate State Registry',
    subtitle: 'Digital Incorporation, by Design',
    status: 'Planned' as const,
    desc: 'Would allow online company registration with digital seals and beneficial-ownership checks. No company is registered today.',
    specs: ['Online incorporation', 'English-law commercial principles', 'Beneficial-ownership register', 'Cryptographic digital seals'],
  },
  {
    id: 'maritime',
    title: 'Maritime & Vessel Registry',
    subtitle: 'Only After Statehood',
    status: 'Planned' as const,
    desc: 'A ship registry would be possible only if Aletheia gained the lawful authority to keep one. Aletheia registers no vessels.',
    specs: ['Under international maritime law', 'Safety inspection records', 'Crew credential checks', 'Paperless records'],
  },
  {
    id: 'spatial',
    title: 'Cadastral & Spatial Concessions Registry',
    subtitle: 'Immutable Land Titles & Deepwater Concessions',
    status: 'Planned' as const,
    desc: 'Would record title deeds and leases on Aletheia’s platforms.',
    specs: ['Coordinates anchored on AletheiaChain', 'Lease records on the ledger', 'Fast title transfers', 'Lower title-insurance costs'],
  },
];

export default function TechnologyPage() {
  const { t, tx } = useI18n();
  const [queryInput, setQueryInput] = useState('');
  const [queryResult, setQueryResult] = useState<'idle' | 'searching' | 'none'>('idle');

  // The State Registry has published nothing on the ledger yet, so every lookup truthfully
  // finds nothing. Replace with a call to the registry when it publishes.
  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    setQueryResult('none');
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <HeroBackdrop image="earthNight" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Digital State · Proposed")}</span>
              </div>
              <StatusBadge asset="stablechain" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Digital State & National Registries")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("A paperless state, by design: every law, company charter, identity and title would be signed, timestamped and verifiable on the AletheiaChain, now on Mainnet Beta. The registries hold no records today.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/aletheiachain"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("AletheiaChain Protocol Specs")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/founding-members"

                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("Register interest as a Founding Member")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATE REGISTRIES BREAKDOWN ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Core Public Registers")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Four Proposed Registries")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Proposed in a draft National Digital Administration Act, to remove arbitrary discretion through deterministic rules.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {REGISTRIES.map((reg) => (
            <div
              key={reg.id}
              className="bg-white border border-navy/15 rounded-sm p-8 space-y-6 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">
                      {tx(reg.subtitle)}
                    </span>
                    <h3 className="text-xl font-bold text-navy">{tx(reg.title)}</h3>
                  </div>
                  <StatusBadge status={reg.status} size="sm" />
                </div>

                <p className="text-xs text-navy/70 leading-relaxed">{tx(reg.desc)}</p>

                <div className="pt-3 border-t border-navy/10 space-y-2">
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Design Features:")}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-navy/70">
                    {reg.specs.map((spec, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0" />
                        <span>{tx(spec)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-navy/10 flex items-center justify-between text-xs">
                <span className="text-navy/50 font-mono text-[11px]">{t("Status: proposed · no records")}</span>
                <Link
                  href={reg.id === 'companies' ? '/business' : reg.id === 'identity' ? '/design/travel-document' : '/development#seastead'}
                  className="text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
                >{t("Learn More")}{' '}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── PUBLIC REGISTRY VERIFICATION SANDBOX ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Public Verification")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Check a Registry Record")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Once a registry exists, any founding document, company registration, land title hash or notary signature could be checked here against the ledger.")}</p>

            <form onSubmit={handleQuery} className="p-6 bg-white border border-navy/15 rounded-sm shadow-sm space-y-4">
              <label htmlFor="reg-query" className="text-xs font-bold text-navy uppercase tracking-wider block">{t("Enter a Record Number or Hash:")}</label>
              <div className="flex gap-2">
                <input
                  id="reg-query"
                  type="text"
                  placeholder={t("e.g. SARL-2026-0819 or alt:T…")}
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className="flex-1 px-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono"
                />
                <button
                  type="submit"
                  disabled={queryResult === 'searching'}
                  className="px-5 py-2 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  {tx(queryResult === 'searching' ? 'Verifying...' : 'Query')}
                </button>
              </div>

              {tx(queryResult === 'none' && (
                <div className="p-4 bg-navy/5 border border-navy/20 rounded-sm space-y-2 text-xs text-navy">
                  <div className="font-bold">{t("No record found")}</div>
                  <div className="text-[11px] text-navy/70">{t("The State Registry has not published any records on the ledger yet. Records will be verifiable here once AletheiaChain mainnet is running.")}</div>
                </div>
              ))}
            </form>
          </div>

          <div className="lg:col-span-6 bg-navy text-parchment p-8 rounded-sm border border-gold/30 space-y-6">
            <div className="flex items-center gap-3">
              <div className="icon-sovereign"><KeyRound className="w-5 h-5 text-gold" /></div>
              <h3 className="text-lg font-bold text-parchment">{t("Zero-Knowledge Civil Privacy (ZKP)")}</h3>
            </div>
            <p className="text-xs text-parchment/75 leading-relaxed">{t("By design, zero-knowledge proofs would let citizens and residents prove that they are of age, or hold a valid document, without revealing their name, date of birth or other details to the verifier.")}</p>
            <div className="p-4 bg-navy-deep rounded-sm border border-navy/40 font-mono text-xs text-gold space-y-1">
              <div>{t("Proof Primitive: Groth16 / Plonk zk-SNARKs")}</div>
              <div>{t("Verification Overhead: < 15 milliseconds")}</div>
              <div>{t("Data minimisation: designed to GDPR Article 25")}</div>
            </div>
          </div>
        </div>

      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("A Digital State, Built in the Open")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Follow the founding of Aletheia's digital institutions. Nothing is offered or sold.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/founding-members"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Register interest as a Founding Member")}</Link>
            <Link
              href="/business"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Business Platform (proposed)")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
