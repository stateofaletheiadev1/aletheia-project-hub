'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Globe2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  KeyRound,
  Download,
  X,
  Cpu,
} from 'lucide-react';

interface EResidencyApp {
  id: string;
  applicant: string;
  country: string;
  companyIntent: string;
  kycStatus: 'Verified' | 'Pending Verification' | 'Manual Inspection';
  amlScore: number; // 0-100 (lower risk is higher score)
  submittedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const INITIAL_ERES: EResidencyApp[] = [
  {
    id: 'ERES-2026-0814',
    applicant: 'Stefan Meyer',
    country: 'Switzerland (CHE)',
    companyIntent: 'Fintech & Settlement Software',
    kycStatus: 'Verified',
    amlScore: 98,
    submittedDate: '2026-10-02',
    status: 'Pending',
  },
  {
    id: 'ERES-2026-0813',
    applicant: 'Elena Rostova',
    country: 'Cyprus (CYP)',
    companyIntent: 'Maritime Logistics Brokerage',
    kycStatus: 'Verified',
    amlScore: 95,
    submittedDate: '2026-10-01',
    status: 'Pending',
  },
  {
    id: 'ERES-2026-0812',
    applicant: 'Arthur Pendelton',
    country: 'Canada (CAN)',
    companyIntent: 'Renewable Hydrographic Sensors',
    kycStatus: 'Manual Inspection',
    amlScore: 84,
    submittedDate: '2026-09-30',
    status: 'Pending',
  },
  {
    id: 'ERES-2026-0811',
    applicant: 'Naomi Tanaka',
    country: 'Japan (JPN)',
    companyIntent: 'Offshore Energy Consultation',
    kycStatus: 'Verified',
    amlScore: 99,
    submittedDate: '2026-09-29',
    status: 'Pending',
  },
];

export default function AdminEResidencyQueuePage() {
  const [apps, setApps] = useState<EResidencyApp[]>(INITIAL_ERES);
  const [selectedApp, setSelectedApp] = useState<EResidencyApp | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const approveApp = (id: string, name: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Approved' } : a))
    );
    setNotice(`E-Residency granted for ${name}. Hardware DID and cryptographic keys minted to ledger.`);
    setTimeout(() => setNotice(null), 4000);
    if (selectedApp?.id === id) setSelectedApp(null);
  };

  const rejectApp = (id: string, name: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Rejected' } : a))
    );
    setNotice(`Application rejected for ${name}. Formal notice dispatched.`);
    setTimeout(() => setNotice(null), 4000);
    if (selectedApp?.id === id) setSelectedApp(null);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">E-Residency Adjudication Queue</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-gold/20 text-gold border border-gold/30">
                24 Pending Applications
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Digital State Directorate · KYC &amp; On-Ledger Identity Minting Rails
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

        {notice && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-sm text-xs font-mono text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Applications Queue Table */}
        <div
          className="rounded-sm overflow-hidden"
          style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.15)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead style={{ background: '#0E1B31', borderBottom: '1px solid rgba(196,154,78,0.15)' }}>
                <tr className="text-parchment/50 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Application ID</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Commercial Intent</th>
                  <th className="py-3 px-4">KYC / AML Status</th>
                  <th className="py-3 px-4">Filing Date</th>
                  <th className="py-3 px-4 text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {apps.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gold">{a.id}</td>
                    <td className="py-3.5 px-4 font-bold text-parchment font-sans">{a.applicant}</td>
                    <td className="py-3.5 px-4 text-parchment/70">{a.country}</td>
                    <td className="py-3.5 px-4 text-parchment/80">{a.companyIntent}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          a.kycStatus === 'Verified'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {a.kycStatus} ({a.amlScore}%)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-parchment/50">{a.submittedDate}</td>
                    <td className="py-3.5 px-4 text-right">
                      {a.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedApp(a)}
                            className="px-2.5 py-1 rounded-sm bg-navy-deep border border-gold/25 text-gold hover:bg-gold/10 text-[11px]"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => approveApp(a.id, a.applicant)}
                            className="px-2.5 py-1 rounded-sm bg-emerald-600 text-white font-bold hover:bg-emerald-500 text-[11px]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectApp(a.id, a.applicant)}
                            className="px-2.5 py-1 rounded-sm bg-red-950 border border-red-700/50 text-red-200 hover:bg-red-900 text-[11px]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            a.status === 'Approved' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {a.status.toUpperCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {selectedApp && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-sm p-6 space-y-5"
              style={{ background: '#0E1B31', border: '1px solid rgba(196,154,78,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
            >
              <div className="flex items-center justify-between border-b border-gold/20 pb-3">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-gold" />
                  <span className="font-bold text-parchment text-sm">E-Residency Dossier {selectedApp.id}</span>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <div className="text-base font-bold text-parchment font-sans">{selectedApp.applicant}</div>
                  <div className="text-gold text-[11px]">{selectedApp.country}</div>
                  <div className="text-[10px] text-parchment/40">Intended activity: {selectedApp.companyIntent}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Biometric Vector Verification:</span>
                    <span className="text-emerald-400 font-bold">ICAO 9303 Compliant Match</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Sanctions &amp; PEP Screening:</span>
                    <span className="text-emerald-400 font-bold">Clear (0 False Positives)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Ledger Key Derivation:</span>
                    <span className="text-gold font-mono">secp256k1 + ML-KEM768</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                <button
                  onClick={() => rejectApp(selectedApp.id, selectedApp.applicant)}
                  className="px-3 py-1.5 bg-red-950/60 border border-red-700/50 text-red-200 text-xs font-mono rounded-sm hover:bg-red-900/60"
                >
                  Reject Application
                </button>
                <button
                  onClick={() => approveApp(selectedApp.id, selectedApp.applicant)}
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500"
                >
                  Grant E-Residency &amp; Issue DID
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
