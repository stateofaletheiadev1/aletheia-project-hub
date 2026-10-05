'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AdminShell } from '@/components/layout/AdminShell';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ScanLine,
  UserCheck,
  Plane,
  Anchor,
  ArrowRight,
  Terminal,
  Cpu,
  Fingerprint,
} from 'lucide-react';

interface TravelerRecord {
  passportNumber: string;
  name: string;
  nationality: string;
  dob: string;
  documentType: string;
  status: 'CLEARED' | 'FLAGGED' | 'EXPIRED';
  permitType: string;
  mrzHash: string;
}

const SAMPLE_TRAVELERS: Record<string, TravelerRecord> = {
  'ALE-004928': {
    passportNumber: 'ALE-004928',
    name: 'Dr. Elizabeth Thorne-Vance',
    nationality: 'Covenant State of Aletheia (ALE)',
    dob: '1984-06-12',
    documentType: 'ICAO TD3 Ordinary Biometric Passport',
    status: 'CLEARED',
    permitType: 'Sovereign Citizen (Unconditional Entry Right)',
    mrzHash: 'P<ALETHORNE<<ELIZABETH<<<<<<<<<<<<<<<<<<<\nC0049281<4ALE8406124F3103018<<<<<<<<<<<<<<02',
  },
  'C38910482': {
    passportNumber: 'C38910482',
    name: 'Henrik Von Klausen',
    nationality: 'Federal Republic of Germany (DEU)',
    dob: '1979-11-20',
    documentType: 'Foreign National Biometric Passport',
    status: 'CLEARED',
    permitType: 'A-ETA Electronic Travel Authorisation (Valid 90 Days)',
    mrzHash: 'P<D<<VON<KLAUSEN<<HENRIK<<<<<<<<<<<<<<<<<\nC389104820DEU7911202M2809142<<<<<<<<<<<<<<06',
  },
};

export default function ImmigrationTerminalPage() {
  const [queryInput, setQueryInput] = useState('ALE-004928');
  const [activeRecord, setActiveRecord] = useState<TravelerRecord | null>(SAMPLE_TRAVELERS['ALE-004928']);
  const [gateStatus, setGateStatus] = useState<'IDLE' | 'CLEARED' | 'FLAGGED'>('IDLE');

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const found = SAMPLE_TRAVELERS[queryInput.trim().toUpperCase()] || {
      passportNumber: queryInput.trim().toUpperCase(),
      name: 'Unregistered or Non-Compliant Credential',
      nationality: 'Unknown Origin',
      dob: 'N/A',
      documentType: 'Unverified Document',
      status: 'FLAGGED',
      permitType: 'No Valid Visa or Authorisation on Record',
      mrzHash: 'UNVERIFIED_MRZ_CHECKSUM_FAILURE',
    };
    setActiveRecord(found);
    setGateStatus('IDLE');
  };

  const handleGateAction = (action: 'CLEARED' | 'FLAGGED') => {
    setGateStatus(action);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">

        {/* ── BORDER TERMINAL HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gold/15 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-parchment">
                Immigration &amp; e-Gate Terminal
              </h1>
              <span className="px-2 py-0.5 bg-navy-deep text-gold border border-gold/30 rounded-sm text-[10px] font-mono font-bold">
                ST-BRENDAN-E-GATE-04
              </span>
            </div>
            <p className="text-xs text-parchment/60 font-mono">
              Biometric border clearance, ICAO Doc 9303 MRZ scanner, and travel authorization validation
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/admin"
              className="px-3.5 py-1.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors font-mono"
            >
              Command Overview →
            </Link>
          </div>
        </div>

        {/* ── WORKSTATION VIEW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Scanner Control & Verification Logic */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Document Scan Bar */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <span className="text-xs font-bold text-navy uppercase tracking-wider block">
                Optical Document Reader / MRZ Simulator:
              </span>

              <form onSubmit={handleScan} className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="Scan passport barcode or enter doc number (e.g. ALE-004928)..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" /> Read Credential
                </button>
              </form>

              <div className="flex gap-2 text-[11px] text-navy/60 font-mono">
                <span>Sample presets:</span>
                <button onClick={() => { setQueryInput('ALE-004928'); setActiveRecord(SAMPLE_TRAVELERS['ALE-004928']); }} className="text-navy underline font-bold">
                  Citizen Passport
                </button>
                <span>·</span>
                <button onClick={() => { setQueryInput('C38910482'); setActiveRecord(SAMPLE_TRAVELERS['C38910482']); }} className="text-navy underline font-bold">
                  German Visitor (A-ETA)
                </button>
              </div>
            </div>

            {/* Traveler Inspection Card */}
            {activeRecord && (
              <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-start border-b border-navy/10 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gold block">Inspection Dossier</span>
                    <h2 className="text-xl font-bold text-navy">{activeRecord.name}</h2>
                    <span className="text-xs text-navy/60 font-mono">{activeRecord.nationality}</span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-sm text-xs font-bold font-mono ${
                      activeRecord.status === 'CLEARED'
                        ? 'bg-laurel/15 text-laurel border border-laurel/30'
                        : 'bg-red-100 text-red-700 border border-red-300'
                    }`}
                  >
                    {activeRecord.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-navy/50 uppercase block">Passport Number:</span>
                    <strong className="text-navy font-mono text-sm">{activeRecord.passportNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-navy/50 uppercase block">Document Standard:</span>
                    <strong className="text-navy">{activeRecord.documentType}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-navy/50 uppercase block">Date of Birth:</span>
                    <span className="text-navy font-mono">{activeRecord.dob}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-navy/50 uppercase block">Entry Authority:</span>
                    <span className="text-navy font-medium">{activeRecord.permitType}</span>
                  </div>
                </div>

                {/* MRZ Box */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-navy/50 uppercase block">
                    ICAO Doc 9303 Optical MRZ Lines:
                  </span>
                  <pre className="p-3 bg-navy-deep text-gold rounded-sm text-[11px] font-mono overflow-x-auto border border-navy/30 leading-snug">
                    {activeRecord.mrzHash}
                  </pre>
                </div>

                {/* Gate Dispatch Buttons */}
                <div className="pt-4 border-t border-navy/10 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleGateAction('CLEARED')}
                    className="flex-1 py-2.5 bg-laurel text-parchment font-bold text-xs uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Grant Clearance & Open e-Gate
                  </button>
                  <button
                    onClick={() => handleGateAction('FLAGGED')}
                    className="py-2.5 px-4 bg-red-800 text-parchment font-bold text-xs uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-4 h-4" /> Secondary Inspection
                  </button>
                </div>

                {gateStatus === 'CLEARED' && (
                  <div className="p-4 bg-laurel/10 border border-laurel/40 rounded-sm text-xs text-laurel font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> E-Gate Turnstile 04: OPENED. Traveler entry logged on border registry.
                  </div>
                )}

                {gateStatus === 'FLAGGED' && (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-sm text-xs text-red-700 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> E-Gate LOCKED. Duty Officer dispatched for manual passport inspection.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Automated Checklist & Passenger Manifest */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Automated Security Checks Checklist */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                Automated Cryptographic Verifications
              </h3>

              <ul className="space-y-3 text-xs">
                <li className="flex items-center justify-between p-2.5 bg-parchment-light rounded-sm">
                  <span className="text-navy">CSCA PKD Root Certificate:</span>
                  <span className="font-mono text-laurel font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> VALID
                  </span>
                </li>
                <li className="flex items-center justify-between p-2.5 bg-parchment-light rounded-sm">
                  <span className="text-navy">LDS 1.7 Passive Authentication:</span>
                  <span className="font-mono text-laurel font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                  </span>
                </li>
                <li className="flex items-center justify-between p-2.5 bg-parchment-light rounded-sm">
                  <span className="text-navy">INTERPOL Stolen Document Database:</span>
                  <span className="font-mono text-laurel font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> NEGATIVE
                  </span>
                </li>
                <li className="flex items-center justify-between p-2.5 bg-parchment-light rounded-sm">
                  <span className="text-navy">Biometric Facial Match (1:1):</span>
                  <span className="font-mono text-laurel font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 99.4% MATCH
                  </span>
                </li>
              </ul>
            </div>

            {/* Live Arrivals Manifest Feed */}
            <div className="bg-white border border-navy/15 rounded-sm p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                Live Arrivals Manifest (St. Brendan Port Terminal)
              </h3>

              <div className="space-y-3 font-mono text-xs divide-y divide-navy/10">
                <div className="pt-2 first:pt-0 flex items-center justify-between">
                  <span className="text-navy">Ferry MS Veritas (08:45)</span>
                  <span className="text-laurel font-bold text-[11px]">142 Cleared / 0 Flagged</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-navy">Antioch Seaplane Shuttle (09:15)</span>
                  <span className="text-laurel font-bold text-[11px]">18 Cleared / 0 Flagged</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-navy">Container Vessel CMA CGM Aletheia</span>
                  <span className="text-laurel font-bold text-[11px]">24 Crew Cleared</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AdminShell>
  );
}
