'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldAlert,
  Lock,
  Terminal,
  Server,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Bug,
  KeyRound,
  Activity,
  FileCode,
  Radio,
} from 'lucide-react';

const ADVISORIES = [
  {
    id: 'ALE-ADV-2026-03',
    title: 'State Validator Node Hardening: BGP Anycast Prefix Monitoring',
    severity: 'High',
    date: '2026-09-22',
    desc: 'Mandatory configuration update for all validator node operators across the five federated states to enforce RPKI route origin validation against autonomous system hijacking.',
    cve: 'Covenant Security Directive 26-09',
  },
  {
    id: 'ALE-ADV-2026-02',
    title: 'Post-Quantum Migration: ML-KEM Key Encapsulation Standard',
    severity: 'Medium',
    date: '2026-08-14',
    desc: 'Transition protocol for ministerial TLS 1.3 endpoints adopting NIST FIPS 203 (ML-KEM/Kyber) hybrid cipher suites to safeguard public records against retrospective decryption.',
    cve: 'National Crypto Standard § 4',
  },
  {
    id: 'ALE-ADV-2026-01',
    title: 'SCADA Telemetry Isolation on St. Brendan Port Crane Networks',
    severity: 'Critical',
    date: '2026-07-08',
    desc: 'Air-gap verification completed across automated container terminal handling controllers. Zero internet exposure confirmed with optical data diodes.',
    cve: 'Infrastructure Shield Audit 01',
  },
];

export default function CybersecurityPage() {
  const { notify } = useToast();
  const [reported, setReported] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">CSIRT-ALE National Desk</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">
              National Cyber Defence & CSIRT
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              Continuous 24/7 sovereign cyber defence protecting the Aletheia StableChain, ministerial registries, offshore energy grids, and maritime communications against state-sponsored intrusions and asymmetric threats.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => notify('Responsible disclosure channel', 'Submit encrypted reports to security@adss.aletheia.gov. Acknowledgement within 72 hours under the coordinated disclosure policy.', 'info')}
                className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-2 shadow-lg shadow-gold/10"
              >
                Report a Vulnerability <Bug className="w-3.5 h-3.5" />
              </button>
              <Link
                href="/stablechain"
                className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                StableChain Consensus Hardening
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE CSIRT STATUS BAR ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold text-laurel flex items-center justify-center gap-1">
                <Activity className="w-4 h-4" /> GREEN
              </span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">National Cyber Threat Level</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">100%</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Validator Node Uptime</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">Post-Quantum</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">ML-KEM / ML-DSA Ready</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold text-gold">&lt; 3 mins</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">CSIRT Incident Triage Time</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEFENCE PILLARS ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Zero-Trust Republic</span>
          <h2 className="text-3xl font-bold text-navy tracking-tight">Four Defensive Mandates</h2>
          <p className="text-xs sm:text-sm text-navy/70 leading-relaxed">
            Engineered to exceed ENISA (European Union Agency for Cybersecurity) and BSI Germany baseline standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <Server className="w-8 h-8 text-gold" />
            <h3 className="text-base font-bold text-navy">Validator Protection</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Anti-DDoS scrubbers, automated BGP failover, and hardware security modules (HSM) isolating consensus signing keys.
            </p>
          </div>

          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <Lock className="w-8 h-8 text-navy" />
            <h3 className="text-base font-bold text-navy">Post-Quantum Crypto</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Standardized deployment of lattice-based post-quantum cryptography protecting citizen records from future quantum computers.
            </p>
          </div>

          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <Radio className="w-8 h-8 text-laurel" />
            <h3 className="text-base font-bold text-navy">SCADA Air-Gapping</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Physical optical diodes separating operational technology on offshore energy platforms and container cranes from public IP networks.
            </p>
          </div>

          <div className="bg-white p-6 border border-navy/15 rounded-sm space-y-3 hover:shadow-md transition-shadow">
            <Bug className="w-8 h-8 text-gold" />
            <h3 className="text-base font-bold text-navy">Sovereign Bug Bounty</h3>
            <p className="text-xs text-navy/70 leading-relaxed">
              Continuous red-teaming incentives awarding white-hat security researchers up to 100,000 AEY for responsible vulnerability disclosures.
            </p>
          </div>
        </div>

        {/* ── SECURITY ADVISORIES FEED ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy/10 pb-4">
            <div>
              <span className="text-xs font-bold text-gold uppercase tracking-wider block">Official Dispatches</span>
              <h3 className="text-2xl font-bold text-navy">Recent CSIRT-ALE Security Advisories</h3>
            </div>
            <span className="text-xs font-mono text-navy/50">PGP Key ID: 0x9B12FE00</span>
          </div>

          <div className="space-y-4">
            {ADVISORIES.map((adv) => (
              <div
                key={adv.id}
                className="p-5 bg-parchment-light border border-navy/10 rounded-sm space-y-2 hover:border-gold/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-navy text-parchment text-[10px] font-mono font-bold rounded-sm">
                      {adv.id}
                    </span>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        adv.severity === 'Critical'
                          ? 'text-red-700'
                          : adv.severity === 'High'
                          ? 'text-orange-600'
                          : 'text-laurel'
                      }`}
                    >
                      Severity: {adv.severity}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-navy/50">{adv.date}</span>
                </div>

                <h4 className="text-sm font-bold text-navy">{adv.title}</h4>
                <p className="text-xs text-navy/70 leading-relaxed">{adv.desc}</p>
                <div className="text-[10px] font-mono text-navy/50 pt-1">Reference: {adv.cve}</div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ── CALL TO ACTION ── */}
      <section id="disclosure" className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            Report a Security Incident
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Incident reports and vulnerability findings must be encrypted using the official CSIRT PGP key before transmission.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Contact CSIRT Desk
            </Link>
            <Link
              href="/security"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Civil Defence Command
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
