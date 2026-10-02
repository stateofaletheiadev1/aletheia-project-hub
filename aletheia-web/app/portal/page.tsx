'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  User,
  ShieldCheck,
  Building2,
  KeyRound,
  FileText,
  CreditCard,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  ArrowRight,
  Settings,
  Bell,
  Fingerprint,
} from 'lucide-react';

export default function CivicPortalDashboard() {
  const [copiedKey, setCopiedKey] = useState(false);

  const copyPublicKey = () => {
    navigator.clipboard.writeText('0x4F829104A18E9B20CA7891230BFE92147A209148');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── PORTAL HEADER BANNER ── */}
      <section className="bg-navy text-parchment pt-24 pb-16 border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Civic Access Portal</span>
                </div>
                <StatusBadge status="Operational" size="sm" />
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">
                E-Resident Dashboard & Civic Services
              </h1>
              <p className="text-xs sm:text-sm text-parchment/70 font-light">
                Secure state administration console for Aletheia digital identity holders and incorporated corporate directors.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/portal/apply"
                className="px-4 py-2 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-1.5 shadow-sm"
              >
                New Application <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/business"
                className="px-4 py-2 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                Form Company
              </Link>
              <Link
                href="/portal/login"
                className="px-3.5 py-2 bg-navy-deep border border-navy/40 text-parchment/70 hover:text-gold text-xs font-mono rounded-sm transition-colors"
              >
                Sign Out
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── MAIN DASHBOARD VIEW ── */}
      <section className="py-12 lg:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Digital Credential Card & Quick Stats */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Specimen Digital Credential ID Card */}
            <div className="bg-navy text-parchment p-6 rounded-sm border border-gold/40 shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <StarOfTruth size={120} />
              </div>

              <div className="relative flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <StarOfTruth size={20} />
                  <div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-gold block">Republic of Aletheia</span>
                    <span className="text-[10px] font-mono text-parchment/60">E-Residency Credential</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-laurel/20 text-laurel border border-laurel/40 rounded-sm text-[9px] font-mono font-bold">
                  ACTIVE
                </span>
              </div>

              <div className="relative pt-4 space-y-1">
                <span className="text-[10px] font-mono uppercase text-parchment/50">Credential Holder</span>
                <p className="text-base font-bold text-parchment">Dr. Elizabeth Thorne-Vance</p>
                <span className="text-[11px] font-mono text-gold block">ID: ALE-ERES-2026-004928</span>
              </div>

              <div className="relative pt-3 border-t border-navy/40 grid grid-cols-2 gap-2 text-[10px] font-mono text-parchment/70">
                <div>
                  <span className="text-parchment/40 block">Issued On:</span>
                  <span>2026-03-01</span>
                </div>
                <div>
                  <span className="text-parchment/40 block">Expires:</span>
                  <span>2029-03-01</span>
                </div>
              </div>

              <div className="relative pt-2">
                <button
                  onClick={copyPublicKey}
                  className="w-full py-1.5 bg-navy-deep border border-navy/40 rounded-sm text-[10px] font-mono text-parchment/80 hover:text-gold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey ? 'Public Key Copied!' : 'Copy Signing Key Hash'}
                </button>
              </div>
            </div>

            {/* Quick Balances & Settlement Card */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy uppercase tracking-wider">Settlement Balance</span>
                <Link href="/aey" className="text-[11px] text-gold font-bold hover:underline">
                  Top Up AEY
                </Link>
              </div>

              <div className="space-y-1">
                <span className="text-3xl font-bold font-mono text-navy">14,250.00 <span className="text-xs text-navy/50 font-sans">AEY</span></span>
                <p className="text-[11px] text-navy/60 font-mono">1 AEY = 1.0000 EUR (100% Reserve Backed)</p>
              </div>

              <div className="pt-3 border-t border-navy/10 flex gap-2">
                <button
                  onClick={() => alert('SEPA Interbank Deposit Instructions: IBAN: ALE48 9104 2026 0049 2810 AEY')}
                  className="flex-1 py-1.5 bg-navy text-gold text-xs font-bold rounded-sm hover:bg-navy-deep transition-colors text-center"
                >
                  Deposit EUR
                </button>
                <button
                  onClick={() => alert('Instant AEY withdrawal to external IBAN initiated.')}
                  className="flex-1 py-1.5 border border-navy/20 text-navy text-xs font-semibold rounded-sm hover:border-gold hover:text-gold transition-colors text-center"
                >
                  Withdraw
                </button>
              </div>
            </div>

            {/* Compliance Status Card */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-navy font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-laurel" /> Statutory Compliance
              </div>
              <ul className="space-y-2 text-xs text-navy/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-laurel" /> KYC / AML Verification: Tier 2 Verified
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-laurel" /> Biometric Identity Inscription: Active
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-laurel" /> Annual Maintenance Fee: Paid until 2027
                </li>
              </ul>
            </div>

          </div>

          {/* Right Column: Corporate Holdings, Active Applications & Services */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Active Corporate Entities */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-navy">Incorporated Commercial Entities</h3>
                  <p className="text-xs text-navy/60">Companies registered under your digital credential.</p>
                </div>
                <Link
                  href="/business"
                  className="px-4 py-1.5 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors inline-flex items-center gap-1.5 self-start"
                >
                  <Building2 className="w-3.5 h-3.5" /> Incorporate Entity
                </Link>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-parchment-light border border-navy/10 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-navy">Thorne Oceanic Robotics SARL</h4>
                      <span className="px-2 py-0.5 bg-navy/5 text-navy border border-navy/15 rounded-sm text-[10px] font-mono">
                        SARL-2026-0819
                      </span>
                    </div>
                    <p className="text-xs text-navy/70">Autonomous pelagic sensor array manufacturing & research.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => alert('Certificate of Good Standing & Registry Extract downloaded.')}
                      className="px-3 py-1.5 bg-white border border-navy/20 text-navy text-xs font-semibold rounded-sm hover:border-gold hover:text-gold transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Certificate
                    </button>
                    <Link
                      href="/technology"
                      className="px-3 py-1.5 bg-navy text-gold text-xs font-bold rounded-sm hover:bg-navy-deep transition-colors"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Civic Services & Quick Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-navy">Civic Self-Service Applications</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <Link
                  href="/passport"
                  className="p-5 bg-white border border-navy/15 rounded-sm hover:shadow-md transition-shadow space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <Fingerprint className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono text-navy/50">Doc 9303</span>
                  </div>
                  <h4 className="font-bold text-sm text-navy">Passport & Travel Documents</h4>
                  <p className="text-xs text-navy/70 leading-relaxed">
                    Review ICAO biometric specifications and check citizenship transition status.
                  </p>
                </Link>

                <Link
                  href="/documents"
                  className="p-5 bg-white border border-navy/15 rounded-sm hover:shadow-md transition-shadow space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <FileText className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono text-navy/50">Gazette § 12</span>
                  </div>
                  <h4 className="font-bold text-sm text-navy">Official Document Registry</h4>
                  <p className="text-xs text-navy/70 leading-relaxed">
                    Verify statutory acts, decrees, and download verified notarized extracts.
                  </p>
                </Link>

                <Link
                  href="/invest"
                  className="p-5 bg-white border border-navy/15 rounded-sm hover:shadow-md transition-shadow space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <CreditCard className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono text-navy/50">Series A/B/C</span>
                  </div>
                  <h4 className="font-bold text-sm text-navy">Sovereign Development Bonds</h4>
                  <p className="text-xs text-navy/70 leading-relaxed">
                    Subscribe to high-yield infrastructure bonds with guaranteed capital repatriation.
                  </p>
                </Link>

                <Link
                  href="/contact"
                  className="p-5 bg-white border border-navy/15 rounded-sm hover:shadow-md transition-shadow space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <KeyRound className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono text-navy/50">24/7 Desk</span>
                  </div>
                  <h4 className="font-bold text-sm text-navy">Consular & Legal Inquiries</h4>
                  <p className="text-xs text-navy/70 leading-relaxed">
                    Submit cryptographically authenticated petitions to ministerial departments.
                  </p>
                </Link>

              </div>
            </div>

            {/* Recent Cryptographic Activity Log */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-navy uppercase tracking-wider">
                Cryptographic State Activity Log
              </h3>
              <div className="space-y-3 font-mono text-xs divide-y divide-navy/10">
                <div className="pt-2 first:pt-0 flex items-center justify-between">
                  <span className="text-navy">Contract Signing: Subsea Concession Lease</span>
                  <span className="text-navy/50 text-[11px]">2026-09-28 · Hash: 0x9f1a...44fe</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-navy">Treasury Receipt: Dividend Disbursement</span>
                  <span className="text-navy/50 text-[11px]">2026-09-15 · Hash: 0x3b8c...0012</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-navy">Credential Re-Attestation (BSI TR-03110)</span>
                  <span className="text-navy/50 text-[11px]">2026-08-30 · Hash: 0x88ea...91bc</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
}
