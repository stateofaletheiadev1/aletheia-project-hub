'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  Server,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Cpu,
  Fingerprint,
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'smartcard' | 'totp'>('smartcard');
  const [officerId, setOfficerId] = useState('');
  const [pin, setPin] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      router.push('/admin');
    }, 900);
  };

  const handleDemoAdminSignIn = () => {
    setOfficerId('SEC-OFFICER-0091');
    setPin('••••••');
    handleLogin();
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-deep text-parchment">

      {/* ── SECURITY RESTRICTION BANNER ── */}
      <div className="bg-red-950/80 border-b border-red-700/50 py-2.5 px-4 text-center text-xs font-mono text-red-200 flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span>RESTRICTED OFFICIAL ENVIRONMENT · LEVEL 4 CLEARANCE REQUIRED · COVENANT LAW § 19 ENFORCED</span>
      </div>

      {/* ── AUTHENTICATION CENTER ── */}
      <div className="guilloche-bg flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gold/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="w-full max-w-md bg-navy-deep/95 border border-gold/40 rounded-sm p-8 sm:p-10 shadow-2xl space-y-6 relative z-10 gold-glow-intense overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
          
          {/* Header Seal */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3.5 rounded-full bg-navy border border-gold/50 text-gold shadow-xl gold-glow crest-spotlight">
              <StarOfTruth size={34} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-parchment">
                Sovereign Administrative Console
              </h1>
              <p className="text-xs text-gold/80 font-mono mt-1 uppercase tracking-wider">
                General Secretariat of State &amp; ADSS Command
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 bg-navy p-1 rounded-sm border border-gold/20 text-xs font-mono">
            <button
              onClick={() => setAuthMode('smartcard')}
              className={`py-2 rounded-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'smartcard'
                  ? 'bg-navy-deep text-gold border border-gold/40 shadow-sm'
                  : 'text-parchment/60 hover:text-parchment'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> Smartcard / HSM
            </button>

            <button
              onClick={() => setAuthMode('totp')}
              className={`py-2 rounded-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'totp'
                  ? 'bg-navy-deep text-gold border border-gold/40 shadow-sm'
                  : 'text-parchment/60 hover:text-parchment'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> 2FA Token
            </button>
          </div>

          {/* SMARTCARD / HSM TOKEN AUTHENTICATION */}
          {authMode === 'smartcard' && (
            <div className="space-y-5 text-center py-2">
              <div className="w-16 h-16 rounded-sm bg-navy border border-gold/40 mx-auto flex items-center justify-center relative gold-glow">
                <Cpu className="w-8 h-8 text-gold animate-pulse" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-parchment block">Insert PIV / CAC Token</span>
                <p className="text-[11px] text-parchment/70 font-light">
                  Touch security token and enter officer authorization PIN.
                </p>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gold block font-semibold">
                  Security PIN / Token Passphrase
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-navy border border-gold/25 rounded-sm focus:outline-none focus:border-gold text-parchment font-mono"
                />
              </div>

              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleLogin()}
                className="btn-sovereign-gold w-full py-3 rounded-sm flex items-center justify-center gap-2"
              >
                {isVerifying ? 'Verifying Sovereign Credentials...' : 'Authenticate Officer Token'}
              </button>
            </div>
          )}

          {/* TOTP CHALLENGE AUTHENTICATION */}
          {authMode === 'totp' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gold block">
                  Ministry / Portfolio
                </label>
                <select className="w-full px-3 py-2 bg-navy-deep border border-navy/50 rounded-sm text-parchment focus:outline-none focus:border-gold">
                  <option>General Secretariat of State</option>
                  <option>ADSS Immigration & Border Command</option>
                  <option>Ministry of Treasury & Finance</option>
                  <option>Ministry of Digital State & Registries</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gold block">
                  Officer ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEC-OFFICER-0091"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-deep border border-navy/50 rounded-sm text-parchment focus:outline-none focus:border-gold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gold block">
                  6-Digit Hardware TOTP Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 492 810"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-deep border border-navy/50 rounded-sm text-parchment focus:outline-none focus:border-gold text-center text-sm font-bold tracking-widest"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-2.5 bg-gold text-navy font-bold uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
              >
                {isVerifying ? 'Validating Token...' : 'Authorize Console Session'}
              </button>
            </form>
          )}

          {/* Quick Demo Sign-In */}
          <div className="pt-4 border-t border-navy/40 space-y-3">
            <button
              type="button"
              onClick={handleDemoAdminSignIn}
              className="w-full py-2 bg-navy-deep border border-gold/40 text-gold text-xs font-mono font-bold rounded-sm hover:bg-gold/10 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Demo: Duty Officer Thorne (Level 4)</span>
            </button>

            <div className="text-center text-[10px] font-mono text-parchment/40">
              Session is encrypted with Post-Quantum ML-KEM TLS 1.3
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
