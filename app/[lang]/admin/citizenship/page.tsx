'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  FileCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Eye,
  X,
} from 'lucide-react';

interface Application {
  id: string;
  applicant: string;
  origin: string;
  category: string;
  date: string;
  residencyMonths: number;
  oathSigned: boolean;
  securityClearance: 'Passed' | 'Pending Review' | 'Flagged';
  score: number;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const INITIAL_APPS: Application[] = [
  {
    id: 'CIT-APP-901',
    applicant: 'Sophia Andreou',
    origin: 'Greece (GRC)',
    category: 'Naturalisation (Standard)',
    date: '2026-09-29',
    residencyMonths: 38,
    oathSigned: true,
    securityClearance: 'Passed',
    score: 96,
    status: 'Pending',
  },
  {
    id: 'CIT-APP-902',
    applicant: 'Julian De Vries',
    origin: 'Netherlands (NLD)',
    category: 'Covenant Enterprise Contributor',
    date: '2026-09-28',
    residencyMonths: 42,
    oathSigned: true,
    securityClearance: 'Passed',
    score: 98,
    status: 'Pending',
  },
  {
    id: 'CIT-APP-903',
    applicant: 'Amina Al-Mansoor',
    origin: 'United Arab Emirates (ARE)',
    category: 'Maritime Engineering Fellow',
    date: '2026-09-25',
    residencyMonths: 36,
    oathSigned: true,
    securityClearance: 'Passed',
    score: 94,
    status: 'Pending',
  },
  {
    id: 'CIT-APP-904',
    applicant: 'Henrik Lindqvist',
    origin: 'Finland (FIN)',
    category: 'Naturalisation (Standard)',
    date: '2026-09-20',
    residencyMonths: 24,
    oathSigned: false,
    securityClearance: 'Pending Review',
    score: 72,
    status: 'Pending',
  },
];

export default function CitizenshipApprovalsPage() {
  const [apps, setApps] = useState<Application[]>(INITIAL_APPS);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const approveApp = (id: string, name: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Approved' } : a))
    );
    setBannerNotice(`Citizenship petition approved for ${name}. Certificate issued to ledger.`);
    setTimeout(() => setBannerNotice(null), 4000);
    if (selectedApp?.id === id) setSelectedApp(null);
  };

  const rejectApp = (id: string, name: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Rejected' } : a))
    );
    setBannerNotice(`Citizenship petition rejected for ${name}. Official statutory notice dispatched.`);
    setTimeout(() => setBannerNotice(null), 4000);
    if (selectedApp?.id === id) setSelectedApp(null);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">Citizenship Application Queue</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-gold/20 text-gold border border-gold/30">
                {apps.filter((a) => a.status === 'Pending').length} Pending Adjudication
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              General Secretariat Ministerial Review · Articles 4 &amp; 5 of the Covenant
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/citizens"
              className="px-3 py-1.5 rounded-sm bg-navy-deep border border-gold/25 text-parchment/70 hover:text-parchment text-xs font-mono transition-colors"
            >
              View Active Citizens →
            </Link>
          </div>
        </div>

        {bannerNotice && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-sm text-xs font-mono text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{bannerNotice}</span>
          </div>
        )}

        {/* Applications List */}
        <div className="grid grid-cols-1 gap-4">
          {apps.map((app) => (
            <div
              key={app.id}
              className="p-5 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
              style={{
                background: '#111827',
                border:
                  app.status === 'Approved'
                    ? '1px solid rgba(47,107,79,0.5)'
                    : app.status === 'Rejected'
                    ? '1px solid rgba(192,57,43,0.5)'
                    : '1px solid rgba(196,154,78,0.2)',
              }}
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-parchment font-sans">{app.applicant}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-navy-deep text-parchment/60 border border-white/5">
                    {app.id}
                  </span>
                  <span className="text-[10px] font-mono text-gold/80">{app.origin}</span>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm ${
                      app.status === 'Approved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : app.status === 'Rejected'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gold/20 text-gold'
                    }`}
                  >
                    {app.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs font-mono text-parchment/60">
                  <span>Category: <strong className="text-parchment/80">{app.category}</strong></span>
                  <span>Residency: <strong className="text-parchment/80">{app.residencyMonths} months</strong></span>
                  <span>
                    Oath:{' '}
                    {app.oathSigned ? (
                      <strong className="text-emerald-400">Signed &amp; Notarized</strong>
                    ) : (
                      <strong className="text-amber-400">Pending Signature</strong>
                    )}
                  </span>
                  <span>
                    Clearance:{' '}
                    <strong
                      className={
                        app.securityClearance === 'Passed'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {app.securityClearance}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedApp(app)}
                  className="px-3 py-1.5 rounded-sm bg-navy-deep border border-gold/20 text-gold text-xs font-mono hover:bg-gold/10 transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Details
                </button>

                {app.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => approveApp(app.id, app.applicant)}
                      className="px-3.5 py-1.5 rounded-sm bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Grant Citizenship
                    </button>
                    <button
                      onClick={() => rejectApp(app.id, app.applicant)}
                      className="px-3 py-1.5 rounded-sm bg-red-900/60 border border-red-700/50 text-red-200 text-xs hover:bg-red-800 transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
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
                  <UserCheck className="w-5 h-5 text-gold" />
                  <span className="font-bold text-parchment text-sm">Citizenship Petition Review</span>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <div className="text-sm font-bold text-parchment font-sans">{selectedApp.applicant}</div>
                  <div className="text-[11px] text-gold/80">{selectedApp.category} · {selectedApp.origin}</div>
                  <div className="text-[10px] text-parchment/40">Petition filed on {selectedApp.date}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Required Residency Period:</span>
                    <span className="text-parchment font-bold">{selectedApp.residencyMonths} / 36 Months Met</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Covenant Allegiance Oath:</span>
                    <span className={selectedApp.oathSigned ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {selectedApp.oathSigned ? 'Completed & Cryptographically Stamped' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">ADSS Interpol &amp; Security Screening:</span>
                    <span className="text-emerald-400 font-bold">{selectedApp.securityClearance}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Integration Aptitude Score:</span>
                    <span className="text-gold font-bold">{selectedApp.score} / 100</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                {selectedApp.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => rejectApp(selectedApp.id, selectedApp.applicant)}
                      className="px-3 py-1.5 bg-red-950/60 border border-red-700/50 text-red-200 text-xs font-mono rounded-sm hover:bg-red-900/60"
                    >
                      Reject Petition
                    </button>
                    <button
                      onClick={() => approveApp(selectedApp.id, selectedApp.applicant)}
                      className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500"
                    >
                      Approve &amp; Issue Citizen Credential
                    </button>
                  </>
                )}
                {selectedApp.status !== 'Pending' && (
                  <button
                    onClick={() => setSelectedApp(null)}
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
