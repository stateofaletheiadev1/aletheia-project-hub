'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Search,
  Eye,
  ShieldCheck,
  X,
  UserCheck,
} from 'lucide-react';

interface Citizen {
  id: string;
  nationalId: string;
  name: string;
  type: 'Founding Citizen' | 'Naturalised' | 'Covenant Descent' | 'Honorary';
  passportNumber: string;
  nationalityOfOrigin: string;
  registeredDate: string;
  status: 'Active' | 'Under Review' | 'Oath Pending' | 'Suspended';
  covenantHash: string;
}

const INITIAL_CITIZENS: Citizen[] = [
  {
    id: 'CIT-001',
    nationalId: 'ALE-NAT-2026-000104',
    name: 'Dr. Elizabeth Thorne-Vance',
    type: 'Founding Citizen',
    passportNumber: 'ALE-004928',
    nationalityOfOrigin: 'Germany (DEU)',
    registeredDate: '2026-01-15',
    status: 'Active',
    covenantHash: '0x9b2a...771e',
  },
  {
    id: 'CIT-002',
    nationalId: 'ALE-NAT-2026-000218',
    name: 'Marcus Aurelius Sterling',
    type: 'Covenant Descent',
    passportNumber: 'ALE-005112',
    nationalityOfOrigin: 'United Kingdom (GBR)',
    registeredDate: '2026-02-10',
    status: 'Active',
    covenantHash: '0x4f12...e8a1',
  },
  {
    id: 'CIT-003',
    nationalId: 'ALE-NAT-2026-000349',
    name: 'Sophia Andreou',
    type: 'Naturalised',
    passportNumber: 'ALE-005890',
    nationalityOfOrigin: 'Greece (GRC)',
    registeredDate: '2026-03-22',
    status: 'Oath Pending',
    covenantHash: '0x882c...3104',
  },
  {
    id: 'CIT-004',
    nationalId: 'ALE-NAT-2026-000412',
    name: 'Kaelen Vance',
    type: 'Founding Citizen',
    passportNumber: 'ALE-001042',
    nationalityOfOrigin: 'Malta (MLT)',
    registeredDate: '2026-01-10',
    status: 'Active',
    covenantHash: '0x712a...009f',
  },
  {
    id: 'CIT-005',
    nationalId: 'ALE-NAT-2026-000508',
    name: 'Helena Bergstrom',
    type: 'Naturalised',
    passportNumber: 'ALE-006201',
    nationalityOfOrigin: 'Sweden (SWE)',
    registeredDate: '2026-04-05',
    status: 'Under Review',
    covenantHash: '0x33e1...fa88',
  },
  {
    id: 'CIT-006',
    nationalId: 'ALE-NAT-2026-000631',
    name: 'Dmitri V. Sokolov',
    type: 'Naturalised',
    passportNumber: 'ALE-007119',
    nationalityOfOrigin: 'Estonia (EST)',
    registeredDate: '2026-05-18',
    status: 'Active',
    covenantHash: '0x19a4...c012',
  },
];

export default function AdminCitizenRegistryPage() {
  const citizens = INITIAL_CITIZENS;
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);

  const filtered = citizens.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nationalId.toLowerCase().includes(search.toLowerCase()) ||
      c.passportNumber.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === 'ALL' || c.status === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">National Citizen Registry</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-gold/20 text-gold border border-gold/30">
                2,841 Enrolled
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Official roll of sovereign citizens under Covenant Law § 4 · Department of Civil Status
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/citizenship"
              className="px-3.5 py-2 bg-gold text-navy text-xs font-bold rounded-sm hover:bg-gold-tint transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Review Approvals (12)</span>
            </Link>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-sm"
            style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.18)' }}
          >
            <Search className="w-4 h-4 text-parchment/40 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, National ID, or Passport number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-parchment placeholder-parchment/40 focus:outline-none font-mono"
            />
          </div>

          <div className="flex gap-2">
            {(['ALL', 'Active', 'Oath Pending', 'Under Review'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterType(status)}
                className={`px-3 py-2 rounded-sm text-xs font-mono transition-colors ${
                  filterType === status
                    ? 'bg-gold text-navy font-bold'
                    : 'bg-[#111827] text-parchment/60 hover:text-parchment border border-gold/15'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Citizen Table */}
        <div
          className="rounded-sm overflow-hidden"
          style={{ background: '#111827', border: '1px solid rgba(196,154,78,0.15)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead style={{ background: '#0E1B31', borderBottom: '1px solid rgba(196,154,78,0.15)' }}>
                <tr className="text-parchment/50 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Citizen Name</th>
                  <th className="py-3 px-4">National ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Origin</th>
                  <th className="py-3 px-4">Passport</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-parchment flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-[10px] text-gold font-sans font-bold">
                        {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span>{c.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-parchment/70 font-mono text-[11px]">{c.nationalId}</td>
                    <td className="py-3.5 px-4 text-gold/80">{c.type}</td>
                    <td className="py-3.5 px-4 text-parchment/60">{c.nationalityOfOrigin}</td>
                    <td className="py-3.5 px-4 text-parchment/80 font-bold">{c.passportNumber}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          c.status === 'Active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : c.status === 'Oath Pending'
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedCitizen(c)}
                        className="px-2.5 py-1 rounded-sm bg-white/5 border border-gold/20 text-gold hover:bg-gold/10 transition-colors text-[11px]"
                      >
                        <Eye className="w-3 h-3 inline mr-1" /> Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Citizen Dossier Modal */}
        {selectedCitizen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-sm p-6 space-y-5 relative"
              style={{ background: '#0E1B31', border: '1px solid rgba(196,154,78,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
            >
              <div className="flex items-center justify-between border-b border-gold/20 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-gold" />
                  <span className="font-bold text-parchment text-sm">Sovereign Citizen Dossier</span>
                </div>
                <button
                  onClick={() => setSelectedCitizen(null)}
                  className="text-parchment/40 hover:text-parchment"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div className="flex items-center gap-4 bg-navy-deep p-4 rounded-sm border border-gold/15">
                  <div className="w-14 h-14 rounded-sm bg-gold/15 border border-gold/30 flex items-center justify-center text-xl font-bold text-gold font-sans">
                    {selectedCitizen.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-parchment font-sans">{selectedCitizen.name}</h3>
                    <p className="text-gold/80 text-[11px]">{selectedCitizen.type}</p>
                    <p className="text-parchment/40 text-[10px] mt-0.5">Enrolled on {selectedCitizen.registeredDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-navy-deep rounded-sm border border-white/5 space-y-1">
                    <span className="text-[10px] text-parchment/40 block">NATIONAL CITIZEN ID</span>
                    <span className="text-parchment font-bold">{selectedCitizen.nationalId}</span>
                  </div>
                  <div className="p-3 bg-navy-deep rounded-sm border border-white/5 space-y-1">
                    <span className="text-[10px] text-parchment/40 block">BIOMETRIC PASSPORT</span>
                    <span className="text-gold font-bold">{selectedCitizen.passportNumber}</span>
                  </div>
                  <div className="p-3 bg-navy-deep rounded-sm border border-white/5 space-y-1">
                    <span className="text-[10px] text-parchment/40 block">ORIGIN NATION</span>
                    <span className="text-parchment">{selectedCitizen.nationalityOfOrigin}</span>
                  </div>
                  <div className="p-3 bg-navy-deep rounded-sm border border-white/5 space-y-1">
                    <span className="text-[10px] text-parchment/40 block">COVENANT HASH</span>
                    <span className="text-gold font-mono">{selectedCitizen.covenantHash}</span>
                  </div>
                </div>

                <div className="p-3 bg-navy-deep rounded-sm border border-gold/15 space-y-1">
                  <span className="text-[10px] text-gold uppercase tracking-wider block font-bold">Covenant Oath Status</span>
                  <p className="text-[11px] text-parchment/70 leading-relaxed">
                    Signed and anchored to StableChain block #8,301,940. Subject to full constitutional rights and duties under Articles 1–15 of the Covenant.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gold/15">
                <Link
                  href="/admin/rescissions"
                  className="px-3 py-1.5 bg-red-950/60 border border-red-700/50 text-red-200 text-xs font-mono rounded-sm hover:bg-red-900/60 transition-colors"
                >
                  Initiate Review / Rescission
                </Link>
                <button
                  onClick={() => setSelectedCitizen(null)}
                  className="px-4 py-1.5 bg-gold text-navy font-bold text-xs rounded-sm hover:bg-gold-tint transition-colors"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
