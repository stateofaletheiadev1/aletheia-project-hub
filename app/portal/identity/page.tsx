'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/PortalShell';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  Fingerprint,
  ShieldCheck,
  Copy,
  CheckCircle2,
  QrCode,
  Download,
  KeyRound,
  ExternalLink,
  Lock,
} from 'lucide-react';

export default function PortalDigitalIdentityPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDid, setCopiedDid] = useState(false);

  const publicKey = '0x4F829104A18E9B20CA7891230BFE92147A209148';
  const didUri = 'did:aletheia:0x4F829104A18E9B20CA7891230BFE92147A209148';

  const handleCopyKey = () => {
    navigator.clipboard.writeText(publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyDid = () => {
    navigator.clipboard.writeText(didUri);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2000);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">My Sovereign Digital Identity</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Tier I Verified
              </span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">
              Self-sovereign cryptographic credential issued under Covenant State Digital Identity Charter § 3
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/portal/biometrics"
              className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
            >
              <Fingerprint className="w-3.5 h-3.5 text-gold" />
              <span>Biometric Keys</span>
            </Link>
          </div>
        </div>

        {/* Identity Card Display */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Visual Sovereign Card */}
            <div
              className="p-6 rounded-sm text-parchment relative overflow-hidden shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #0E1B31 0%, #15294A 100%)',
                border: '1px solid rgba(196,154,78,0.3)',
              }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-gold/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <StarOfTruth size={24} />
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold block">
                      The Covenant State of Aletheia
                    </span>
                    <span className="text-[9px] text-parchment/50">Official Civic Digital Identity Credential</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-sm bg-gold/20 text-gold border border-gold/40 text-[9px] font-mono font-bold uppercase">
                  ICAO eMRTD Compliant
                </span>
              </div>

              <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-navy shrink-0 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #E4C689, #C49A4E)' }}
                  >
                    EV
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-parchment font-sans">Dr. Elena Vasquez</h2>
                    <p className="text-gold text-xs font-mono mt-0.5">E-Resident · Founder</p>
                    <p className="text-[11px] text-parchment/60 font-mono mt-0.5">National ID: ALE-ERES-2026-004928</p>
                  </div>
                </div>

                <div className="text-right sm:text-right font-mono text-xs text-parchment/60 space-y-1">
                  <div>Issued: <strong className="text-parchment">2026-10-01</strong></div>
                  <div>Expires: <strong className="text-gold">2029-10-01</strong></div>
                  <div>Clearance: <strong className="text-emerald-400">Civil &amp; Enterprise</strong></div>
                </div>
              </div>

              {/* DID Details */}
              <div className="pt-4 border-t border-gold/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gold uppercase tracking-wider text-[10px] font-bold">Public Cryptographic Key</span>
                  <button
                    onClick={handleCopyKey}
                    className="flex items-center gap-1 text-[11px] text-parchment/70 hover:text-gold transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey ? 'Copied to clipboard' : 'Copy Key'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-sm bg-navy-deep/80 border border-gold/20 text-[11px] font-mono text-gold break-all">
                  {publicKey}
                </div>
              </div>
            </div>

            {/* Credential Attributes */}
            <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                Verified Civic Attributes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">Decentralised Identifier (DID)</span>
                  <div className="flex items-center justify-between">
                    <span className="text-navy font-bold truncate max-w-[200px]">{didUri}</span>
                    <button onClick={handleCopyDid} className="text-gold text-[10px] hover:underline">
                      {copiedDid ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">Covenant Oath Anchor</span>
                  <span className="text-emerald-700 font-bold">Signed on Block #8,421,902</span>
                </div>

                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">KYC Verification Authority</span>
                  <span className="text-navy font-bold">ADSS General Registry § 4</span>
                </div>

                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">Cryptographic Key Type</span>
                  <span className="text-navy font-bold">Ed25519 + ML-KEM Post-Quantum</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: QR Verification & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4 text-center">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                Instant Verification QR
              </h3>
              <p className="text-[11px] text-navy/60">
                Scan with any sovereign e-Gate terminal or civic verification reader
              </p>

              <div className="w-40 h-40 mx-auto bg-parchment-light border border-navy/15 rounded-sm p-3 flex flex-col items-center justify-center">
                <QrCode className="w-28 h-28 text-navy" />
                <span className="text-[9px] font-mono text-navy/40 mt-1">did:aletheia:0x4F82...</span>
              </div>

              <div className="pt-2">
                <Link
                  href="/portal/documents"
                  className="w-full py-2 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-gold" />
                  <span>Download Digital Credential</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
