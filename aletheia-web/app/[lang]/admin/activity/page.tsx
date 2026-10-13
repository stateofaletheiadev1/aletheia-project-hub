'use client';

import React, { useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { api, useApi } from '@/lib/client/api';
import { shortHash } from '@/lib/auth';
import { ListState } from '@/components/admin/Notice';
import { Activity } from 'lucide-react';

interface ActivityLog {
  id: string;
  timestamp: string;
  actor: string;
  category: string;
  action: string;
  hash: string;
  outcome: 'success' | 'failure';
}

export default function AdminLiveActivityFeedPage() {
  const [filter, setFilter] = useState('ALL');
  const base = filter === 'ALL' ? '/api/admin/activity?' : `/api/admin/activity?category=${encodeURIComponent(filter)}&`;
  const { data, error, loading } = useApi<{ categories: string[]; events: ActivityLog[]; next: string | null }>(base);
  // Older pages, fetched on demand with the cursor of the page before.
  const [older, setOlder] = useState<{ base: string; events: ActivityLog[]; next: string | null } | null>(null);
  const extra = older?.base === base ? older : null;
  const filtered = [...(data?.events ?? []), ...(extra?.events ?? [])];
  const next = extra ? extra.next : data?.next;
  const loadOlder = async () => {
    if (!next) return;
    const r = await api<{ events: ActivityLog[]; next: string | null }>(`${base}before=${encodeURIComponent(next)}`);
    setOlder({ base, events: [...(extra?.events ?? []), ...r.events], next: r.next });
  };
  const categories = ['ALL', ...(data?.categories ?? [])];

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
                Audit Trail
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Every decision and sign-in, recorded in AletheiaDB with a SHA-256 fingerprint of the event
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
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
          <ListState loading={loading} error={error} empty={filtered.length === 0} emptyText="Nothing recorded in this category yet." />
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
                    <span>{new Date(item.timestamp).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right font-mono text-xs">
                <div>
                  <span className="text-[10px] text-parchment/40 block">SHA-256</span>
                  <span className="text-gold text-[11px]" translate="no" data-i18n-skip="">{item.hash ? shortHash(item.hash) : '—'}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${item.outcome === 'failure' ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
                  {item.outcome === 'failure' ? 'Refused' : 'Recorded'}
                </span>
              </div>
            </div>
          ))}
          {next && (
            <button type="button" onClick={loadOlder} className="w-full py-2 rounded-sm border border-gold/25 text-gold text-xs font-mono hover:bg-gold/10">
              Load older events
            </button>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
