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
      <section className="relative bg-navy text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/20">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/95 via-navy/90 to-navy-deep" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Sovereign Unit of Account</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-parchment leading-[1.08]">
              The Aletheian Guilder (AEY)
            </h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light">
              The Aletheian Guilder (symbol: <strong>AEY</strong> / code: <strong>AEY</strong>) is the official constitutional digital currency of The Sovereign Covenant State of Aletheia. Aletheia operates as a 100% cashless sovereign society: every transaction is settled frictionlessly on the Aletheia StableChain with zero physical cash handling, pegged 1:1 with the European Euro and backed by an unbreakable 100% reserve invariant.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/central-bank"
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >
                Central Bank Reserve Proof <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/treasury"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                Endowment Balance Sheet
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY MONETARY INVARIANTS ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">1.0000</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">AEY : EUR Fixed Parity</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100.0%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Cashless Digital Rails</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100.0%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Provable Segregated Reserves</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">500ms</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Instant Slot Settlement</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 100% CASHLESS DIGITAL ARCHITECTURE ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
