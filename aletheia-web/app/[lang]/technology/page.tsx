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
    subtitle: 'Decentralized PKI & Biometric Roots',
    status: 'Operational' as const,
    desc: 'Issues W3C-compliant Verifiable Credentials, manages ICAO Doc 9303 CSCA cryptographic keys, and enforces zero-knowledge authentication for citizens and e-residents.',
    specs: ['BSI TR-03110 EAC v2 Compliant', 'Zero-Knowledge Proof (ZKP) Age Verification', 'FIPS 140-3 Level 4 HSM Key Custody', 'GDPR Article 25 Privacy by Design'],
  },
  {
    id: 'companies',
    title: 'Commercial & Corporate State Registry',
    subtitle: 'Algorithmic Incorporation & Legal Entity Inscription',
    status: 'Operational' as const,
    desc: 'Enables 15-minute programmatic company registration, digital corporate seal generation, automated beneficial ownership verification, and real-time EU VAT validation.',
    specs: ['Automated 15-Minute Incorporation', 'English Common Law Commercial Code', 'Real-Time Legal Entity Identifier (LEI)', 'Cryptographic Digital Seals'],
  },
  {
    id: 'maritime',
    title: 'Autonomous Maritime & Vessel Registry',
    subtitle: 'Digital Ship Flagging & IMO Certification',
    status: 'Under Development' as const,
    desc: 'Paperless international flagging for merchant container fleets, exploratory oceanographic vessels, and private yachts, integrated with automated port state control.',
    specs: ['IMO & UNCLOS Compliant Electronic Flagging', 'Automated Safety Inspection Tracking', 'Crew Biometric Credential Verification', 'Zero Flagging Bureaucracy'],
  },
  {
    id: 'spatial',
    title: 'Cadastral & Spatial Concessions Registry',
    subtitle: 'Immutable Land Titles & Deepwater Concessions',
    status: 'Under Development' as const,
    desc: 'Timestamped geospatial title deeds for Antioch urban parcels, St. Brendan port terminal leases, and offshore pelagic energy platforms.',
    specs: ['GIS Coordinates Anchored on StableChain', 'Smart Contract Lease Yield Distribution', 'Instant Secondary Market Title Transfers', 'Zero Title Insurance Friction'],
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
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Ministry of Digital State")}</span>
              </div>
              <StatusBadge status="Under Development" size="sm" />
            </div>

            <h1 className="heading-hero">{t("Digital State & National Registries")}</h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">{t("A paperless state engineered without physical bureaucracy. Every law, corporate charter, sovereign identity, and civil title is cryptographically signed, timestamped, and verified on the Aletheia StableChain.")}</p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/stablechain"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >{t("StableChain Protocol Specs")}{' '}<ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/e-residency"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >{t("Apply for Digital ID")}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATE REGISTRIES BREAKDOWN ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Core Public Registers")}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("The Four Sovereign State Registries")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Statutorily governed by the National Digital Administration Act 2026, eliminating arbitrary ministerial discretion through deterministic cryptographic execution.")}</p>
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
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Statutory Protocol Invariants:")}</span>
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
                <span className="text-navy/50 font-mono text-[11px]">{t("System Status: Replicated across 5 States")}</span>
                <Link
                  href={reg.id === 'companies' ? '/business' : reg.id === 'identity' ? '/passport' : '#'}
                  className="text-navy font-bold hover:text-gold flex items-center gap-1 transition-colors"
                >{t("Portal Access")}{' '}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── PUBLIC REGISTRY VERIFICATION SANDBOX ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Public Verification")}</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">{t("Query the Immutable State Registry")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Once the State Registry publishes, any state decree, business incorporation licence, land title hash or notary signature can be checked here against the ledger.")}</p>

            <form onSubmit={handleQuery} className="p-6 bg-white border border-navy/15 rounded-sm shadow-sm space-y-4">
              <label htmlFor="reg-query" className="text-xs font-bold text-navy uppercase tracking-wider block">{t("Enter Entity Number, Decree Hash, or Deed ID:")}</label>
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
                  <div className="text-[11px] text-navy/70">{t("The State Registry has not published any records on the ledger yet. Records will be verifiable here once StableChain mainnet is running.")}</div>
                </div>
              ))}
            </form>
          </div>

          <div className="lg:col-span-6 bg-navy text-parchment p-8 rounded-sm border border-gold/30 space-y-6">
            <div className="flex items-center gap-3">
              <div className="icon-sovereign"><KeyRound className="w-5 h-5 text-gold" /></div>
              <h3 className="text-lg font-bold text-parchment">{t("Zero-Knowledge Civil Privacy (ZKP)")}</h3>
            </div>
            <p className="text-xs text-parchment/75 leading-relaxed">{t("Aletheia employs advanced zero-knowledge cryptographic proofs. Citizens and e-residents can prove they are of legal age, hold a valid passport, or possess sufficient capital without revealing their name, exact birthdate, or bank balance to third-party verifiers.")}</p>
            <div className="p-4 bg-navy-deep rounded-sm border border-navy/40 font-mono text-xs text-gold space-y-1">
              <div>{t("Proof Primitive: Groth16 / Plonk zk-SNARKs")}</div>
              <div>{t("Verification Overhead: < 15 milliseconds")}</div>
              <div>{t("Data Minimization: 100% GDPR Article 25 Compliant")}</div>
            </div>
          </div>
        </div>

      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Join the World's Most Advanced Digital State")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Acquire your cryptographic digital identity and begin incorporating, banking, and executing contracts in minutes.")}</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/e-residency"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Apply for E-Residency")}</Link>
            <Link
              href="/business"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Incorporate an Enterprise")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
