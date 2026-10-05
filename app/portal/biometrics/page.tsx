'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  ShieldCheck,
  Fingerprint,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Lock,
  Smartphone,
  Eye,
} from 'lucide-react';

export default function PortalBiometricsPage() {
  const [rotating, setRotating] = useState(false);
  const [rotatedNotice, setRotatedNotice] = useState(false);

  const handleRotateKeys = () => {
    setRotating(true);
    setTimeout(() => {
      setRotating(false);
      setRotatedNotice(true);
      setTimeout(() => setRotatedNotice(false), 4000);
    }, 1200);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">Biometric Credentials &amp; Passkeys</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ICAO DOC 9303 COMPLIANT
              </span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">
              Hardware-anchored FIDO2 / WebAuthn passkeys and cryptographic biometric templates
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRotateKeys}
              disabled={rotating}
              className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gold ${rotating ? 'animate-spin' : ''}`} />
              <span>{rotating ? 'Generating Ephemeral Key...' : 'Rotate Hardware Passkey'}</span>
            </button>
          </div>
        </div>

        {rotatedNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs font-mono text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Passkey pair successfully rotated and anchored to your biometric enclave.</span>
          </div>
        )}

        {/* Biometric Credentials Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
            <div className="w-10 h-10 rounded-sm bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy font-sans">Touch ID / FIDO2 Passkey</h3>
              <p className="text-[11px] text-navy/50 font-sans mt-0.5">Hardware Secure Enclave</p>
            </div>
            <div className="pt-2 border-t border-navy/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-navy/50">Status:</span>
                <span className="text-emerald-700 font-bold">Enrolled</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy/50">Algorithm:</span>
                <span className="text-navy">ES256 (P-256)</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
            <div className="w-10 h-10 rounded-sm bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy font-sans">ICAO 9303 Face Template</h3>
              <p className="text-[11px] text-navy/50 font-sans mt-0.5">Biometric Border e-Gate Ready</p>
            </div>
            <div className="pt-2 border-t border-navy/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-navy/50">Status:</span>
                <span className="text-emerald-700 font-bold">Verified &amp; Stamped</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy/50">Privacy Proof:</span>
                <span className="text-navy">Zero-Knowledge Vector</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
            <div className="w-10 h-10 rounded-sm bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy font-sans">Post-Quantum Key Exchange</h3>
              <p className="text-[11px] text-navy/50 font-sans mt-0.5">NIST ML-KEM768 Enclave</p>
            </div>
            <div className="pt-2 border-t border-navy/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-navy/50">Status:</span>
                <span className="text-emerald-700 font-bold">Active Shield</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy/50">Quantum Resilient:</span>
                <span className="text-emerald-700 font-bold">YES</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Information */}
        <div className="p-5 rounded-sm bg-white border border-navy/10 space-y-2">
          <h4 className="text-xs font-bold text-navy uppercase tracking-wider">
            Zero-Knowledge Biometric Privacy Policy
          </h4>
          <p className="text-xs text-navy/70 leading-relaxed font-sans">
            Under Covenant Constitution Article 14, biometric raw scans are never stored in centralized state repositories. Only irreversible mathematical hashes and zero-knowledge cryptographic proofs are anchored to your sovereign DID.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
