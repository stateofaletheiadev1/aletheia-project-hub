'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Image from 'next/image';
import {
  Banknote,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Scale,
  Zap,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const PAYMENT_INSTRUMENTS = [
  {
    instrument: 'AEY Banknotes (Paper Series)',
    formFactor: 'Engraved Paper Notes: 1, 5, 10, 20 & 100 AEY',
    rail: 'Hand-to-Hand / Accredited Banks',
    velocity: 'Immediate Hand-to-Hand',
    fee: '0.00 AEY (Exchange 1:1 to Digital)',
    security: 'Latent images, microprint, guilloche and dual serials; convertible 1:1 to digital AEY',
  },
  {
    instrument: 'Citizen Biometric Card (e-Purse)',
    formFactor: 'Polycarbonate Contactless Card (EAL6+ Secure Element)',
    rail: 'Contactless NFC POS / Automated Kiosks',
    velocity: 'Final in About a Second',
    fee: '0.00 AEY (Free Domestic)',
    security: 'Dual-factor biometric match-on-card, air-gapped NFC cryptograms',
  },
  {
    instrument: 'Aletheia Sovereign Wallet',
    formFactor: 'Mobile & Desktop Sovereign App with Hardware Enclave',
    rail: 'StableChain Native Peer-to-Peer Routing',
    velocity: '500 ms Deterministic Slot',
    fee: '0.00 AEY (Citizen P2P)',
    security: 'Secure Enclave biometric unlock, multi-sig Covenant recovery, instant QR transfer',
  },
  {
    instrument: 'Enterprise Core Settlement (B2B)',
    formFactor: 'REST & JSON-RPC 2.0 Ledger Interfaces',
    rail: 'StableChain Smart Contract Clearing',
    velocity: 'Continuous Real-Time Batching',
    fee: 'Fixed Fee per Execution Unit',
    security: 'Multi-institutional HSM signers, programmable escrow, automated audit trails',
  },
  {
    instrument: 'Central Bank Interbank Gateway',
    formFactor: 'Sovereign RTGS & SEPA ISO 20022 Clearing Corridor',
    rail: 'Direct Central Bank Liquidity Bridge',
    velocity: 'Instant Parity Batch Settlement',
    fee: 'Zero Spread at Parity (1:1 EUR)',
    security: 'Daily Merkle reserve root verification, segregated Tier-1 European asset custody',
  },
];

export default function AeyCurrencyPage() {
  const { t, tx } = useI18n();
  const [convertAmount, setConvertAmount] = useState('1000');
  const [sourceCurrency, setSourceCurrency] = useState<'EUR' | 'USD' | 'GBP'>('EUR');

  const getExchangeRate = () => {
    if (sourceCurrency === 'EUR') return 1.0;
    if (sourceCurrency === 'USD') return 0.92;
    if (sourceCurrency === 'GBP') return 1.18;
    return 1.0;
  };

  const aeyResult = (parseFloat(convertAmount || '0') * getExchangeRate()).toFixed(2);

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden border-b border-gold/30" style={{ minHeight: '72vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <HeroBackdrop image="cardPayment" />
        {/* Ambient orbs */}
        <div className="orb-gold w-[520px] h-[520px] -top-32 -left-40 opacity-55 animate-orb-float-1" />
        <div className="orb-burgundy w-[380px] h-[380px] bottom-0 right-8 opacity-45 animate-orb-float-2" />

        {/* Hexagonal geometric watermark */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none flex items-center justify-end pr-12">
          <svg width="640" height="640" viewBox="0 0 100 100" fill="none">
            <polygon points="50,2 95,27 95,73 50,98 5,73 5,27" stroke="#C49A4E" strokeWidth="0.6" />
            <polygon points="50,12 85,32 85,68 50,88 15,68 15,32" stroke="#C49A4E" strokeWidth="0.4" />
            <polygon points="50,24 75,37 75,63 50,76 25,63 25,37" stroke="#C49A4E" strokeWidth="0.25" />
            <circle cx="50" cy="50" r="46" stroke="#C49A4E" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="5" stroke="#C49A4E" strokeWidth="0.6" />
            <line x1="50" y1="5" x2="50" y2="45" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="90" y1="28" x2="54.3" y2="52.5" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="90" y1="72" x2="54.3" y2="47.5" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="50" y1="95" x2="50" y2="55" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="10" y1="72" x2="45.7" y2="47.5" stroke="#C49A4E" strokeWidth="0.15" />
            <line x1="10" y1="28" x2="45.7" y2="52.5" stroke="#C49A4E" strokeWidth="0.15" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: headline */}
            <div className="lg:col-span-7 space-y-7 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Sovereign Unit of Account")}</span>
                </div>
                <StatusBadge status="Operational" size="sm" />
              </div>

              <h1 className="heading-hero">{t("The Aletheian")}<br />
                <span className="text-gold-metallic">{t("Guilder")}</span>{' '}{t("(AEY)")}</h1>

              <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light max-w-2xl">{t("The official constitutional currency of The Sovereign Covenant State of Aletheia. Pegged 1:1 to the Euro, backed by provable 100% segregated reserves, and issued in two forms: engraved AEY banknotes and digital AEY on the Aletheia StableChain.")}{' '}<strong className="text-parchment/90">{t("One reserve. Paper or digital. Exchangeable worldwide.")}</strong>
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/central-bank"
                  className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm"
                >
                  <span>{t("Reserve Proof Audit")}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/treasury"
                  className="btn-sovereign-ghost px-6 py-3.5 rounded-sm flex items-center gap-2 text-sm"
                >{t("Endowment Balance Sheet")}</Link>
              </div>
            </div>

            {/* Right: AEY live parity card */}
            <div className="lg:col-span-5 animate-fade-in-up delay-200">
              <div className="border-flow rounded-sm p-7 space-y-6 relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gold/6 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 text-center space-y-2">
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold/80">{t("AEY / EUR Official Parity")}</p>
                  <div className="metric-display">1.0000</div>
                  <p className="text-xs text-parchment/55 font-mono">{t("Audited daily by Tier-1 independent custody attestation")}</p>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Reserve Backing', value: '100%', mono: true },
                    { label: 'Block Finality', value: '≈ 1 s', mono: true },
                    { label: 'Legal Tender', value: 'Paper + Digital', mono: false },
                    { label: 'EUR Parity', value: 'Fixed 1:1', mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="stat-tile p-3 rounded-sm text-center space-y-1">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{tx(label)}</span>
                      <span className={`text-sm font-bold text-parchment ${mono ? 'font-mono' : ''}`}>{tx(value)}</span>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 pt-3 border-t border-parchment/10">
                  <p className="text-[10px] font-mono text-parchment/40 text-center tracking-wider [text-wrap:balance]">{t("CURRENCY & DIGITAL SETTLEMENT ACT 2026 · CONSTITUTIONAL ART. 14 § 3")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY MONETARY INVARIANTS ── */}
      <section className="bg-[#060C14] border-b border-gold/25 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-gold/15 gap-y-2">
            {[
              { value: '1.0000', label: 'AEY / EUR Parity', sublabel: 'Fixed · Constitutional Art. 14' },
              { value: '2', label: 'Forms of Legal Tender', sublabel: 'Banknotes & StableChain' },
              { value: '100%', label: 'Segregated Reserves', sublabel: 'Daily cryptographic proof' },
              { value: '≈ 1 s', label: 'Block Finality', sublabel: 'Two 500 ms slots, 2-chain BFT' },
            ].map(({ value, label, sublabel }) => (
              <div key={label} className="px-6 py-4 text-center first:pl-0 last:pr-0 space-y-0.5">
                <div className="text-2xl font-bold font-mono text-gold tracking-tight">{tx(value)}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-parchment/80">{tx(label)}</div>
                <div className="text-[10px] text-parchment/40 font-mono">{tx(sublabel)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DUAL LEGAL TENDER: PAPER & DIGITAL ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Paper & Digital Legal Tender")}</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Frictionless Digital Rails & Sovereign Cryptographic Velocity")}</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">{t("Inside the Republic the AEY circulates as engraved banknotes and as digital balances on the Aletheia StableChain: one unit, one reserve, interchangeable at par. Abroad, either form can be exchanged for EUR, GBP or USD.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          
          {/* Sovereign Biometric Smart Card */}
          <div className="bg-white border border-navy/15 rounded-sm p-8 space-y-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">{t("Contactless Citizen Rails")}</span>
                <h3 className="text-lg font-bold text-navy">{t("Sovereign Biometric Smart Cards")}</h3>
              </div>
            </div>

            <p className="text-xs text-navy/70 leading-relaxed">{t("Polycarbonate NFC citizen cards with EAL6+ secure element chips. Enables sub-300ms offline and online tap-to-pay across all retail merchants, civic transit, and automated municipal kiosks.")}</p>

            <div className="space-y-3 pt-2 border-t border-navy/10 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Interchangeable with Banknotes:")}</strong>{' '}{t("Card balances and AEY banknotes convert 1:1 at accredited banks and Central Bank redemption agents.")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Hardware-Enclave Security:")}</strong>{' '}{t("Match-on-card fingerprint verification and disposable cryptographic transaction tokens.")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Offline Mesh Resilience:")}</strong>{' '}{t("Cryptographically signed balance tokens allow emergency offline transactions during network interruptions.")}</span>
              </div>
            </div>
          </div>

          {/* Digital StableChain Rail Card */}
          <div className="bg-white border border-navy/15 rounded-sm p-8 space-y-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">{t("Cryptographic State Rail")}</span>
                <h3 className="text-lg font-bold text-navy">{t("Digital AEY (StableChain Native)")}</h3>
              </div>
            </div>

            <p className="text-xs text-navy/70 leading-relaxed">{t("Native unit of settlement on the Aletheia StableChain ledger. Payments are final in about a second, for e-residents, corporate entities and international suppliers worldwide.")}</p>

            <div className="space-y-3 pt-2 border-t border-navy/10 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Finality in About a Second:")}</strong>{' '}{t("Commercial transactions settle without intermediary clearing houses.")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("Zero-Cost Domestic Rails:")}</strong>{' '}{t("Citizen peer-to-peer transfer fees are covered by the State; business contracts pay a fixed fee per execution unit.")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>{t("SEPA / ISO 20022 Aligned:")}</strong>{' '}{t("Native compliance with European interbank payment formatting.")}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── NATIONAL PAYMENT INSTRUMENTS REGISTRY ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-gold uppercase tracking-wider">{t("Sovereign Settlement Taxonomy")}</span>
            <h3 className="text-2xl font-bold text-navy">{t("National Payment Instruments")}</h3>
            <p className="text-xs text-navy/70">{t("Pursuant to the Currency & Digital Settlement Act 2026, issued under the direct supervision of the Monetary Board.")}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-navy text-parchment font-mono uppercase tracking-wider text-[11px] border-b border-navy/20">
                  <th className="p-3">{t("Payment Instrument")}</th>
                  <th className="p-3">{t("Form Factor & Channel")}</th>
                  <th className="p-3">{t("Settlement Velocity")}</th>
                  <th className="p-3">{t("Statutory Fee")}</th>
                  <th className="p-3">{t("Security & Privacy Invariant")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {PAYMENT_INSTRUMENTS.map((inst) => (
                  <tr key={inst.instrument} className="hover:bg-parchment-light/60">
                    <td className="p-3 font-bold text-navy">{tx(inst.instrument)}</td>
                    <td className="p-3 text-navy/80">{tx(inst.formFactor)}</td>
                    <td className="p-3 text-gold font-mono font-medium">{tx(inst.velocity)}</td>
                    <td className="p-3 text-laurel font-mono font-semibold">{tx(inst.fee)}</td>
                    <td className="p-3 text-navy/70 text-[11px]">{tx(inst.security)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── INTERACTIVE PARITY CALCULATOR & REDEMPTION PORTAL ── */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("Public Parity Converter")}</span>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("Convert & Verify Parity Value")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Calculate the statutory purchasing value of international reserve currencies against AEY under the official Central Bank exchange reference rates.")}</p>

            <div className="p-6 bg-white border border-navy/15 rounded-sm shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Source Currency")}</label>
                  <select
                    value={sourceCurrency}
                    onChange={(e) => setSourceCurrency(e.target.value as typeof sourceCurrency)}
                    className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy bg-white"
                  >
                    <option value="EUR">{t("EUR — European Euro")}</option>
                    <option value="USD">{t("USD — US Dollar")}</option>
                    <option value="GBP">{t("GBP — British Pound")}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Source Amount")}</label>
                  <input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono"
                  />
                </div>
              </div>

              <div className="p-4 bg-navy-deep text-parchment rounded-sm border border-gold/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-gold block">{t("Aletheian Guilder Output")}</span>
                  <span className="text-2xl font-bold font-mono text-parchment">{tx(aeyResult)}{' '}{t("AEY")}</span>
                </div>
                <div className="text-right text-[11px] font-mono text-parchment/60">
                  <span>{t("Rate: 1")}{' '}{tx(sourceCurrency)} = {getExchangeRate()}{' '}{t("AEY")}</span>
                  <span className="block text-laurel font-bold">{t("100% Backed")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-navy text-parchment p-8 rounded-sm border border-gold/30 space-y-6">
            <div className="flex items-center gap-3">
              <Scale className="w-6 h-6 text-gold" />
              <h3 className="text-lg font-bold text-parchment">{t("The Unconditional Redemption Guarantee")}</h3>
            </div>

            <p className="text-xs text-parchment/75 leading-relaxed">{t("Article 14 § 3 of the Covenant provides:")}</p>

            <blockquote className="p-4 bg-navy-deep border-l-2 border-gold font-serif italic text-xs text-parchment/90 leading-relaxed">{t("“Any natural or legal person presenting lawful AEY to the Central Bank or its designated redemption agents is entitled to immediate settlement in European Euros or London Good Delivery Gold at statutory parity, without fee, haircut, or administrative obstruction.”")}</blockquote>

            <div className="flex items-center justify-between pt-2 text-[11px] font-mono text-gold">
              <span>{t("Auditor: Tier-1 Independent Custody Attestation")}</span>
              <span>{t("Reconciled Daily")}</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── AEY BANKNOTE SERIES ── */}
      <section className="bg-white border-y border-navy/10 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">{t("AEY Banknote Series")}</span>
              <StatusBadge status="Planned" size="sm" />
            </div>
            <h2 className="text-3xl font-bold text-navy tracking-tight">{t("The AEY Paper Series")}</h2>
            <p className="text-sm text-navy/70 leading-relaxed">{t("Not every nation or buyer wants crypto. The AEY is also issued on paper: five engraved denominations — 1, 5, 10, 20 and 100 AEY — backed by the same reserve as StableChain AEY. Spend notes or digital AEY inside the Republic, and exchange either for EUR, GBP or USD abroad.")}</p>
            <Link
              href="/aey/paper-currency"
              className="btn-sovereign-gold inline-flex px-7 py-3.5 rounded-sm items-center gap-2.5 group text-sm"
            >
              <Banknote className="w-4 h-4" />
              <span>{t("View the Paper Currency")}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <Link
            href="/aey/paper-currency"
            className="lg:col-span-7 group block bg-navy rounded-sm border border-gold/30 p-6 sm:p-10 relative overflow-hidden"
            aria-label={t("View the Paper Currency")}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
            <div className="relative mx-auto w-[88%] aspect-[1168/784]">
              {[20, 100].map((value, i) => (
                <div
                  key={value}
                  className="absolute inset-0 rounded-sm overflow-hidden border border-gold/30 shadow-2xl shadow-black/50 transition-transform duration-500"
                  style={{ transform: i === 0 ? 'translate(-5%, -6%) rotate(-4deg)' : 'translate(4%, 5%) rotate(2deg)' }}
                >
                  <Image
                    src={`/images/currency/aey-${value}-front.webp`}
                    alt={i === 1 ? t("100 AEY banknote, front") : ''}
                    width={1168}
                    height={784}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </Link>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">{t("Experience Sound Money by Covenant")}</h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">{t("Open an enterprise account or acquire digital AEY settlement balances through accredited e-residency.")}</p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/e-residency"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >{t("Apply for E-Residency")}</Link>
            <Link
              href="/central-bank"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("Central Bank Architecture")}</Link>
            <Link
              href="/aey/paper-currency"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >{t("AEY Paper Currency")}</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
