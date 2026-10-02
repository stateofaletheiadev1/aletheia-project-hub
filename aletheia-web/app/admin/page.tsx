'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldAlert,
  Server,
  Users,
  Building2,
  FileCheck2,
  Coins,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Activity,
  Layers,
  Search,
} from 'lucide-react';

const PENDING_APPLICATIONS = [
  { id: 'APP-90412', name: 'Dr. Elizabeth Thorne-Vance', type: 'E-Residency', nationality: 'DE', date: '2026-10-01', riskScore: 'Low (0.02)' },
  { id: 'APP-90411', name: 'Kaelen Vance Marine Ltd', type: 'SARL Incorporation', jurisdiction: 'St. Brendan', date: '2026-10-01', riskScore: 'Low (0.01)' },
  { id: 'APP-90410', name: 'Aegis Oceanographic Corp', type: 'Vessel Flagging', flagType: 'Research Catamaran', date: '2026-09-30', riskScore: 'Low (0.04)' },
  { id: 'APP-90409', name: 'Maximilian Sterling', type: 'SDB Bond Subscription', amount: '250,000 AEY', date: '2026-09-30', riskScore: 'Verified' },
];

export default function AdminCommandConsolePage() {
  const [apps, setApps] = useState(PENDING_APPLICATIONS);

  const handleApprove = (id: string) => {
    setApps(apps.filter((a) => a.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── ADMIN HEADER ── */}
      <section className="bg-navy text-parchment pt-24 pb-16 border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Internal Sovereign Console</span>
                </div>
                <span className="px-2 py-0.5 bg-red-900/60 text-red-200 border border-red-500/40 rounded-sm text-[10px] font-mono font-bold">
                  RESTRICTED OFFICIAL ACCESS
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-parchment">
                Administrative Command & Registry Operations
              </h1>
              <p className="text-xs sm:text-sm text-parchment/70 font-light">
                General Secretariat of State & Ministerial Registry Queue Management.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/admin/immigration"
                className="px-4 py-2 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all flex items-center gap-1.5 shadow-sm"
              >
                Immigration Terminal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/login"
                className="px-3.5 py-2 bg-navy-deep border border-red-500/40 text-red-300 hover:text-red-100 text-xs font-mono rounded-sm transition-colors"
              >
                Lock Console
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── SYSTEM METRICS ROW ── */}
      <section className="bg-navy-deep border-b border-navy/30 text-parchment py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">{apps.length}</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Pending Review Queue</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-laurel">5 / 5 Active</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Federal State Clusters</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-gold">2.45B AEY</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Treasury Reconciled</p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-bold font-mono text-parchment">DEFCON 5</span>
              <p className="text-xs text-parchment/70 uppercase tracking-wide">Readiness Status</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN ADMINISTRATIVE INTERACTION ── */}
      <section className="py-12 lg:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Applications Queue */}
          <div className="lg:col-span-8 bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-navy/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-navy">Pending Ministerial Inscriptions</h2>
                <p className="text-xs text-navy/60">Awaiting officer attestation and on-chain block commitment.</p>
              </div>
              <span className="text-xs font-mono text-gold font-bold">Queue: {apps.length} Records</span>
            </div>

            <div className="space-y-3">
              {apps.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-parchment-light border border-navy/10 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-navy text-parchment text-[10px] font-mono font-bold rounded-sm">
                        {item.id}
                      </span>
                      <strong className="text-sm font-bold text-navy">{item.name}</strong>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-navy/70">
                      <span>Type: <strong>{item.type}</strong></span>
                      <span>Risk: <strong className="text-laurel">{item.riskScore}</strong></span>
                      <span className="font-mono text-[11px] text-navy/50">{item.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="px-3 py-1.5 bg-navy text-gold text-xs font-bold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sign & Inscribe
                    </button>
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-sm hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}

              {apps.length === 0 && (
                <div className="text-center py-12 text-navy/50 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-laurel mx-auto" />
                  <p className="text-sm font-bold text-navy">All pending applications processed.</p>
                  <p className="text-xs">State registry queue is completely reconciled.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Node Health & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Cluster Health */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                State Validator Telemetry
              </h3>

              <div className="space-y-3 text-xs">
                {[
                  { name: 'Antioch Capital Node', status: 'Online · 500ms', cluster: 'Cluster 01' },
                  { name: 'St. Barbara Defence Node', status: 'Online · 500ms', cluster: 'Cluster 02' },
                  { name: 'Augustine Polytechnic Node', status: 'Online · 500ms', cluster: 'Cluster 03' },
                  { name: 'Benedict Energy Grid Node', status: 'Online · 500ms', cluster: 'Cluster 04' },
                  { name: 'St. Brendan Port Node', status: 'Online · 500ms', cluster: 'Cluster 05' },
                ].map((node, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 border-b border-navy/5 last:border-0">
                    <div>
                      <strong className="text-navy block font-medium">{node.name}</strong>
                      <span className="text-[10px] font-mono text-navy/50">{node.cluster}</span>
                    </div>
                    <span className="text-[11px] font-mono text-laurel flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-laurel" /> {node.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-navy text-parchment p-6 rounded-sm border border-gold/30 space-y-3">
              <h4 className="text-sm font-bold text-parchment">Operational Portals</h4>
              <div className="space-y-2 text-xs">
                <Link href="/admin/immigration" className="block text-gold hover:underline flex items-center justify-between">
                  <span>Immigration e-Gate Console</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <Link href="/transparency" className="block text-gold hover:underline flex items-center justify-between">
                  <span>Public Transparency Log</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <Link href="/documents" className="block text-gold hover:underline flex items-center justify-between">
                  <span>Gazette Promulgation Desk</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
}
