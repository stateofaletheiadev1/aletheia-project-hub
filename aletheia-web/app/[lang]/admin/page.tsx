'use client';

import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell, ADMIN_DASHBOARD, type AdminDashboard } from '@/components/layout/AdminShell';
import { api, useApi } from '@/lib/client/api';
import {
  Users,
  UserCheck,
  Building2,
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

const STAT_DEFS = [
  { key: 'citizens', label: 'Total Citizens', sub: 'Active in the citizen registry', icon: Users, accent: '#C49A4E' },
  { key: 'pending', label: 'Pending Approvals', sub: 'Applications, filings and documents', icon: Clock, accent: '#E4A628' },
  { key: 'companies', label: 'Companies Registered', sub: 'Chartered in the commercial register', icon: Building2, accent: '#3D8664' },
  { key: 'eResidents', label: 'E-Residents', sub: 'Holding a valid e-residency', icon: Globe2, accent: '#8B5CF6' },
] as const;

const ACTION_DEFS = [
  { key: 'citizenship', label: 'Citizenship Approvals', href: '/admin/citizenship', icon: UserCheck, desc: 'Applications pending review' },
  { key: 'documents', label: 'Document Review', href: '/admin/documents', icon: FileSearch, desc: 'Submitted documents to verify' },
  { key: 'eResidency', label: 'E-Residency Queue', href: '/admin/e-residency', icon: Globe2, desc: 'Digital identity applications' },
  { key: 'companies', label: 'Company Formations', href: '/admin/companies', icon: Building2, desc: 'Corporate registry submissions' },
] as const;

const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export default function AdminCommandConsolePage() {
  const { data, error, reload } = useApi<AdminDashboard>(ADMIN_DASHBOARD);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  const queue = data?.queue ?? [];
  const maxStat = Math.max(1, ...STAT_DEFS.map(({ key }) => data?.stats[key] ?? 0));

  const decide = async (row: AdminDashboard['queue'][number], approve: boolean) => {
    setBusy(row.id);
    setNotice(null);
    try {
      if (row.kind === 'application') await api(`/api/admin/applications/${row.id}/decision`, { body: { decision: approve ? 'approve' : 'reject' } });
      else if (approve) await api(`/api/admin/companies/${row.id}/decision`, { body: { decision: 'approve' } });
      setNotice(`${row.reference} ${approve ? 'approved' : 'rejected'}.`);
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The decision could not be saved.');
    }
    setBusy(null);
  };

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
            <span className="font-bold tracking-wide">{error ? error.message : data ? 'Registry database connected' : 'Connecting…'}</span>
          </div>
        </div>

        {/* ── KPI Stat Cards ── */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-500 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {STAT_DEFS.map(({ key, label, sub: delta, icon: Icon, accent }) => {
            const n = data?.stats[key];
            const value = n === undefined ? '—' : n.toLocaleString('en-GB');
            const barWidth = n === undefined ? 0 : Math.round((n / maxStat) * 100);
            return (
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
              </div>
            </div>
            );
          })}
        </div>

        {/* ── Quick Action Tiles + Activity Feed ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Quick actions (2/3 width) */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: 'rgba(244,238,223,0.30)' }}>Action Queue</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACTION_DEFS.map(({ key, label, href, icon: Icon, desc }) => {
                const count = data?.pending[key] ?? 0;
                const urgent = count > 0;
                return (
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
                        WAITING
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
                );
              })}
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
              {(data?.activity ?? []).length === 0 && (
                <p className="text-[11px]" style={{ color: 'rgba(244,238,223,0.35)' }}>No activity recorded yet.</p>
              )}
              {(data?.activity ?? []).map(({ time: at, action, type }) => (
                <div key={at + action} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: type === 'success' ? '#3D8664' : type === 'warning' ? '#E4A628' : '#C49A4E' }}
                    />
                    <div className="w-px flex-1 mt-1" style={{ background: 'rgba(196,154,78,0.10)' }} />
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-[11px] leading-snug" style={{ color: 'rgba(244,238,223,0.65)' }}>{action}</p>
                    <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(244,238,223,0.28)' }}>{time(at)} UTC</p>
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
              <p className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(196,154,78,0.55)' }}>{queue.length} awaiting action{notice ? ` · ${notice}` : ''}</p>
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
                  {['Reference', 'Applicant / Entity', 'Type', 'Nationality', 'Submitted', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-extrabold tracking-[0.16em] uppercase" style={{ color: 'rgba(196,154,78,0.40)', fontSize: '9px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map(app => {
                  const reviewHref = app.kind === 'company' ? '/admin/companies' : app.type === 'E-Residency' ? '/admin/e-residency' : '/admin/citizenship';
                  return (
                    <tr key={app.id} className="premium-tr group">
                      <td className="px-5 py-4 font-mono font-bold" style={{ color: '#C49A4E' }}>{app.reference}</td>
                      <td className="px-5 py-4 font-semibold" style={{ color: '#F0E9D8' }}>{app.name}</td>
                      <td className="px-5 py-4" style={{ color: 'rgba(244,238,223,0.55)' }}>{app.type}</td>
                      <td className="px-5 py-4 font-mono font-bold" style={{ color: 'rgba(244,238,223,0.45)' }}>{app.nationality}</td>
                      <td className="px-5 py-4 font-mono" style={{ color: 'rgba(244,238,223,0.38)' }}>{time(app.date)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button disabled={busy === app.id} onClick={() => decide(app, true)} className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold transition-all hover:scale-105"
                            style={{ background: 'rgba(61,134,100,0.12)', color: '#3D8664', border: '1px solid rgba(61,134,100,0.25)' }}>
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          {app.kind === 'application' && <button disabled={busy === app.id} onClick={() => decide(app, false)} className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold transition-all hover:scale-105"
                            style={{ background: 'rgba(112,24,36,0.12)', color: '#fca5a5', border: '1px solid rgba(112,24,36,0.25)' }}>
                            <XCircle className="w-3 h-3" /> Reject
                          </button>}
                          <Link href={reviewHref} aria-label={`Review ${app.reference}`} className="p-1.5 rounded-sm transition-colors hover:bg-white/5"
                            style={{ color: 'rgba(244,238,223,0.30)' }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
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
