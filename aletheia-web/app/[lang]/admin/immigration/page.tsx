'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import { api, ApiError } from '@/lib/client/api';
import { Notice } from '@/components/admin/Notice';
import { AlertTriangle, CheckCircle2, ScanLine, Search, XCircle } from 'lucide-react';

interface Traveller {
  passportNumber: string;
  name: string;
  nationalId: string;
  dob: string;
  nationality: string;
  documentType: string;
  status: 'CLEARED' | 'FLAGGED';
  permitType: string;
  history: { decision: 'CLEARED' | 'FLAGGED'; officer: string; at: string }[];
}

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';

export default function ImmigrationTerminalPage() {
  const [queryInput, setQueryInput] = useState('');
  const [looked, setLooked] = useState<string | null>(null);
  const [record, setRecord] = useState<Traveller | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const lookup = async (passport: string) => {
    const { traveller } = await api<{ traveller: Traveller | null }>(`/api/admin/immigration?passport=${encodeURIComponent(passport)}`);
    setRecord(traveller);
    setLooked(passport.toUpperCase());
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await lookup(queryInput.trim());
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : 'The registry could not be reached.' });
    }
    setBusy(false);
  };

  const handleGateAction = async (decision: 'CLEARED' | 'FLAGGED') => {
    if (!looked) return;
    setBusy(true);
    try {
      await api('/api/admin/immigration', { body: { passportNumber: looked, decision } });
      setNotice({ ok: decision === 'CLEARED', text: decision === 'CLEARED' ? `${looked} cleared. Entry recorded in the border register.` : `${looked} sent to secondary inspection. Recorded in the border register.` });
      await lookup(looked);
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : 'The decision could not be recorded.' });
    }
    setBusy(false);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gold/15 pb-5">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-parchment">Border Control Terminal</h1>
            <p className="text-xs text-parchment/60 font-mono">Check a passport against the citizen registry and record the entry decision</p>
          </div>
          <Link href="/admin" className="px-3.5 py-1.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors font-mono">
            Command Overview →
          </Link>
        </div>

        <Notice notice={notice} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <label htmlFor="passport-query" className="text-xs font-bold text-navy uppercase tracking-wider block">Passport number</label>
              <form onSubmit={handleScan} className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="passport-query"
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="e.g. ALE-000001"
                    className="w-full pl-9 pr-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono text-navy"
                  />
                </div>
                <button type="submit" disabled={busy} className="px-5 py-2 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5 disabled:opacity-50">
                  <Search className="w-3.5 h-3.5" /> Check Registry
                </button>
              </form>
              <p className="text-[11px] text-navy/60 font-mono">Aletheia passports are issued when citizenship is granted. Foreign documents are not in this registry.</p>
            </div>

            {looked && (
              <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-start border-b border-navy/10 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gold block">Inspection Dossier</span>
                    <h2 className="text-xl font-bold text-navy">{record ? record.name : 'No registry record'}</h2>
                    <span className="text-xs text-navy/60 font-mono">{record ? record.nationality : `${looked} is not an Aletheia passport on record`}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-sm text-xs font-bold font-mono ${record?.status === 'CLEARED' ? 'bg-laurel/15 text-laurel border border-laurel/30' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                    {record ? record.status : 'NOT FOUND'}
                  </span>
                </div>

                {record && (
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {[
                      ['Passport number', record.passportNumber],
                      ['National ID', record.nationalId],
                      ['Date of birth', record.dob],
                      ['Entry authority', record.permitType],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[10px] font-mono text-navy/50 uppercase block">{k}:</span>
                        <strong className="text-navy font-mono">{v}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-navy/10 flex flex-wrap gap-3">
                  <button disabled={busy || !record || record.status !== 'CLEARED'} onClick={() => handleGateAction('CLEARED')} className="flex-1 py-2.5 bg-laurel text-parchment font-bold text-xs uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-40">
                    <CheckCircle2 className="w-4 h-4" /> Grant Clearance
                  </button>
                  <button disabled={busy} onClick={() => handleGateAction('FLAGGED')} className="py-2.5 px-4 bg-red-800 text-parchment font-bold text-xs uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-40">
                    <AlertTriangle className="w-4 h-4" /> Secondary Inspection
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Registry Checks</h3>
              <ul className="space-y-3 text-xs">
                {[
                  ['Passport on the citizen registry', Boolean(record)],
                  ['Citizenship active (not under review or rescinded)', record?.status === 'CLEARED'],
                ].map(([label, ok]) => (
                  <li key={String(label)} className="flex items-center justify-between p-2.5 bg-parchment-light rounded-sm">
                    <span className="text-navy">{label}</span>
                    {looked ? (
                      <span className={`font-mono font-bold flex items-center gap-1 ${ok ? 'text-laurel' : 'text-red-700'}`}>
                        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} {ok ? 'YES' : 'NO'}
                      </span>
                    ) : (
                      <span className="font-mono text-navy/40">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Recent Decisions for this Passport</h3>
              <div className="space-y-3 font-mono text-xs divide-y divide-navy/10">
                {(record?.history ?? []).length === 0 && <p className="text-navy/50">No crossings recorded.</p>}
                {(record?.history ?? []).map((h) => (
                  <div key={h.at} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                    <span className="text-navy">{when(h.at)} · {h.officer}</span>
                    <span className={`font-bold text-[11px] ${h.decision === 'CLEARED' ? 'text-laurel' : 'text-red-700'}`}>{h.decision}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
