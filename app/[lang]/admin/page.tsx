'use client';

import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Users,
  UserCheck,
  Building2,
  Stamp,
  Globe2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Eye,
  FileSearch,
  ArrowUpRight,
} from 'lucide-react';

const PENDING_QUEUE = [
  { id: 'APP-90412', name: 'Dr. Elizabeth Thorne-Vance', type: 'E-Residency', nationality: 'DE', date: '2026-10-01', risk: 'Low', riskScore: '0.02' },
  { id: 'APP-90411', name: 'Kaelen Vance Marine Ltd', type: 'SARL Incorporation', nationality: 'MT', date: '2026-10-01', risk: 'Low', riskScore: '0.01' },
  { id: 'APP-90410', name: 'Aegis Oceanographic Corp', type: 'Vessel Flagging', nationality: 'DE', date: '2026-09-30', risk: 'Low', riskScore: '0.04' },
  { id: 'APP-90409', name: 'Maximilian Sterling', type: 'SDB Bond Subscription', nationality: 'GB', date: '2026-09-30', risk: 'Verified', riskScore: '0.00' },
  { id: 'APP-90408', name: 'Sophia Andreou', type: 'Citizenship Application', nationality: 'GR', date: '2026-09-29', risk: 'Medium', riskScore: '0.18' },
];

const STAT_CARDS = [
  { label: 'Total Citizens', value: '2,841', delta: '+12 this month', trend: '+0.4%', icon: Users, accent: '#C49A4E', barWidth: '72' },
  { label: 'Pending Approvals', value: '48', delta: '12 urgent', trend: '+8', icon: Clock, accent: '#E4A628', barWidth: '55' },
  { label: 'Companies Registered', value: '394', delta: '+5 this week', trend: '+1.3%', icon: Building2, accent: '#3D8664', barWidth: '88' },
  { label: 'Active Visas', value: '1,204', delta: '7 expiring soon', trend: '+2.1%', icon: Stamp, accent: '#8B5CF6', barWidth: '65' },
];

const RISK_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  Low:      { bg: 'rgba(61,134,100,0.12)', text: '#3D8664', border: 'rgba(61,134,100,0.28)' },
  Medium:   { bg: 'rgba(228,166,40,0.12)', text: '#E4A628', border: 'rgba(228,166,40,0.28)' },
  High:     { bg: 'rgba(192,57,43,0.12)',  text: '#E05A6A', border: 'rgba(192,57,43,0.28)' },
  Verified: { bg: 'rgba(61,134,100,0.12)', text: '#3D8664', border: 'rgba(61,134,100,0.28)' },
};

const QUICK_ACTIONS = [
  { label: 'Citizenship Approvals', href: '/admin/citizenship', count: 12, icon: UserCheck, urgent: true, desc: 'Applications pending review' },
  { label: 'Visa Applications', href: '/admin/immigration', count: 7, icon: Stamp, urgent: false, desc: 'Border crossings pending' },
  { label: 'E-Residency Queue', href: '/admin/e-residency', count: 24, icon: Globe2, urgent: false, desc: 'Digital identity applications' },
  { label: 'Company Formations', href: '/admin/companies', count: 5, icon: Building2, urgent: false, desc: 'Corporate registry submissions' },
];

const RECENT_ACTIVITY = [
  { time: '08:42', action: 'APP-90412 submitted — E-Residency (Thorne-Vance)', type: 'info' },
  { time: '08:31', action: 'Citizenship APP-90407 approved — Ref. no. CT-2891', type: 'success' },
  { time: '08:14', action: 'Security alert cleared — Threat vector neutralised', type: 'success' },
  { time: '07:55', action: 'Visa APP-90400 flagged for secondary review', type: 'warning' },
];

export default function AdminCommandConsolePage() {
  const [queue, setQueue] = useState(PENDING_QUEUE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  const approve = (id: string) => setQueue(q => q.filter(a => a.id !== id));
  const reject  = (id: string) => setQueue(q => q.filter(a => a.id !== id));

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-8" style={{ minHeight: '100%' }}>

        {/* ── Page Header ── */}
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#F4EEDF' }}>
              Command Dashboard
            </h1>
            <p className="text-[12px] font-mono mt-1" style={{ color: 'rgba(244,238,223,0.35)' }}>
              ADSS Internal Console ·&nbsp;
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-sm text-[11px] font-mono shrink-0"
            style={{ background: 'rgba(61,134,100,0.10)', border: '1px solid rgba(61,134,100,0.22)', color: '#3D8664' }}>
            <div className="live-dot" />
            <span className="font-bold tracking-wide">All systems operational</span>
          </div>
        </div>

        {/* ── KPI Stat Cards ── */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-500 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {STAT_CARDS.map(({ label, value, delta, trend, icon: Icon, accent, barWidth }) => (
            <div key={label} className="kpi-card rounded-sm p-5 space-y-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'rgba(244,238,223,0.40)' }}>{label}</span>
                <div className="w-9 h-9 rounded-sm flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
                  <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
              </div>
              <div>
                <div className="kpi-value">{value}</div>
                <div className="text-[10px] font-mono mt-1" style={{ color: 'rgba(244,238,223,0.35)' }}>{delta}</div>
              </div>
              <div className="space-y-1.5">
                <div className="progress-bar-sovereign">
                  <div className="progress-bar-sovereign-fill" style={{ width: `${barWidth}%`, background: `linear-gradient(90deg, ${accent}80, ${accent})` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(244,238,223,0.25)' }}>Capacity</span>
                  <span className="text-[9px] font-bold font-mono" style={{ color: accent }}>{trend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick Action Tiles + Activity Feed ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Quick actions (2/3 width) */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: 'rgba(244,238,223,0.30)' }}>Action Queue</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_ACTIONS.map(({ label, href, count, icon: Icon, urgent, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="shell-card-dark quick-action-tile rounded-sm p-5 flex flex-col gap-4 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-sm flex items-center justify-center transition-all group-hover:scale-105" style={{ background: urgent ? 'rgba(196,154,78,0.15)' : 'rgba(196,154,78,0.08)', border: `1px solid ${urgent ? 'rgba(196,154,78,0.40)' : 'rgba(196,154,78,0.18)'}` }}>
                      <Icon className="w-5 h-5 text-gold" />
                    </div>
                    {urgent && (
                      <span className="text-[8px] font-extrabold px-2 py-1 rounded-sm tracking-wider" style={{ background: 'rgba(196,154,78,0.15)', border: '1px solid rgba(196,154,78,0.35)', color: '#C49A4E' }}>
                        URGENT
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold font-mono" style={{ color: '#F4EEDF' }}>{count}</div>
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(244,238,223,0.70)' }}>{label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(244,238,223,0.35)' }}>{desc}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold transition-all group-hover:gap-2" style={{ color: '#C49A4E' }}>
                    Review <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Activity feed (1/3 width) */}
          <div className="shell-card-dark rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(196,154,78,0.10)' }}>
              <h2 className="text-[12px] font-bold" style={{ color: '#F4EEDF' }}>Live Activity</h2>
              <Link href="/admin/activity" className="text-[10px] font-bold transition-colors flex items-center gap-1" style={{ color: 'rgba(196,154,78,0.60)' }}>
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 space-y-4">
              {RECENT_ACTIVITY.map(({ time, action, type }) => (
                <div key={time} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: type === 'success' ? '#3D8664' : type === 'warning' ? '#E4A628' : '#C49A4E' }}
                    />
                    <div className="w-px flex-1 mt-1" style={{ background: 'rgba(196,154,78,0.10)' }} />
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-[11px] leading-snug" style={{ color: 'rgba(244,238,223,0.65)' }}>{action}</p>
                    <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(244,238,223,0.28)' }}>{time} UTC</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Pending Registry Queue Table ── */}
        <div className={`shell-card-dark rounded-sm overflow-hidden transition-all duration-500 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(196,154,78,0.10)' }}>
            <div>
              <h2 className="text-[13px] font-extrabold" style={{ color: '#F4EEDF' }}>Pending Registry Queue</h2>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(196,154,78,0.55)' }}>{queue.length} awaiting action</p>
            </div>
            <Link
              href="/admin/citizens"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-bold transition-all"
              style={{ background: 'rgba(196,154,78,0.08)', border: '1px solid rgba(196,154,78,0.20)', color: '#C49A4E' }}
            >
              <FileSearch className="w-3.5 h-3.5" /> Full Registry
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(196,154,78,0.08)' }}>
                  {['App ID', 'Applicant / Entity', 'Type', 'Nationality', 'Date', 'Risk', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-extrabold tracking-[0.16em] uppercase" style={{ color: 'rgba(196,154,78,0.40)', fontSize: '9px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map(app => {
                  const rc = RISK_COLOR[app.risk] ?? RISK_COLOR.Low;
                  return (
                    <tr key={app.id} className="premium-tr group">
                      <td className="px-5 py-4 font-mono font-bold" style={{ color: '#C49A4E' }}>{app.id}</td>
                      <td className="px-5 py-4 font-semibold" style={{ color: '#F0E9D8' }}>{app.name}</td>
                      <td className="px-5 py-4" style={{ color: 'rgba(244,238,223,0.55)' }}>{app.type}</td>
                      <td className="px-5 py-4 font-mono font-bold" style={{ color: 'rgba(244,238,223,0.45)' }}>{app.nationality}</td>
                      <td className="px-5 py-4 font-mono" style={{ color: 'rgba(244,238,223,0.38)' }}>{app.date}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono" style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                          {app.risk} · {app.riskScore}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => approve(app.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold transition-all hover:scale-105"
                            style={{ background: 'rgba(61,134,100,0.12)', color: '#3D8664', border: '1px solid rgba(61,134,100,0.25)' }}>
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => reject(app.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold transition-all hover:scale-105"
                            style={{ background: 'rgba(112,24,36,0.12)', color: '#fca5a5', border: '1px solid rgba(112,24,36,0.25)' }}>
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                          <button className="p-1.5 rounded-sm transition-colors hover:bg-white/5"
                            style={{ color: 'rgba(244,238,223,0.30)' }}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {queue.length === 0 && (
            <div className="py-14 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3" style={{ color: '#3D8664' }} />
              <p className="text-sm font-bold" style={{ color: 'rgba(244,238,223,0.55)' }}>Queue Cleared</p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(244,238,223,0.28)' }}>All applications have been processed</p>
            </div>
          )}
        </div>

      </div>
    </AdminShell>
  );
}
