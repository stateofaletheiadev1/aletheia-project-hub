'use client';

import React, { useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  CheckCircle2,
  FileText,
  X,
  Stamp,
} from 'lucide-react';

interface DocItem {
  id: string;
  name: string;
  applicant: string;
  docType: 'Biometric Passport Scan' | 'Articles of Association' | 'Apostille Certificate' | 'Police Clearance';
  hash: string;
  uploadedAt: string;
  status: 'Verified' | 'Pending Review' | 'Flagged';
}

const INITIAL_DOCS: DocItem[] = [
  {
    id: 'DOC-9081',
    name: 'passport_mrtd_dr_elena.pdf',
    applicant: 'Dr. Elena Vasquez',
    docType: 'Biometric Passport Scan',
    hash: '60847173…7c48',
    uploadedAt: '2026-10-01',
    status: 'Verified',
  },
  {
    id: 'DOC-9082',
    name: 'kaelen_marine_sarl_charter.pdf',
    applicant: 'Kaelen Vance',
    docType: 'Articles of Association',
    hash: '57d4e330…2849',
    uploadedAt: '2026-09-28',
    status: 'Verified',
  },
  {
    id: 'DOC-9083',
    name: 'apostille_hague_de_vries.pdf',
    applicant: 'Julian De Vries',
    docType: 'Apostille Certificate',
    hash: 'd05c5630…6e3b',
    uploadedAt: '2026-09-27',
    status: 'Pending Review',
  },
  {
    id: 'DOC-9084',
    name: 'police_clearance_sokolov.pdf',
    applicant: 'Dmitri V. Sokolov',
    docType: 'Police Clearance',
    hash: 'fc77ef9f…9fcc',
    uploadedAt: '2026-09-25',
    status: 'Pending Review',
  },
];

export default function AdminDocumentsReviewPage() {
  const [docs, setDocs] = useState<DocItem[]>(INITIAL_DOCS);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const verifyDoc = (id: string, name: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'Verified' } : d))
    );
    setNotice(`Document ${name} verified and sovereign digital seal applied.`);
    setTimeout(() => setNotice(null), 4000);
    if (selectedDoc?.id === id) setSelectedDoc(null);
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

        {notice && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-sm text-xs font-mono text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

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
                    <td className="py-3.5 px-4 font-bold text-gold">{d.id}</td>
                    <td className="py-3.5 px-4 font-bold text-parchment font-sans flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gold/70" />
                      <span>{d.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-parchment/80">{d.applicant}</td>
                    <td className="py-3.5 px-4 text-parchment/60">{d.docType}</td>
                    <td className="py-3.5 px-4 text-gold/80 font-mono text-[11px]">{d.hash}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          d.status === 'Verified'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedDoc(d)}
                        className="px-2.5 py-1 rounded-sm bg-navy-deep border border-gold/25 text-gold hover:bg-gold/10 text-[11px]"
                      >
                        Examine
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <button onClick={() => setSelectedDoc(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <div className="text-sm font-bold text-parchment">{selectedDoc.name}</div>
                  <div className="text-gold text-[11px]">{selectedDoc.docType} · {selectedDoc.applicant}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Ledger Immutability Proof:</span>
                    <span className="text-emerald-400 font-bold">Valid Root Anchor</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Timestamp of Submission:</span>
                    <span className="text-parchment">{selectedDoc.uploadedAt} 14:02 UTC</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Cryptographic Hash:</span>
                    <span className="text-gold font-mono">{selectedDoc.hash}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                {selectedDoc.status !== 'Verified' ? (
                  <button
                    onClick={() => verifyDoc(selectedDoc.id, selectedDoc.name)}
                    className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500 flex items-center gap-1.5"
                  >
                    <Stamp className="w-3.5 h-3.5" />
                    <span>Apply Sovereign Notary Stamp</span>
                  </button>
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
