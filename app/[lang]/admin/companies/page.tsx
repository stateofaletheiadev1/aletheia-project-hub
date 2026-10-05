'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Eye,
  FileCheck,
  CreditCard,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

interface Company {
  id: string;
  regNumber: string;
  name: string;
  structure: 'SARL (Limited)' | 'AG (Corporation)' | 'Maritime Trust';
  founder: string;
  shareCapital: string;
  beneficialOwners: string;
  date: string;
  status: 'Pending Review' | 'Active / Chartered' | 'Changes Requested';
}

const INITIAL_COMPANIES: Company[] = [
  {
    id: 'CORP-001',
    regNumber: 'ALE-SARL-2026-0012',
    name: 'Kaelen Vance Marine Ltd',
    structure: 'SARL (Limited)',
    founder: 'Dr. Elena Vasquez',
    shareCapital: '50,000 AEY',
    beneficialOwners: 'Dr. Elena Vasquez (100%)',
    date: '2026-06-12',
    status: 'Active / Chartered',
  },
  {
    id: 'CORP-002',
    regNumber: 'ALE-SARL-2026-0044',
    name: 'Aegis Oceanographic Corp',
    structure: 'SARL (Limited)',
    founder: 'Capt. Henrik Von Klausen',
    shareCapital: '100,000 AEY',
    beneficialOwners: 'H. Von Klausen (60%), M. Sterling (40%)',
    date: '2026-09-30',
    status: 'Pending Review',
  },
  {
    id: 'CORP-003',
    regNumber: 'ALE-AG-2026-0008',
    name: 'Antioch Modular Energy AG',
    structure: 'AG (Corporation)',
    founder: 'Dr. Elizabeth Thorne-Vance',
    shareCapital: '500,000 AEY',
    beneficialOwners: 'Sovereign Endowment (25%), Thorne-Vance (75%)',
    date: '2026-10-01',
    status: 'Pending Review',
  },
  {
    id: 'CORP-004',
    regNumber: 'ALE-TRUST-2026-0002',
    name: 'Borealis Hydrographic Trust',
    structure: 'Maritime Trust',
    founder: 'Marcus Sterling',
    shareCapital: '250,000 AEY',
    beneficialOwners: 'Sterling Family Covenant Beneficiaries',
    date: '2026-09-22',
    status: 'Active / Chartered',
  },
];

export default function AdminCompanyFormationsPage() {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const approveCompany = (id: string, name: string) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'Active / Chartered' } : c))
    );
    setNotice(`Corporate Charter ratified for ${name}. Commercial Register certificate issued.`);
    setTimeout(() => setNotice(null), 4000);
    if (selectedCompany?.id === id) setSelectedCompany(null);
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
                394 Registered Entities
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

        {notice && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-sm text-xs font-mono text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

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
                    <td className="py-3.5 px-4 text-gold font-bold">{c.shareCapital}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          c.status === 'Active / Chartered'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedCompany(c)}
                        className="px-2.5 py-1 rounded-sm bg-navy-deep border border-gold/25 text-gold hover:bg-gold/10 text-[11px]"
                      >
                        Inspect Charter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <button onClick={() => setSelectedCompany(null)} className="text-parchment/40 hover:text-parchment">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <div className="text-base font-bold text-parchment font-sans">{selectedCompany.name}</div>
                  <div className="text-gold text-[11px]">{selectedCompany.regNumber} · {selectedCompany.structure}</div>
                  <div className="text-[10px] text-parchment/40">Filed on {selectedCompany.date}</div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Registered Capital Deposit:</span>
                    <span className="text-gold font-bold">{selectedCompany.shareCapital}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Ultimate Beneficial Owners:</span>
                    <span className="text-parchment font-bold">{selectedCompany.beneficialOwners}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Registered Legal Seat:</span>
                    <span className="text-parchment">Antioch Hexagonal District, Sovereign Covenant State</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-parchment/40">Corporate Tax Treatment:</span>
                    <span className="text-emerald-400 font-bold">0% Sovereign Corporate Tax / Zero Ledger Fees</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                {selectedCompany.status !== 'Active / Chartered' ? (
                  <button
                    onClick={() => approveCompany(selectedCompany.id, selectedCompany.name)}
                    className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs font-mono rounded-sm hover:bg-emerald-500"
                  >
                    Ratify Charter &amp; Issue Certificate
                  </button>
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
