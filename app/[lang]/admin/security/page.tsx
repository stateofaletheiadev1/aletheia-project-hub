'use client';

import React from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Lock,
  Radio,
  Server,
  AlertTriangle,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function AdminSecurityIntelPage() {
  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">ADSS Threat Intelligence &amp; Resilience</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                DEFCON 5 · NORMAL
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Unified Defence Cyber Operations Center · Post-Quantum Security Perimeter § 19
            </p>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active HSM Enclaves', value: '16 / 16', sub: 'FIPS 140-3 Level 4', good: true },
            { label: 'Post-Quantum Protocol', value: 'ML-KEM 768', sub: 'NIST Standard Enforced', good: true },
            { label: 'Network Ingress Probes', value: '1,492', sub: 'Blocked by Sovereign CERT', good: true },
            { label: 'Validator Consensus', value: '100.0%', sub: 'Zero Byzantine Faults', good: true },
          ].map((m) => (
            <div
              key={m.label}
              className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-2"
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">{m.label}</span>
              <div className="text-2xl font-bold font-mono text-parchment">{m.value}</div>
              <div className="text-[11px] font-mono text-emerald-400">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Security Alert Feed */}
        <div className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4">
          <div className="flex items-center justify-between border-b border-gold/15 pb-3">
            <h3 className="text-xs font-bold text-parchment font-mono uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-gold" />
              <span>Real-Time Defense Telemetry</span>
            </h3>
            <span className="text-[11px] font-mono text-parchment/40">Continuous Monitoring</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-navy-deep rounded-sm border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-parchment">All 5 Territorial Node Clusters Synchronized with Antioch Core</span>
              </div>
              <span className="text-[10px] text-parchment/40">07:50 UTC</span>
            </div>

            <div className="p-3 bg-navy-deep rounded-sm border border-gold/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gold shrink-0" />
                <span className="text-parchment">Automated bi-hourly invariant audit: All 11 reserve backing invariants 100% verified</span>
              </div>
              <span className="text-[10px] text-parchment/40">06:00 UTC</span>
            </div>

            <div className="p-3 bg-navy-deep rounded-sm border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-parchment/60 shrink-0" />
                <span className="text-parchment">Airspace and maritime automated radar feed healthy. Sector 4 clear.</span>
              </div>
              <span className="text-[10px] text-parchment/40">05:14 UTC</span>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
