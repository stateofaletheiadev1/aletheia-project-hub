'use client';

import React, { useState } from 'react';
import { AdminShell, ADMIN_DASHBOARD } from '@/components/layout/AdminShell';
import { api, reload, useApi } from '@/lib/client/api';
import { shortHash, type PortalDocument } from '@/lib/auth';
import { ListState, Notice } from '@/components/admin/Notice';
import {
  Download,
  FileText,
  X,
  Stamp,
} from 'lucide-react';

const PATH = '/api/admin/documents';
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function AdminDocumentsReviewPage() {
  const { data, error, loading } = useApi<{ documents: PortalDocument[] }>(PATH);
  const docs = data?.documents ?? [];
  const [selectedDoc, setSelectedDoc] = useState<PortalDocument | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const decide = async (d: PortalDocument, decision: 'verify' | 'flag') => {
    setBusy(true);
    try {
      await api(`/api/admin/documents/${d.id}/decision`, { body: { decision, note } });
      setNotice({ ok: true, text: decision === 'verify' ? `${d.name} verified.` : `${d.name} flagged; the holder has been asked for a new copy.` });
      setSelectedDoc(null);
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
              <h1 className="text-xl font-bold text-parchment">Document Review &amp; Notary Terminal</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-gold/20 text-gold border border-gold/30">
                Apostille Registry
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Cryptographic verification of submitted civic &amp; corporate instruments · Hague Apostille § 8
            </p>
          </div>
        </div>

        <Notice notice={notice} />

        {/* Table */}
        <div
          className="rounded-sm overflow-hidden"
          style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.15)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead style={{ background: '#0E1B31', borderBottom: '1px solid rgba(196,154,78,0.15)' }}>
                <tr className="text-parchment/50 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Document ID</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Instrument Type</th>
                  <th className="py-3 px-4">Sha-256 Hash</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold">{d.reference}</td>
                    <td className="py-3.5 px-4 font-bold text-parchment font-sans flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gold/70" />
                      <span>{d.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-parchment/80">{d.holder}</td>
                    <td className="py-3.5 px-4 text-parchment/60">{d.type}</td>
                    <td className="py-3.5 px-4 text-gold/80 font-mono text-[11px]">{shortHash(d.hash)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          d.status === 'Verified'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : d.status === 'Flagged'
                            ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => { setSelectedDoc(d); setNote(''); }}
                        className="px-2.5 py-1 rounded-sm bg-navy-deep border border-gold/25 text-gold hover:bg-gold/10 text-[11px]"
                      >
                        Examine
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListState loading={loading} error={error} empty={docs.length === 0} emptyText="No documents have been submitted for review yet." />
          </div>
        </div>

        {/* Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-sm p-6 space-y-5"
              style={{ background: '#0E1B31', border: '1px solid rgba(196,154,78,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
            >
              <div className="flex items-center justify-between border-b border-gold/20 pb-3">
                <div className="flex items-center gap-2">
                  <Stamp className="w-5 h-5 text-gold" />
                  <span className="font-bold text-parchment text-sm">Document Verification Dossier</span>
                </div>
                <button aria-label="Close" onClick={() => setSelectedDoc(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <div className="text-sm font-bold text-parchment">{selectedDoc.name}</div>
                  <div className="text-gold text-[11px]">{selectedDoc.type} · {selectedDoc.holder}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Reference:</span>
                    <span className="text-parchment">{selectedDoc.reference}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Submitted:</span>
                    <span className="text-parchment">{new Date(selectedDoc.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">File:</span>
                    <span className="text-parchment">{selectedDoc.contentType} · {kb(selectedDoc.size)}</span>
                  </div>
                  <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                    <span className="text-parchment/40 shrink-0">SHA-256:</span>
                    <span className="text-gold font-mono break-all text-right">{selectedDoc.hash}</span>
                  </div>
                  {selectedDoc.reviewNote && (
                    <div className="flex justify-between gap-4 py-1 border-b border-white/5">
                      <span className="text-parchment/40">Review note:</span>
                      <span className="text-amber-300 text-right">{selectedDoc.reviewNote}</span>
                    </div>
                  )}
                </div>
                <a href={`/api/admin/documents/${selectedDoc.id}/file`} className="inline-flex items-center gap-1.5 text-gold/80 hover:text-gold">
                  <Download className="w-3.5 h-3.5" /> Download the submitted file (checked against its hash)
                </a>
                {selectedDoc.status === 'Pending Review' && (
                  <div className="space-y-1">
                    <label htmlFor="doc-note" className="text-parchment/50">Note to the holder (shown when flagging)</label>
                    <textarea id="doc-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="w-full bg-navy-deep border border-gold/20 rounded-sm p-2 text-parchment text-xs" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                {selectedDoc.status === 'Pending Review' ? (
                  <>
                  <button
                    disabled={busy}
                    onClick={() => decide(selectedDoc, 'flag')}
                    className="px-3 py-1.5 bg-red-950/60 border border-red-700/50 text-red-200 text-xs font-mono rounded-sm hover:bg-red-900/60 disabled:opacity-50"
                  >
                    Flag
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => decide(selectedDoc, 'verify')}
                    className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500 flex items-center gap-1.5"
                  >
                    <Stamp className="w-3.5 h-3.5" />
                    <span>Verify Document</span>
                  </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="px-4 py-1.5 bg-gold text-navy font-bold text-xs rounded-sm hover:bg-gold-tint"
                  >
                    Close
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
