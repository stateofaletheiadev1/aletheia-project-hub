'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  ShieldCheck, Building2, FileText, CreditCard, Clock,
  Download, CheckCircle2, AlertCircle, Copy, ArrowRight,
  Globe2, User, Fingerprint, Activity,
} from 'lucide-react';

const TIMELINE = [
  { date: '2026-10-01', event: 'E-Residency renewed for 3-year term', status: 'Operational' },
  { date: '2026-08-15', event: 'Passphrase rotation — security audit passed', status: 'Operational' },
  { date: '2026-06-12', event: 'Kaelen Ltd. incorporated — SARL certificate issued', status: 'Operational' },
  { date: '2026-05-30', event: 'Digital passport issued — ICAO eMRTD compliant', status: 'Operational' },
];

export default function CivicPortalDashboard() {
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText('0x4F829104A18E9B20CA7891230BFE92147A209148');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-7">

        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy">My Dashboard</h1>
            <p className="text-[12px] text-navy/45 mt-0.5">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm text-[11px] font-semibold"
            style={{ background: 'rgba(47,107,79,0.10)', border: '1px solid rgba(47,107,79,0.22)', color: '#2F6B4F' }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Identity Verified · Tier I
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Residency Status', value: 'E-Resident', sub: 'Valid until 2029-10-01', icon: Globe2, good: true },
            { label: 'Companies', value: '1 Active', sub: 'Kaelen Vance Marine Ltd', icon: Building2, good: true },
            { label: 'AEY Balance', value: '12,400.00', sub: 'Aletheian Guilder', icon: CreditCard, good: true },
            { label: 'Pending Applications', value: '1', sub: 'Passport renewal', icon: Clock, good: false },
          ].map(({ label, value, sub, icon: Icon, good }) => (
            <div key={label} className="rounded-sm p-5 space-y-3 bg-white" style={{ border: '1px solid rgba(21,41,74,0.10)', boxShadow: '0 1px 4px rgba(21,41,74,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-navy/45">{label}</span>
                <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: good ? 'rgba(47,107,79,0.10)' : 'rgba(196,154,78,0.12)' }}>
                  <Icon style={{ width: '14px', height: '14px', color: good ? '#2F6B4F' : '#C49A4E' }} />
                </div>
              </div>
              <div className="text-xl font-bold text-navy">{value}</div>
              <div className="text-[10px] text-navy/45">{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Digital Identity Card */}
          <div className="lg:col-span-2 rounded-sm overflow-hidden bg-white" style={{ border: '1px solid rgba(21,41,74,0.10)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(21,41,74,0.08)' }}>
              <h2 className="text-[13px] font-bold text-navy">Digital Identity</h2>
            </div>
            <div className="p-5 space-y-4">

              {/* ID Card visual */}
              <div className="rounded-sm p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #15294A 0%, #0E1B31 100%)', border: '1px solid rgba(196,154,78,0.25)' }}>
                <div className="absolute top-0 right-0 left-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #C49A4E, transparent)' }} />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-gold/70 mb-2">Covenant State of Aletheia</div>
                    <div className="text-lg font-bold text-parchment">Dr. Elena Vasquez</div>
                    <div className="text-[11px] text-parchment/50 mt-0.5">E-Resident · Valid 2029-10-01</div>
                    <div className="mt-3 flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-gold/60" />
                      <span className="text-[10px] font-mono text-parchment/50">0x4F82...A209148</span>
                      <button onClick={copyKey} className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(196,154,78,0.15)', color: '#C49A4E' }}>
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-sm flex items-center justify-center shrink-0" style={{ background: 'rgba(196,154,78,0.12)', border: '1px solid rgba(196,154,78,0.25)' }}>
                    <User className="w-7 h-7 text-gold/50" />
                  </div>
                </div>
                <div className="mt-4 pt-4 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(196,154,78,0.12)' }}>
                  {[
                    { label: 'ICAO eMRTD', status: 'Active' },
                    { label: 'Biometric', status: 'Enrolled' },
                    { label: 'AEY Wallet', status: 'Linked' },
                  ].map(({ label, status }) => (
                    <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-sm" style={{ background: 'rgba(61,134,100,0.15)', border: '1px solid rgba(61,134,100,0.25)' }}>
                      <CheckCircle2 className="w-3 h-3 text-laurel" />
                      <span className="text-[9px] font-bold text-laurel">{label} · {status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Download ID', icon: Download, href: '/portal/documents' },
                  { label: 'Renew Residency', icon: ArrowRight, href: '/portal/apply' },
                  { label: 'AEY Wallet', icon: CreditCard, href: '/portal/wallet' },
                ].map(({ label, icon: Icon, href }) => (
                  <Link key={href} href={href} className="flex flex-col items-center gap-2 p-3 rounded-sm text-center transition-all"
                    style={{ background: 'rgba(21,41,74,0.04)', border: '1px solid rgba(21,41,74,0.10)' }}>
                    <Icon className="w-4 h-4 text-navy/50" />
                    <span className="text-[10px] font-semibold text-navy/60">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="rounded-sm overflow-hidden bg-white" style={{ border: '1px solid rgba(21,41,74,0.10)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(21,41,74,0.08)' }}>
              <h2 className="text-[13px] font-bold text-navy">Recent Activity</h2>
            </div>
            <div className="p-4 space-y-3">
              {TIMELINE.map(({ date, event, status }) => (
                <div key={date} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#3D8664' }} />
                    <div className="w-px flex-1 mt-1" style={{ background: 'rgba(21,41,74,0.10)' }} />
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-[11px] font-semibold text-navy leading-snug">{event}</p>
                    <p className="text-[9px] text-navy/40 mt-0.5 font-mono">{date}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <Link href="/portal/notifications" className="text-[11px] font-bold text-gold hover:text-gold-shadow flex items-center gap-1">
                View all activity <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </PortalShell>
  );
}
