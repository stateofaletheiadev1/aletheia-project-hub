'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import { api, reload, useApi } from '@/lib/client/api';
import { ListState, Notice } from '@/components/admin/Notice';
import {
  AlertTriangle,
  Scale,
  Gavel,
  X,
} from 'lucide-react';

interface RescissionCase {
  id: string;
  reference: string;
  citizenName: string;
  nationalId: string;
  basis: 'Voluntary Renunciation' | 'Fraudulent Acquisition' | 'Covenant Treason / Sanction' | 'Dual Allegiance Conflict';
  stage: 'Hearing Scheduled' | 'Evidence Review' | 'Judicial Finality';
  dossierRef: string;
  initiatedDate: string;
  status: 'Active Proceeding' | 'Rescinded' | 'Dismissed';
}

const PATH = '/api/admin/rescissions';
const BASES: RescissionCase['basis'][] = ['Voluntary Renunciation', 'Fraudulent Acquisition', 'Covenant Treason / Sanction', 'Dual Allegiance Conflict'];
const STAGES: RescissionCase['stage'][] = ['Hearing Scheduled', 'Evidence Review', 'Judicial Finality'];
const noopSubscribe = () => () => {};

export default function CitizenshipRescissionsPage() {
  const { data, error, loading } = useApi<{ cases: RescissionCase[] }>(PATH);
  const cases = data?.cases ?? [];
  const [selectedCase, setSelectedCase] = useState<RescissionCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // A citizen's dossier links here with ?nationalId=… to start a proceeding.
  const search = useSyncExternalStore(noopSubscribe, () => window.location.search, () => '');
  const [form, setForm] = useState<{ nationalId: string | null; basis: RescissionCase['basis']; stage: RescissionCase['stage']; dossierRef: string }>({ nationalId: null, basis: BASES[0], stage: STAGES[0], dossierRef: '' });
  const nationalId = form.nationalId ?? new URLSearchParams(search).get('nationalId') ?? '';

  const refresh = () => Promise.all([reload(PATH), reload('/api/admin/citizens')]);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { case: c } = await api<{ case: { reference: string } }>(PATH, { body: { ...form, nationalId } });
      setNotice({ ok: true, text: `Proceeding ${c.reference} opened for ${nationalId}. The citizen is now under review.` });
      setForm({ nationalId: '', basis: BASES[0], stage: STAGES[0], dossierRef: '' });
      await refresh();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'The proceeding could not be opened.' });
    }
    setBusy(false);
  };

  const decide = async (c: RescissionCase, decision: 'rescind' | 'dismiss') => {
    setBusy(true);
    try {
      await api(`${PATH}/${c.id}/decision`, { body: { decision } });
      setNotice({ ok: true, text: decision === 'rescind' ? `Citizenship rescinded for ${c.citizenName}.` : `Proceeding dismissed for ${c.citizenName}. Citizenship status reaffirmed.` });
      setSelectedCase(null);
      await refresh();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'The decision could not be saved.' });
    }
    setBusy(false);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">Citizenship Rescissions &amp; Renunciations</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-red-950/80 text-red-200 border border-red-700/50">
                High Court Docket
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Due Process &amp; Deprivation Proceedings under Constitution Article 9 · High Court of Aletheia
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/citizens"
              className="px-3 py-1.5 rounded-sm bg-navy-deep border border-gold/25 text-parchment/70 hover:text-parchment text-xs font-mono transition-colors"
            >
              Citizen Registry →
            </Link>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-4 rounded-sm bg-red-950/40 border border-red-700/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-red-200">Statutory Deprivation Limitation</h4>
            <p className="text-red-200/70 font-light leading-relaxed">
              In accordance with Article 9, § 2 of the Covenant, no rescission may result in statelessness. All involuntary proceedings require unanimous certification by the High Court and a mandatory 30-day evidentiary notice.
            </p>
          </div>
        </div>

        <Notice notice={notice} />

        {/* Open a proceeding */}
        <form onSubmit={open} className="p-4 rounded-sm grid grid-cols-1 md:grid-cols-5 gap-3 items-end text-xs font-mono" style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.15)' }}>
          <label className="space-y-1 block">
            <span className="text-parchment/50">National ID</span>
            <input required value={nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="ALE-NAT-2026-000001" className="w-full bg-navy-deep border border-gold/20 rounded-sm px-2 py-1.5 text-parchment" />
          </label>
          <label className="space-y-1 block">
            <span className="text-parchment/50">Basis</span>
            <select value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value as RescissionCase['basis'] })} className="w-full bg-navy-deep border border-gold/20 rounded-sm px-2 py-1.5 text-parchment">
              {BASES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="text-parchment/50">Stage</span>
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as RescissionCase['stage'] })} className="w-full bg-navy-deep border border-gold/20 rounded-sm px-2 py-1.5 text-parchment">
              {STAGES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="text-parchment/50">Dossier reference</span>
            <input required value={form.dossierRef} onChange={(e) => setForm({ ...form, dossierRef: e.target.value })} placeholder="DOS-2026-0001" className="w-full bg-navy-deep border border-gold/20 rounded-sm px-2 py-1.5 text-parchment" />
          </label>
          <button disabled={busy} className="px-3 py-2 rounded-sm bg-red-900/70 border border-red-700/50 text-red-100 font-bold hover:bg-red-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Gavel className="w-3.5 h-3.5" /> Open Proceeding
          </button>
        </form>

        {/* Rescission Docket Table */}
        <div
          className="rounded-sm overflow-hidden"
          style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.15)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead style={{ background: '#0E1B31', borderBottom: '1px solid rgba(196,154,78,0.15)' }}>
                <tr className="text-parchment/50 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Case Docket</th>
                  <th className="py-3 px-4">Citizen Name</th>
                  <th className="py-3 px-4">Statutory Basis</th>
                  <th className="py-3 px-4">Procedural Stage</th>
                  <th className="py-3 px-4">Filing Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold">{c.reference}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-parchment font-sans">{c.citizenName}</div>
                      <div className="text-[10px] text-parchment/40">{c.nationalId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-parchment/80">{c.basis}</td>
                    <td className="py-3.5 px-4 text-parchment/60 flex items-center gap-1.5 mt-2">
                      <Scale className="w-3.5 h-3.5 text-gold/60" />
                      <span>{c.stage}</span>
                    </td>
                    <td className="py-3.5 px-4 text-parchment/50">{c.initiatedDate}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          c.status === 'Active Proceeding'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : c.status === 'Rescinded'
                            ? 'bg-red-950 text-red-300 border border-red-700/60'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedCase(c)}
                        className="px-2.5 py-1 rounded-sm bg-navy-deep border border-gold/20 text-gold hover:bg-gold/10 transition-colors text-[11px]"
                      >
                        Manage Docket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListState loading={loading} error={error} empty={cases.length === 0} emptyText="No rescission proceedings are on the docket." />
          </div>
        </div>

        {/* Modal */}
        {selectedCase && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-sm p-6 space-y-5"
              style={{ background: '#0E1B31', border: '1px solid rgba(196,154,78,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
            >
              <div className="flex items-center justify-between border-b border-gold/20 pb-3">
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-gold" />
                  <span className="font-bold text-parchment text-sm">Deprivation Case Docket {selectedCase.reference}</span>
                </div>
                <button aria-label="Close" onClick={() => setSelectedCase(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <span className="text-[10px] text-parchment/40 uppercase block">SUBJECT INDIVIDUAL</span>
                  <div className="text-base font-bold text-parchment font-sans">{selectedCase.citizenName}</div>
                  <div className="text-gold text-[11px]">{selectedCase.nationalId}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Basis of Proceeding:</span>
                    <span className="text-parchment font-bold">{selectedCase.basis}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Court Procedural Stage:</span>
                    <span className="text-gold font-bold">{selectedCase.stage}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Evidentiary Dossier Reference:</span>
                    <span className="text-parchment font-mono">{selectedCase.dossierRef}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Opened:</span>
                    <span className="text-parchment">{selectedCase.initiatedDate}</span>
                  </div>
                  <p className="pt-2 text-parchment/50 leading-relaxed">Only administrators can execute or dismiss. Confirm that the statelessness check (Article 9, § 2) has been made before executing.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                {selectedCase.status === 'Active Proceeding' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => decide(selectedCase, 'dismiss')}
                      className="px-3 py-1.5 bg-navy-deep border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-sm hover:bg-emerald-950/40"
                    >
                      Dismiss Case &amp; Affirm
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => decide(selectedCase, 'rescind')}
                      className="px-4 py-1.5 bg-red-900 text-white font-bold text-xs font-mono rounded-sm hover:bg-red-800"
                    >
                      Execute Rescission Order
                    </button>
                  </>
                )}
                {selectedCase.status !== 'Active Proceeding' && (
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="px-4 py-1.5 bg-gold text-navy font-bold text-xs rounded-sm hover:bg-gold-tint"
                  >
                    Close Docket
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
