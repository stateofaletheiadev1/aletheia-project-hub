'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { CheckCircle2, Eye, X, XCircle, type LucideIcon } from 'lucide-react';
import { api, reload, useApi } from '@/lib/client/api';
import { ADMIN_DASHBOARD } from '@/components/layout/AdminShell';
import { fmtDate, ListState, Notice } from './Notice';

export interface AdminApplication {
  id: string;
  reference: string;
  type: 'e-residency' | 'citizenship';
  route: 'e-residency' | 'naturalisation' | 'investor';
  investOption: string | null;
  applicant: string;
  email: string;
  nationality: string;
  dob: string;
  passportNumber: string;
  purpose: string;
  intendedEntity: string;
  publicKey: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  kycStatus: 'Verified' | 'Pending Verification' | 'Manual Inspection';
  documentCount: number;
}

const ROUTE_LABEL: Record<AdminApplication['route'], string> = {
  'e-residency': 'E-Residency',
  naturalisation: 'Naturalisation by residence',
  investor: 'Covenant Investor',
};

export function ApplicationQueue(props: {
  type: 'e-residency' | 'citizenship';
  title: string;
  subtitle: string;
  icon: LucideIcon;
  approveLabel: string;
  related: { href: string; label: string };
}) {
  const path = `/api/admin/applications?type=${props.type}`;
  const { data, error, loading } = useApi<{ applications: AdminApplication[] }>(path);
  const apps = data?.applications ?? [];
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const Icon = props.icon;

  const decide = async (app: AdminApplication, decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await api(`/api/admin/applications/${app.id}/decision`, { body: { decision, note } });
      setNotice({ ok: true, text: `${app.reference} ${decision === 'approve' ? 'approved' : 'rejected'} for ${app.applicant}. The applicant has been notified.` });
      setSelected(null);
      setNote('');
      await Promise.all([reload(path), reload(ADMIN_DASHBOARD)]);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'The decision could not be saved.' });
    }
    setBusy(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-parchment">{props.title}</h1>
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-gold/20 text-gold border border-gold/30">
              {apps.filter((a) => a.status === 'Pending').length} Pending
            </span>
          </div>
          <p className="text-[12px] text-parchment/50 font-mono mt-0.5">{props.subtitle}</p>
        </div>
        <Link href={props.related.href} className="px-3 py-1.5 rounded-sm bg-navy-deep border border-gold/25 text-parchment/70 hover:text-parchment text-xs font-mono transition-colors">
          {props.related.label} →
        </Link>
      </div>

      <Notice notice={notice} />
      <ListState loading={loading} error={error} empty={apps.length === 0} emptyText="No applications have been submitted yet." />

      <div className="grid grid-cols-1 gap-4">
        {apps.map((app) => (
          <div
            key={app.id}
            className="p-5 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
            style={{
              background: '#111827',
              border: app.status === 'Approved' ? '1px solid rgba(47,107,79,0.5)' : app.status === 'Rejected' ? '1px solid rgba(192,57,43,0.5)' : '1px solid rgba(196,154,78,0.2)',
            }}
          >
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-bold text-parchment font-sans">{app.applicant}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-navy-deep text-parchment/60 border border-white/5">{app.reference}</span>
                <span className="text-[10px] font-mono text-gold/80">{app.nationality}</span>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm ${app.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : app.status === 'Rejected' ? 'bg-red-500/20 text-red-400' : 'bg-gold/20 text-gold'}`}>
                  {app.status.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-mono text-parchment/60">
                <span>Route: <strong className="text-parchment/80">{ROUTE_LABEL[app.route]}</strong></span>
                <span>Purpose: <strong className="text-parchment/80">{app.purpose}</strong></span>
                <span>Filed: <strong className="text-parchment/80">{fmtDate(app.submittedAt)}</strong></span>
                <span>
                  KYC:{' '}
                  <strong className={app.kycStatus === 'Verified' ? 'text-emerald-400' : app.kycStatus === 'Manual Inspection' ? 'text-red-400' : 'text-amber-400'}>
                    {app.kycStatus} ({app.documentCount} doc{app.documentCount === 1 ? '' : 's'})
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { setSelected(app); setNote(''); }} className="px-3 py-1.5 rounded-sm bg-navy-deep border border-gold/20 text-gold text-xs font-mono hover:bg-gold/10 transition-colors flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Details
              </button>
              {app.status === 'Pending' && (
                <>
                  <button disabled={busy} onClick={() => decide(app, 'approve')} className="px-3.5 py-1.5 rounded-sm bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-colors flex items-center gap-1 disabled:opacity-50">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {props.approveLabel}
                  </button>
                  <button disabled={busy} onClick={() => { setSelected(app); setNote(''); }} className="px-3 py-1.5 rounded-sm bg-red-900/60 border border-red-700/50 text-red-200 text-xs hover:bg-red-800 transition-colors flex items-center gap-1 disabled:opacity-50">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${selected.reference} review`}>
          <div className="w-full max-w-lg rounded-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: '#0E1B31', border: '1px solid rgba(196,154,78,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <div className="flex items-center justify-between border-b border-gold/20 pb-3">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-gold" />
                <span className="font-bold text-parchment text-sm">Application Review · {selected.reference}</span>
              </div>
              <button aria-label="Close" onClick={() => setSelected(null)} className="text-parchment/40 hover:text-parchment">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                <div className="text-sm font-bold text-parchment font-sans">{selected.applicant}</div>
                <div className="text-[11px] text-gold/80">{ROUTE_LABEL[selected.route]}{selected.investOption ? ` · ${selected.investOption}` : ''} · {selected.nationality}</div>
                <div className="text-[10px] text-parchment/40">Filed on {fmtDate(selected.submittedAt)} · {selected.email}</div>
              </div>
              <div className="space-y-2">
                {[
                  ['Date of birth', selected.dob],
                  ['Foreign passport', selected.passportNumber],
                  ['Purpose', selected.purpose],
                  ['Intended entity', selected.intendedEntity || '—'],
                  ['Know-your-customer', `${selected.kycStatus} (${selected.documentCount} submitted)`],
                  ['Ed25519 public key', `${selected.publicKey.slice(0, 16)}…${selected.publicKey.slice(-8)}`],
                  ...(selected.decidedAt ? [['Decided', `${fmtDate(selected.decidedAt)}${selected.decisionNote ? ` · ${selected.decisionNote}` : ''}`]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-1 border-b border-white/5">
                    <span className="text-parchment/40">{k}:</span>
                    <span className="text-parchment font-bold text-right break-all">{v}</span>
                  </div>
                ))}
              </div>
              {selected.status === 'Pending' && (
                <div className="space-y-1">
                  <label htmlFor="decision-note" className="text-parchment/50">Note to the applicant (required reason when rejecting is recommended)</label>
                  <textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="w-full bg-navy-deep border border-gold/20 rounded-sm p-2 text-parchment text-xs" />
                </div>
              )}
              <Link href="/admin/documents" className="inline-block text-gold/80 hover:text-gold">Review the applicant’s documents →</Link>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
              {selected.status === 'Pending' ? (
                <>
                  <button disabled={busy} onClick={() => decide(selected, 'reject')} className="px-3 py-1.5 bg-red-950/60 border border-red-700/50 text-red-200 text-xs font-mono rounded-sm hover:bg-red-900/60 disabled:opacity-50">
                    Reject
                  </button>
                  <button disabled={busy} onClick={() => decide(selected, 'approve')} className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500 disabled:opacity-50">
                    {props.approveLabel}
                  </button>
                </>
              ) : (
                <button onClick={() => setSelected(null)} className="px-4 py-1.5 bg-gold text-navy font-bold text-xs rounded-sm hover:bg-gold-tint">
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
