'use client';

import React from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { useApi } from '@/lib/client/api';
import { ListState } from '@/components/admin/Notice';
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface SecurityData {
  metrics: { officerSessions: number; portalSessions: number; locked: number; failedSignIns24h: number; officers: number };
  events: { id: string; at: string; action: string; actor: string; outcome: 'success' | 'failure' }[];
}

export default function AdminSecurityIntelPage() {
  const { data, error, loading } = useApi<SecurityData>('/api/admin/security');
  const m = data?.metrics;
  const cards = [
    { label: 'Failed sign-ins (24 h)', value: m?.failedSignIns24h, sub: 'Portal and console', good: (m?.failedSignIns24h ?? 0) === 0 },
    { label: 'Locked accounts', value: m?.locked, sub: 'Locked for 15 minutes after repeated failures', good: (m?.locked ?? 0) === 0 },
    { label: 'Console sessions', value: m?.officerSessions, sub: `${m?.officers ?? '—'} active officer accounts`, good: true },
    { label: 'Portal sessions', value: m?.portalSessions, sub: 'Not yet expired', good: true },
  ];

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-parchment">Security Monitoring</h1>
          <p className="text-[12px] text-parchment/50 font-mono mt-0.5">Sign-ins, lockouts and security changes recorded in the audit trail</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="p-4 rounded-sm bg-[#111827] border border-gold/15 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-parchment/40">{c.label}</span>
              <div className="text-2xl font-bold font-mono text-parchment">{c.value ?? '—'}</div>
              <div className={`text-[11px] font-mono ${c.good ? 'text-emerald-400' : 'text-amber-400'}`}>{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4">
          <div className="flex items-center justify-between border-b border-gold/15 pb-3">
            <h3 className="text-xs font-bold text-parchment font-mono uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-gold" />
              <span>Security Events</span>
            </h3>
            <span className="text-[11px] font-mono text-parchment/40">Latest 20</span>
          </div>
          <ListState loading={loading} error={error} empty={(data?.events ?? []).length === 0} emptyText="No security events recorded yet." />
          <div className="space-y-3 font-mono text-xs">
            {(data?.events ?? []).map((e) => (
              <div key={e.id} className={`p-3 bg-navy-deep rounded-sm border flex items-center justify-between gap-3 ${e.outcome === 'failure' ? 'border-red-500/30' : 'border-emerald-500/20'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {e.outcome === 'failure' ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> : e.action.includes('signed in') ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Activity className="w-4 h-4 text-gold shrink-0" />}
                  <span className="text-parchment truncate">{e.action}</span>
                </div>
                <span className="text-[10px] text-parchment/40 shrink-0">{new Date(e.at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
