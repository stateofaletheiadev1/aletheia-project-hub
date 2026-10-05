'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  CreditCard,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Lock,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Landmark,
  Scale,
  Zap,
  FileCheck2,
  HelpCircle,
  QrCode,
  Layers,
  Cpu,
} from 'lucide-react';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';

const DIGITAL_PAYMENT_INSTRUMENTS = [
  {
    instrument: 'Citizen Biometric Card (e-Purse)',
    formFactor: 'Polycarbonate Contactless Card (EAL6+ Secure Element)',
    rail: 'Contactless NFC POS / Automated Kiosks',
    velocity: '< 300 ms Tap Finality',
    fee: '0.00 AEY (Free Domestic)',
    security: 'Dual-factor biometric match-on-card, air-gapped NFC cryptograms, zero paper risk',
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
    formFactor: 'High-Throughput REST & gRPC Ledger APIs',
    rail: 'StableChain Smart Contract Clearing',
    velocity: 'Continuous Real-Time Batching',
    fee: '0.0001 AEY Fixed Statutory Gas',
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
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Sovereign Unit of Account</span>
                </div>
                <StatusBadge status="Operational" size="sm" />
              </div>

              <h1 className="heading-hero">
                The Aletheian
                <br />
                <span className="text-gold-metallic">Guilder</span>{' '}(AEY)
              </h1>

              <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light max-w-2xl">
                The official constitutional digital currency of The Sovereign Covenant State of Aletheia.
                Pegged 1:1 to the Euro, backed by provable 100% segregated reserves, and settled
                exclusively on the Aletheia StableChain. <strong className="text-parchment/90">Zero paper currency. Zero counterfeiting risk.</strong>
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/central-bank"
                  className="btn-sovereign-gold px-7 py-3.5 rounded-sm flex items-center gap-2.5 group text-sm"
                >
                  <span>Reserve Proof Audit</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/treasury"
                  className="btn-sovereign-ghost px-6 py-3.5 rounded-sm flex items-center gap-2 text-sm"
                >
                  Endowment Balance Sheet
                </Link>
              </div>
            </div>

            {/* Right: AEY live parity card */}
            <div className="lg:col-span-5 animate-fade-in-up delay-200">
              <div className="border-flow rounded-sm p-7 space-y-6 relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gold/6 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 text-center space-y-2">
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold/80">AEY / EUR Official Parity</p>
                  <div className="metric-display">1.0000</div>
                  <p className="text-xs text-parchment/55 font-mono">Audited daily by Tier-1 independent custody attestation</p>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Reserve Backing', value: '100%', mono: true },
                    { label: 'Block Finality', value: '500ms', mono: true },
                    { label: 'Cashless Economy', value: '100%', mono: false },
                    { label: 'EUR Parity', value: 'Fixed 1:1', mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="stat-tile p-3 rounded-sm text-center space-y-1">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gold/70 block">{label}</span>
                      <span className={`text-sm font-bold text-parchment ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 pt-3 border-t border-parchment/10">
                  <p className="text-[10px] font-mono text-parchment/40 text-center tracking-wider">
                    CASHLESS REPUBLIC ACT 2026 · CONSTITUTIONAL ART. 14 § 3
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY MONETARY INVARIANTS ── */}
      <section className="bg-[#060C14] border-b border-gold/25 text-parchment py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gold/15">
            {[
              { value: '1.0000', label: 'AEY / EUR Parity', sublabel: 'Fixed · Constitutional Art. 14' },
              { value: '100%', label: 'Cashless Rails', sublabel: 'Zero paper currency by law' },
              { value: '100%', label: 'Segregated Reserves', sublabel: 'Daily cryptographic proof' },
              { value: '500ms', label: 'Block Finality', sublabel: 'Deterministic slot settlement' },
            ].map(({ value, label, sublabel }) => (
              <div key={label} className="px-6 py-4 text-center first:pl-0 last:pr-0 space-y-0.5">
                <div className="text-2xl font-bold font-mono text-gold tracking-tight">{value}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-parchment/80">{label}</div>
                <div className="text-[10px] text-parchment/40 font-mono">{sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 100% CASHLESS DIGITAL ARCHITECTURE ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">100% Sovereign Cashless State</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">Frictionless Digital Rails &amp; Sovereign Cryptographic Velocity</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            Aletheia is a completely cashless republic. All legal tender is purely digital, settled deterministically on the Aletheia StableChain ledger with zero paper currency friction, zero counterfeiting risk, and instant biometric settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          
          {/* Sovereign Biometric Smart Card */}
          <div className="bg-white border border-navy/15 rounded-sm p-8 space-y-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Contactless Citizen Rails</span>
                <h3 className="text-lg font-bold text-navy">Sovereign Biometric Smart Cards</h3>
              </div>
            </div>

            <p className="text-xs text-navy/70 leading-relaxed">
              Polycarbonate NFC citizen cards with EAL6+ secure element chips. Enables sub-300ms offline and online tap-to-pay across all retail merchants, civic transit, and automated municipal kiosks.
            </p>

            <div className="space-y-3 pt-2 border-t border-navy/10 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>100% Cashless Mandate:</strong> Paper banknotes and coins are permanently eliminated from public and private commerce.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>Hardware-Enclave Security:</strong> Match-on-card fingerprint verification and disposable cryptographic transaction tokens.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>Offline Mesh Resilience:</strong> Cryptographically signed balance tokens allow emergency offline transactions during network interruptions.</span>
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
                <span className="text-[11px] font-mono text-gold uppercase tracking-wider block">Cryptographic State Rail</span>
                <h3 className="text-lg font-bold text-navy">Digital AEY (StableChain Native)</h3>
              </div>
            </div>

            <p className="text-xs text-navy/70 leading-relaxed">
              Native unit of settlement on the Aletheia StableChain ledger. Enables sub-second payment finality for e-residents, corporate entities, and international suppliers worldwide.
            </p>

            <div className="space-y-3 pt-2 border-t border-navy/10 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>500ms Instant Finality:</strong> Commercial transactions settle without intermediary clearing houses.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>Zero-Cost Domestic Rails:</strong> Free peer-to-peer citizen transactions; 0.0001 AEY fixed B2B contract gas.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-laurel shrink-0 mt-0.5" />
                <span><strong>SEPA / ISO 20022 Aligned:</strong> Native compliance with European interbank payment formatting.</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── CASHLESS PAYMENT INSTRUMENTS REGISTRY ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-gold uppercase tracking-wider">Sovereign Settlement Taxonomy</span>
            <h3 className="text-2xl font-bold text-navy">National Cashless Payment Instruments</h3>
            <p className="text-xs text-navy/70">
              Pursuant to the Cashless Republic &amp; Digital Settlement Act 2026, issued under the direct supervision of the Monetary Board.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-navy text-parchment font-mono uppercase tracking-wider text-[11px] border-b border-navy/20">
                  <th className="p-3">Payment Instrument</th>
                  <th className="p-3">Form Factor &amp; Channel</th>
                  <th className="p-3">Settlement Velocity</th>
                  <th className="p-3">Statutory Fee</th>
                  <th className="p-3">Security &amp; Privacy Invariant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {DIGITAL_PAYMENT_INSTRUMENTS.map((inst) => (
                  <tr key={inst.instrument} className="hover:bg-parchment-light/60">
                    <td className="p-3 font-bold text-navy">{inst.instrument}</td>
                    <td className="p-3 text-navy/80">{inst.formFactor}</td>
                    <td className="p-3 text-gold font-mono font-medium">{inst.velocity}</td>
                    <td className="p-3 text-laurel font-mono font-semibold">{inst.fee}</td>
                    <td className="p-3 text-navy/70 text-[11px]">{inst.security}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── INTERACTIVE PARITY CALCULATOR & REDEMPTION PORTAL ── */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Public Parity Converter</span>
            <h2 className="text-3xl font-bold text-navy tracking-tight">Convert & Verify Parity Value</h2>
            <p className="text-sm text-navy/70 leading-relaxed">
              Calculate the statutory purchasing value of international reserve currencies against AEY under the official Central Bank exchange reference rates.
            </p>

            <div className="p-6 bg-white border border-navy/15 rounded-sm shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Source Currency
                  </label>
                  <select
                    value={sourceCurrency}
                    onChange={(e) => setSourceCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy bg-white"
                  >
                    <option value="EUR">EUR — European Euro</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="GBP">GBP — British Pound</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Source Amount
                  </label>
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
                  <span className="text-[10px] font-mono uppercase text-gold block">Aletheian Guilder Output</span>
                  <span className="text-2xl font-bold font-mono text-parchment">{aeyResult} AEY</span>
                </div>
                <div className="text-right text-[11px] font-mono text-parchment/60">
                  <span>Rate: 1 {sourceCurrency} = {getExchangeRate()} AEY</span>
                  <span className="block text-laurel font-bold">100% Backed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-navy text-parchment p-8 rounded-sm border border-gold/30 space-y-6">
            <div className="flex items-center gap-3">
              <Scale className="w-6 h-6 text-gold" />
              <h3 className="text-lg font-bold text-parchment">The Unconditional Redemption Guarantee</h3>
            </div>

            <p className="text-xs text-parchment/75 leading-relaxed">
              Article 14 § 3 of the Covenant provides:
            </p>

            <blockquote className="p-4 bg-navy-deep border-l-2 border-gold font-serif italic text-xs text-parchment/90 leading-relaxed">
              &ldquo;Any natural or legal person presenting lawful AEY to the Central Bank or its designated redemption agents is entitled to immediate settlement in European Euros or London Good Delivery Gold at statutory parity, without fee, haircut, or administrative obstruction.&rdquo;
            </blockquote>

            <div className="flex items-center justify-between pt-2 text-[11px] font-mono text-gold">
              <span>Auditor: Tier-1 Independent Custody Attestation</span>
              <span>Reconciled Daily</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            Experience Sound Money by Covenant
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Open an enterprise account or acquire digital AEY settlement balances through accredited e-residency.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/e-residency"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Apply for E-Residency
            </Link>
            <Link
              href="/central-bank"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Central Bank Architecture
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
