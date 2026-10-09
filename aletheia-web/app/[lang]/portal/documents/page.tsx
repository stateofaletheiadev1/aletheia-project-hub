'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { downloadPortalDocument, type PortalDocumentKind } from '@/lib/pdf/portal';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  FileText,
  Download,
  CheckCircle2,
  Stamp,
  X,
} from 'lucide-react';

interface VaultDocument {
  id: string;
  kind: PortalDocumentKind;
  name: string;
  type: string;
  issuedDate: string;
  authority: string;
  hash: string;
  size: string;
}

const DOCUMENTS: VaultDocument[] = [
  {
    id: 'DOC-01',
    kind: 'e-residence-certificate',
    name: 'Aletheia_E_Residence_Certificate.pdf',
    type: 'Official Residency Certificate',
    issuedDate: '2026-10-01',
    authority: 'General Secretariat of State',
    hash: '281999f1…4ff9',
    size: '1.4 MB',
  },
  {
    id: 'DOC-02',
    kind: 'company-charter',
    name: 'Kaelen_Vance_Marine_SARL_Charter.pdf',
    type: 'Commercial Register Charter',
    issuedDate: '2026-06-12',
    authority: 'Registrar of Companies',
    hash: 'e5c24bef…e965',
    size: '2.1 MB',
  },
  {
    id: 'DOC-03',
    kind: 'tax-residency',
    name: 'Sovereign_Tax_Residency_Declaration.pdf',
    type: 'Fiscal Status Attestation',
    issuedDate: '2026-10-02',
    authority: 'Ministry of Treasury & Finance',
    hash: 'e3f51901…6bd3',
    size: '890 KB',
  },
  {
    id: 'DOC-04',
    kind: 'apostille',
    name: 'Hague_Apostille_Legalisation_Seal.pdf',
    type: 'Digital Apostille Notary',
    issuedDate: '2026-10-03',
    authority: 'High Court Notarial Bureau',
    hash: '9523a629…5a9b',
    size: '1.8 MB',
  },
];

export default function PortalDocumentsPage() {
  const { t, tx } = useI18n();
  const [selectedDoc, setSelectedDoc] = useState<VaultDocument | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownload = async (doc: VaultDocument) => {
    setDownloadNotice(t('Preparing PDF: {name}', { name: doc.name }));
    try {
      await downloadPortalDocument(doc.kind, doc.name);
      setDownloadNotice(t('Downloaded: {name}', { name: doc.name }));
    } catch {
      setDownloadNotice('The PDF could not be generated. Please try again.');
    }
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("Sovereign Document Vault")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-gold/20 text-gold border border-gold/40">{t("4 Cryptographically Sealed Instruments")}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Digitally sealed certificates, commercial charters, and apostilles verifiable on StableChain")}</p>
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
                  <th className="py-3 px-4">{t("File Size")}</th>
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
                    <td className="py-3.5 px-4 text-navy/60">{tx(doc.authority)}</td>
                    <td className="py-3.5 px-4 text-navy/50">{tx(doc.issuedDate)}</td>
                    <td className="py-3.5 px-4 text-navy/40">{tx(doc.size)}</td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="px-2.5 py-1 rounded-sm bg-white border border-navy/15 text-navy hover:border-gold hover:text-gold transition-colors text-[11px]"
                      >{t("Inspect")}</button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="px-2.5 py-1 rounded-sm bg-navy text-parchment hover:bg-navy-deep transition-colors text-[11px]"
                      >
                        <Download className="w-3 h-3 inline mr-1" />{' '}{t("PDF")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <button onClick={() => setSelectedDoc(null)} className="text-navy/40 hover:text-navy">
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
                    <span className="text-navy font-bold">{tx(selectedDoc.authority)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy/5">
                    <span className="text-navy/50">{t("Date of Registration:")}</span>
                    <span className="text-navy">{tx(selectedDoc.issuedDate)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-navy/5">
                    <span className="text-navy/50">{t("On-Ledger Signature Root:")}</span>
                    <span className="text-gold font-mono" translate="no" data-i18n-skip="">{selectedDoc.hash}</span>
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
                  <span>{t("Download Verified PDF")}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
