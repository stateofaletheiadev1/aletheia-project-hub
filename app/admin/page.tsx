'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Users, UserCheck, Building2, Stamp, Globe2,
  CheckCircle2, XCircle, AlertTriangle, Clock, ArrowRight,
  TrendingUp, ShieldCheck, Activity, Eye,
} from 'lucide-react';

const PENDING_QUEUE = [
  { id: 'APP-90412', name: 'Dr. Elizabeth Thorne-Vance', type: 'E-Residency', nationality: 'DE', date: '2026-10-01', risk: 'Low', riskScore: '0.02' },
  { id: 'APP-90411', name: 'Kaelen Vance Marine Ltd', type: 'SARL Incorporation', nationality: 'MT', date: '2026-10-01', risk: 'Low', riskScore: '0.01' },
  { id: 'APP-90410', name: 'Aegis Oceanographic Corp', type: 'Vessel Flagging', nationality: 'DE', date: '2026-09-30', risk: 'Low', riskScore: '0.04' },
  { id: 'APP-90409', name: 'Maximilian Sterling', type: 'SDB Bond Subscription', nationality: 'GB', date: '2026-09-30', risk: 'Verified', riskScore: '0.00' },
  { id: 'APP-90408', name: 'Sophia Andreou', type: 'Citizenship Application', nationality: 'GR', date: '2026-09-29', risk: 'Medium', riskScore: '0.18' },
];

const STAT_CARDS = [
  { label: 'Total Citizens', value: '2,841', delta: '+12 this month', icon: Users, color: '#C49A4E', bg: 'rgba(196,154,78,0.10)' },
  { label: 'Pending Approvals', value: '48', delta: '12 urgent', icon: Clock, color: '#E4A628', bg: 'rgba(228,166,40,0.10)' },
  { label: 'Companies Registered', value: '394', delta: '+5 this week', icon: Building2, color: '#3D8664', bg: 'rgba(61,134,100,0.10)' },
  { label: 'Active Visas', value: '1,204', delta: '7 expiring soon', icon: Stamp, color: '#9B59B6', bg: 'rgba(155,89,182,0.10)' },
];

const RISK_COLOR: Record<string, string> = { Low: '#3D8664', Medium: '#E4A628', High: '#C0392B', Verified: '#3D8664' };

export default function AdminCommandConsolePage() {
  const [queue, setQueue] = useState(PENDING_QUEUE);

  const approve = (id: string) => setQueue(q => q.filter(a => a.id !== id));
  const reject = (id: string) => setQueue(q => q.filter(a => a.id !== id));

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-8">

        {/* Welcome bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-parchment">Command Dashboard</h1>
            <p className="text-[12px] text-parchment/45 mt-0.5 font-mono">
              ADSS Internal Console · {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm text-[11px] font-mono"
            style={{ background: 'rgba(61,134,100,0.12)', border: '1px solid rgba(61,134,100,0.25)', color: '#3D8664' }}>
            <Activity className="w-3.5 h-3.5" />
            <span>All systems operational</span>
          </div>
        </div>

        {/* KPI stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-sm p-5 space-y-3" style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.12)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: 'rgba(244,238,223,0.45)' }}>{label}</span>
                <div className="w-8 h-8 rounded-sm flex items-center justify-center" style={{ background: bg }}>
                  <Icon style={{ width: '16px', height: '16px', color }} />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-mono" style={{ color: '#F4EEDF' }}>{value}</div>
              <div className="text-[10px] font-mono" style={{ color: 'rgba(244,238,223,0.35)' }}>{delta}</div>
            </div>
          ))}
        </div>

        {/* Quick access tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Citizenship Approvals', href: '/admin/citizenship', count: 12, icon: UserCheck, urgent: true },
            { label: 'Visa Applications', href: '/admin/immigration', count: 7, icon: Stamp, urgent: false },
            { label: 'E-Residency Queue', href: '/admin/e-residency', count: 24, icon: Globe2, urgent: false },
            { label: 'Company Formations', href: '/admin/companies', count: 5, icon: Building2, urgent: false },
          ].map(({ label, href, count, icon: Icon, urgent }) => (
            <Link key={href} href={href}
              className="flex flex-col gap-3 p-4 rounded-sm transition-all group"
              style={{ background: '#111827', border: `1px solid ${urgent ? 'rgba(196,154,78,0.35)' : 'rgba(196,154,78,0.12)'}` }}
            >
              <div className="flex items-center justify-between">
                <Icon style={{ width: '18px', height: '18px', color: '#C49A4E' }} />
                {urgent && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(196,154,78,0.2)', color: '#C49A4E' }}>URGENT</span>}
              </div>
              <div>
                <div className="text-2xl font-extrabold font-mono" style={{ color: '#F4EEDF' }}>{count}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(244,238,223,0.45)' }}>{label}</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#C49A4E' }}>
                Review <ArrowRight style={{ width: '10px', height: '10px' }} />
              </div>
            </Link>
          ))}
        </div>

        {/* Pending applications table */}
        <div className="rounded-sm overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.12)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(196,154,78,0.10)' }}>
            <h2 className="text-[13px] font-bold text-parchment">Pending Registry Queue</h2>
            <span className="text-[11px] font-mono" style={{ color: 'rgba(196,154,78,0.7)' }}>{queue.length} awaiting action</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(196,154,78,0.08)' }}>
                  {['App ID', 'Applicant / Entity', 'Type', 'Nationality', 'Date', 'Risk', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold tracking-wider uppercase" style={{ color: 'rgba(244,238,223,0.30)', fontSize: '9px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map(app => (
                  <tr key={app.id} className="group" style={{ borderBottom: '1px solid rgba(196,154,78,0.06)' }}>
                    <td className="px-4 py-3 font-mono" style={{ color: '#C49A4E' }}>{app.id}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#F4EEDF' }}>{app.name}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(244,238,223,0.60)' }}>{app.type}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: 'rgba(244,238,223,0.50)' }}>{app.nationality}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'rgba(244,238,223,0.40)' }}>{app.date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono"
                        style={{ background: `${RISK_COLOR[app.risk]}18`, color: RISK_COLOR[app.risk], border: `1px solid ${RISK_COLOR[app.risk]}35` }}>
                        {app.risk} · {app.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => approve(app.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold transition-all"
                          style={{ background: 'rgba(61,134,100,0.15)', color: '#3D8664', border: '1px solid rgba(61,134,100,0.25)' }}>
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => reject(app.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold transition-all"
                          style={{ background: 'rgba(112,24,36,0.15)', color: '#fca5a5', border: '1px solid rgba(112,24,36,0.25)' }}>
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                        <button className="p-1 rounded-sm" style={{ color: 'rgba(244,238,223,0.35)' }}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {queue.length === 0 && (
            <div className="py-12 text-center">
              <ShieldCheck style={{ width: '32px', height: '32px', color: '#3D8664', margin: '0 auto 12px' }} />
              <p className="text-sm font-semibold" style={{ color: 'rgba(244,238,223,0.6)' }}>All applications processed</p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(244,238,223,0.3)' }}>Queue is clear — no pending items</p>
            </div>
          )}
        </div>

      </div>
    </AdminShell>
  );
}
