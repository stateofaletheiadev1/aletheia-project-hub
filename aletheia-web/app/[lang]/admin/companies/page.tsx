'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell, ADMIN_DASHBOARD } from '@/components/layout/AdminShell';
import { api, reload, useApi } from '@/lib/client/api';
import type { CompanyRecord } from '@/lib/auth';
import { fmtDate, ListState, Notice } from '@/components/admin/Notice';
import { Building2, X } from 'lucide-react';

const PATH = '/api/admin/companies';

export default function AdminCompanyFormationsPage() {
  const { data, error, loading } = useApi<{ companies: CompanyRecord[] }>(PATH);
  const companies = data?.companies ?? [];
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const decide = async (c: CompanyRecord, decision: 'approve' | 'request-changes') => {
    setBusy(true);
    try {
      await api(`/api/admin/companies/${c.id}/decision`, { body: { decision, note } });
      setNotice({ ok: true, text: decision === 'approve' ? `Charter ratified for ${c.name}. Commercial Register certificate issued to the founder.` : `Changes requested from the founder of ${c.name}.` });
      setSelectedCompany(null);
      setNote('');
      await Promise.all([reload(PATH), reload(ADMIN_DASHBOARD)]);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'The decision could not be saved.' });
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
              <h1 className="text-xl font-bold text-parchment">Commercial Registry &amp; Incorporations</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {companies.filter((c) => c.status === 'Active / Chartered').length} Registered Entities
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Registrar of Companies · Ministry of Digital State &amp; Commercial Code § 11
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-sm bg-navy-deep border border-gold/25 text-parchment/70 hover:text-parchment text-xs font-mono transition-colors"
            >
              Command Overview →
            </Link>
          </div>
        </div>

        <Notice notice={notice} />

        {/* Company Table */}
        <div
          className="rounded-sm overflow-hidden"
          style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.15)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead style={{ background: '#0E1B31', borderBottom: '1px solid rgba(196,154,78,0.15)' }}>
                <tr className="text-parchment/50 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Registration #</th>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Structure</th>
                  <th className="py-3 px-4">Founding Applicant</th>
                  <th className="py-3 px-4">Capital (AEY)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold">{c.regNumber}</td>
                    <td className="py-3.5 px-4 font-bold text-parchment font-sans">{c.name}</td>
                    <td className="py-3.5 px-4 text-parchment/70">{c.structure}</td>
                    <td className="py-3.5 px-4 text-parchment/80">{c.founder}</td>
                    <td className="py-3.5 px-4 text-gold font-bold">{c.shareCapital.toLocaleString('en-GB')}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          c.status === 'Active / Chartered'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : c.status === 'Changes Requested'
                            ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => { setSelectedCompany(c); setNote(''); }}
                        className="px-2.5 py-1 rounded-sm bg-navy-deep border border-gold/25 text-gold hover:bg-gold/10 text-[11px]"
                      >
                        Inspect Charter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListState loading={loading} error={error} empty={companies.length === 0} emptyText="No company formations have been filed yet." />
          </div>
        </div>

        {/* Modal */}
        {selectedCompany && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-sm p-6 space-y-5"
              style={{ background: '#0E1B31', border: '1px solid rgba(196,154,78,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
            >
              <div className="flex items-center justify-between border-b border-gold/20 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gold" />
                  <span className="font-bold text-parchment text-sm">Commercial Entity Dossier</span>
                </div>
                <button aria-label="Close" onClick={() => setSelectedCompany(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <div className="text-base font-bold text-parchment font-sans">{selectedCompany.name}</div>
                  <div className="text-gold text-[11px]">{selectedCompany.regNumber} · {selectedCompany.structure}</div>
                  <div className="text-[10px] text-parchment/40">Filed on {fmtDate(selectedCompany.submittedAt)} by {selectedCompany.founder}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Registered Capital Deposit:</span>
                    <span className="text-gold font-bold">{selectedCompany.shareCapital.toLocaleString('en-GB')} AEY</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Ultimate Beneficial Owners:</span>
                    <span className="text-parchment font-bold">{selectedCompany.beneficialOwners}</span>
                  </div>
                  <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                    <span className="text-parchment/40">Purpose:</span>
                    <span className="text-parchment text-right">{selectedCompany.purpose}</span>
                  </div>
                  {selectedCompany.note && (
                    <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                      <span className="text-parchment/40">Registrar note:</span>
                      <span className="text-amber-300 text-right">{selectedCompany.note}</span>
                    </div>
                  )}
                </div>
                {selectedCompany.status === 'Pending Review' && (
                  <div className="space-y-1">
                    <label htmlFor="company-note" className="text-parchment/50">Note to the founder (required when requesting changes)</label>
                    <textarea id="company-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="w-full bg-navy-deep border border-gold/20 rounded-sm p-2 text-parchment text-xs" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                {selectedCompany.status === 'Pending Review' ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => decide(selectedCompany, 'request-changes')}
                      className="px-3 py-1.5 bg-red-950/60 border border-red-700/50 text-red-200 text-xs font-mono rounded-sm hover:bg-red-900/60 disabled:opacity-50"
                    >
                      Request Changes
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => decide(selectedCompany, 'approve')}
                      className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Ratify Charter &amp; Issue Certificate
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedCompany(null)}
                    className="px-4 py-1.5 bg-gold text-navy font-bold text-xs rounded-sm hover:bg-gold-tint"
                  >
                    Close Dossier
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
