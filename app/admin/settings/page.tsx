'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Settings,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  UserCheck,
} from 'lucide-react';

export default function AdminSettingsConsolePage() {
  const [saved, setSaved] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState('30');
  const [mfaEnforced, setMfaEnforced] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-parchment">Console Administration &amp; Policies</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-gold/20 text-gold border border-gold/30">
                Security Profile: STRICT
              </span>
            </div>
            <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
              Officer authentication parameters, session governance, and cryptographic protocol standards
            </p>
          </div>
        </div>

        {saved && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-sm text-xs font-mono text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Console security preferences updated and synced across all nodes.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 max-w-2xl font-mono text-xs">
          {/* Officer Identity Info */}
          <div className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4">
            <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gold" />
              <span>Officer Profile &amp; Clearance</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-parchment/40 block">Officer Name</span>
                <span className="text-parchment font-bold">Cmdr. S. Okafor</span>
              </div>
              <div>
                <span className="text-[10px] text-parchment/40 block">Assigned Ministry</span>
                <span className="text-gold font-bold">General Secretariat &amp; ADSS</span>
              </div>
              <div>
                <span className="text-[10px] text-parchment/40 block">Security Clearance</span>
                <span className="text-emerald-400 font-bold">Level 4 Clearance</span>
              </div>
              <div>
                <span className="text-[10px] text-parchment/40 block">Hardware Token Serial</span>
                <span className="text-parchment font-bold">YUBI-FIPS-904128</span>
              </div>
            </div>
          </div>

          {/* Session Configuration */}
          <div className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4">
            <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-gold" />
              <span>Session Inactivity Timeouts</span>
            </h3>

            <div className="space-y-2">
              <label className="text-[11px] text-parchment/70 block">
                Automatic Console Session Inactivity Timeout
              </label>
              <select
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-navy-deep border border-gold/25 rounded-sm text-parchment focus:outline-none focus:border-gold"
              >
                <option value="15">15 Minutes (High Security Mode)</option>
                <option value="30">30 Minutes (Standard Mandate)</option>
                <option value="60">60 Minutes (Supervisory Shift)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-parchment/80">Hardware Token (PIV / CAC) Enforcement</span>
              <span className="text-emerald-400 font-bold">MANDATORY</span>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-gold text-navy font-bold rounded-sm hover:bg-gold-tint transition-colors text-xs"
          >
            Save Console Configuration
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
