'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { downloadPortalDocument } from '@/lib/pdf/portal';
import { api, reload, useApi } from '@/lib/client/api';
import { day, ME, shortHash, type CompanyRecord, type PortalAccount, type PortalDocument } from '@/lib/auth';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  FileText,
  Download,
  CheckCircle2,
  Stamp,
  X,
  Upload,
} from 'lucide-react';

const PATH = '/api/portal/documents';
const size = (n: number) => (n === 0 ? 'PDF' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function PortalDocumentsPage() {
  const { t, tx, intl } = useI18n();
  const me = useApi<{ account: PortalAccount }>(ME);
  const { data, loading } = useApi<{ documents: PortalDocument[] }>(PATH);
  const companies = useApi<{ companies: CompanyRecord[] }>('/api/portal/companies');
  const DOCUMENTS = data?.documents ?? [];
  const [selectedDoc, setSelectedDoc] = useState<PortalDocument | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState('Biometric Passport Scan');
  const [busy, setBusy] = useState(false);

  const flash = (text: string) => {
    setDownloadNotice(text);
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  const handleDownload = async (doc: PortalDocument) => {
    if (doc.direction === 'submitted') {
      // A plain link download: the browser sends the session cookie and saves the file.
      const a = document.createElement('a');
      a.href = `${PATH}/${doc.id}/file`;
      a.download = doc.name;
      a.click();
      return;
    }
    if (!doc.kind || !me.data) return;
    setDownloadNotice(t('Preparing PDF: {name}', { name: doc.name }));
    try {
      const company = companies.data?.companies.find((c) => c.id === doc.relatedId);
      await downloadPortalDocument(doc.kind, doc.name, me.data.account, doc, company);
      flash(t('Downloaded: {name}', { name: doc.name }));
    } catch {
      flash(t('The PDF could not be generated. Please try again.'));
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('docType', uploadType);
      await api(PATH, { form });
      await reload(PATH);
      flash(t('Uploaded: {name}', { name: file.name }));
    } catch (e) {
      flash(e instanceof Error ? e.message : t('The upload failed.'));
    }
    setBusy(false);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("Sovereign Document Vault")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-gold/20 text-gold border border-gold/40">{t('{count} documents', { count: DOCUMENTS.length })}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Certificates issued to you, and the documents you submitted for review")}</p>
          </div>
          <div className="flex items-center gap-2">
            <select aria-label={t("Document type")} value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="px-2 py-1.5 text-xs border border-navy/20 rounded-sm bg-white text-navy">
              {['Biometric Passport Scan', 'Articles of Association', 'Apostille Certificate', 'Police Clearance', 'Proof of Address', 'Other Supporting Document'].map((d) => <option key={d} value={d}>{tx(d)}</option>)}
            </select>
            <label className={`px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-50' : ''}`}>
              <Upload className="w-3.5 h-3.5 text-gold" />
              <span>{busy ? t("Uploading…") : t("Upload document")}</span>
              <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" disabled={busy} onChange={(e) => { void handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </div>

        {tx(downloadNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs font-mono text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{tx(downloadNotice)}</span>
          </div>
        ))}

        {/* Documents Table */}
        <div className="rounded-sm bg-white border border-navy/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-parchment-light border-b border-navy/10">
                <tr className="text-navy/50 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">{t("Document Title")}</th>
                  <th className="py-3 px-4">{t("Instrument Category")}</th>
                  <th className="py-3 px-4">{t("Issuing Authority")}</th>
                  <th className="py-3 px-4">{t("Issue Date")}</th>
                  <th className="py-3 px-4">{t("Status")}</th>
                  <th className="py-3 px-4 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {DOCUMENTS.map((doc) => (
                  <tr key={doc.id} className="hover:bg-navy/[0.01] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-navy flex items-center gap-2 font-sans">
                      <FileText className="w-4 h-4 text-gold shrink-0" />
                      <span>{tx(doc.name)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-navy/70">{tx(doc.type)}</td>
                    <td className="py-3.5 px-4 text-navy/60">{tx(doc.authority ?? t('Submitted by you'))}</td>
                    <td className="py-3.5 px-4 text-navy/50">{day(doc.createdAt, intl)}</td>
                    <td className={`py-3.5 px-4 font-bold ${doc.status === 'Verified' ? 'text-emerald-700' : doc.status === 'Flagged' ? 'text-red-700' : 'text-amber-700'}`}>{tx(doc.status)}</td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="px-2.5 py-1 rounded-sm bg-white border border-navy/15 text-navy hover:border-gold hover:text-gold transition-colors text-[11px]"
                      >{t("Inspect")}</button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="px-2.5 py-1 rounded-sm bg-navy text-parchment hover:bg-navy-deep transition-colors text-[11px]"
                      >
                        <Download className="w-3 h-3 inline mr-1" />{' '}{doc.direction === 'issued' ? t("PDF") : tx(size(doc.size))}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tx(!loading && DOCUMENTS.length === 0 && (
              <p className="py-10 text-center text-xs text-navy/50">{t("No documents yet. Certificates appear here when an application is approved.")}</p>
            ))}
          </div>
        </div>

        {/* Modal */}
        {tx(selectedDoc && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-sm bg-white p-6 space-y-4 shadow-2xl border border-navy/15">
              <div className="flex items-center justify-between border-b border-navy/10 pb-3">
                <div className="flex items-center gap-2">
                  <Stamp className="w-5 h-5 text-gold" />
                  <span className="font-bold text-navy text-sm font-sans">{t("Official State Instrument")}</span>
                </div>
                <button aria-label={t("Close")} onClick={() => setSelectedDoc(null)} className="text-navy/40 hover:text-navy">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-parchment-light rounded-sm border border-navy/10 space-y-1">
                  <div className="text-sm font-bold text-navy font-sans">{tx(selectedDoc.name)}</div>
                  <div className="text-gold text-[11px]">{tx(selectedDoc.type)}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-navy/5">
                    <span className="text-navy/50">{t("Issuing Department:")}</span>
                    <span className="text-navy font-bold">{tx(selectedDoc.authority ?? t('Submitted by you'))}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy/5">
                    <span className="text-navy/50">{t("Date of Registration:")}</span>
                    <span className="text-navy">{day(selectedDoc.createdAt, intl)} · {selectedDoc.reference}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy/5">
                    <span className="text-navy/50">{t("SHA-256 fingerprint:")}</span>
                    <span className="text-gold font-mono" translate="no" data-i18n-skip="">{shortHash(selectedDoc.hash)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-navy/10">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-3 py-1.5 bg-white border border-navy/20 text-navy text-xs rounded-sm hover:bg-navy/5"
                >{t("Close")}</button>
                <button
                  onClick={() => {
                    handleDownload(selectedDoc);
                    setSelectedDoc(null);
                  }}
                  className="px-4 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-gold" />
                  <span>{t("Download")}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
