'use client';

import React, { useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { Activity } from 'lucide-react';

interface ActivityLog {
  id: string;
  timestamp: string;
  actor: string;
  category: 'Citizenship' | 'Border / E-Gate' | 'Incorporation' | 'Endowment' | 'Security';
  action: string;
  hash: string;
  status: 'Committed' | 'Validated';
}

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'ACT-9901',
    timestamp: '2026-10-05 07:44:12 UTC',
    actor: 'Cmdr. S. Okafor',
    category: 'Citizenship',
    action: 'Approved Naturalisation petition for Sophia Andreou (GRC)',
    hash: 'AL:Thm44l3…d29q',
    status: 'Committed',
  },
  {
    id: 'ACT-9900',
    timestamp: '2026-10-05 07:31:05 UTC',
    actor: 'ST-BRENDAN-E-GATE-04',
    category: 'Border / E-Gate',
    action: 'Cleared ordinary entry for ALE-004928 (Dr. Elizabeth Thorne-Vance)',
    hash: 'AL:T0e46wm…7r43',
    status: 'Committed',
  },
  {
    id: 'ACT-9899',
    timestamp: '2026-10-05 07:15:44 UTC',
    actor: 'Registrar System',
    category: 'Incorporation',
    action: 'Charter ratified: Antioch Modular Energy AG (ALE-AG-2026-0008)',
    hash: 'AL:T9srtal…rdnh',
    status: 'Committed',
  },
  {
    id: 'ACT-9898',
    timestamp: '2026-10-05 06:50:20 UTC',
    actor: 'Treasury Validator Node 01',
    category: 'Endowment',
    action: 'AEY supply invariant verified: 100% reserve parity maintained',
    hash: 'AL:Txn9s5y…n2wj',
    status: 'Validated',
  },
  {
    id: 'ACT-9897',
    timestamp: '2026-10-05 06:12:11 UTC',
    actor: 'ADSS Cybersecurity CERT',
    category: 'Security',
    action: 'Post-Quantum key rotation cycle completed across validator perimeter',
    hash: 'AL:Tdhwcu5…jxa6',
    status: 'Validated',
  },
];

export default function AdminLiveActivityFeedPage() {
  const [logs] = useState<ActivityLog[]>(INITIAL_LOGS);
  const [filter, setFilter] = useState('ALL');

  const filtered = logs.filter(
    (l) => filter === 'ALL' || l.category === filter
  );

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">Live Administrative Ledger Feed</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Stream
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Append-only cryptographic state transitions recorded by ADSS &amp; Ministerial consoles
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {['ALL', 'Citizenship', 'Border / E-Gate', 'Incorporation', 'Endowment', 'Security'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-sm text-xs font-mono transition-colors ${
                filter === cat
                  ? 'bg-gold text-navy font-bold'
                  : 'bg-[#111827] text-parchment/60 hover:text-parchment border border-gold/15'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Activity Stream */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
              style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.12)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(196,154,78,0.12)', border: '1px solid rgba(196,154,78,0.25)' }}
                >
                  <Activity className="w-4 h-4 text-gold" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-parchment font-mono">{item.action}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-navy-deep text-gold border border-gold/20">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-parchment/45">
                    <span>Officer / Node: <strong className="text-parchment/70">{item.actor}</strong></span>
                    <span>·</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right font-mono text-xs">
                <div>
                  <span className="text-[10px] text-parchment/40 block">BLOCK PROOF</span>
                  <span className="text-gold text-[11px]" translate="no" data-i18n-skip="">{item.hash}</span>
                </div>
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
