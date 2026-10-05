'use client';

import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { useRouter } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Cpu,
  Fingerprint,
  Eye,
  EyeOff,
  Zap,
  Server,
} from 'lucide-react';

import { setOfficerSession } from '@/lib/auth';

const SECURITY_LEVELS = [
  { label: 'TLS 1.3 Encryption', icon: Lock, color: '#3D8664' },
  { label: 'Post-Quantum ML-KEM', icon: Cpu, color: '#C49A4E' },
  { label: 'FIDO2 Biometric Gate', icon: Fingerprint, color: '#9B59B6' },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'smartcard' | 'totp'>('smartcard');
  const [officerId, setOfficerId] = useState('');
  const [pin, setPin] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsVerifying(true);
    setOfficerSession({
      id: officerId || 'SEC-OFFICER-0091',
      name: officerId.toLowerCase().includes('thorne') ? 'Duty Officer Thorne' : 'Cmdr. S. Okafor',
      role: 'ADSS Senior Registry Officer',
      clearance: 'Level 4 Clearance (National Registry)',
    });
    setTimeout(() => {
      setIsVerifying(false);
      router.push('/admin');
    }, 1200);
  };

  const handleDemoSignIn = () => {
    setOfficerId('SEC-OFFICER-0091');
    setPin('••••••');
    setIsVerifying(true);
    setOfficerSession({
      id: 'SEC-OFFICER-0091',
      name: 'Duty Officer Thorne',
      role: 'ADSS Senior Registry Officer',
      clearance: 'Level 4 Clearance',
    });
    setTimeout(() => { router.push('/admin'); }, 1200);
  };

  return (
    <div className="flex flex-col min-h-screen login-cinematic text-parchment overflow-hidden">

      {/* Animated orbs */}
      <div className="fixed pointer-events-none inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full animate-orb-float-1" style={{ background: 'radial-gradient(circle, rgba(196,154,78,0.18) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full animate-orb-float-2" style={{ background: 'radial-gradient(circle, rgba(112,24,36,0.15) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(21,41,74,0.40) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* Geometric SVG grid overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex-grid" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
              <polygon points="30,2 58,17 58,47 30,62 2,47 2,17" fill="none" stroke="#C49A4E" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-grid)" />
        </svg>
      </div>

      {/* Security restriction banner */}
      <div className="relative z-10 border-b py-2.5 px-4 flex items-center justify-center gap-3 text-xs font-mono" style={{ background: 'rgba(112,24,36,0.25)', borderColor: 'rgba(112,24,36,0.45)', color: 'rgba(252,165,165,0.85)' }}>
        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="tracking-wide">RESTRICTED SOVEREIGN ENVIRONMENT · LEVEL 4 CLEARANCE REQUIRED · COVENANT LAW § 19</span>
      </div>

      {/* Main login area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Card */}
          <div className="relative rounded-sm overflow-hidden" style={{ background: 'rgba(8,13,24,0.94)', border: '1px solid rgba(196,154,78,0.30)' }}>
            {/* Gold hairline top */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #C49A4E 30%, #F5D78E 50%, #C49A4E 70%, transparent)' }} />
            {/* Inner glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(196,154,78,0.10) 0%, transparent 60%)' }} />

            <div className="relative z-10 p-8 sm:p-10 space-y-7">

              {/* Header seal */}
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 rounded-sm mx-auto relative" style={{ background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.40)' }}>
                  <div className="absolute inset-0 rounded-sm" style={{ background: 'radial-gradient(circle, rgba(196,154,78,0.15) 0%, transparent 70%)' }} />
                  <StarOfTruth size={36} />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight" style={{ color: '#F4EEDF' }}>
                    Sovereign Administrative Console
                  </h1>
                  <p className="text-[11px] font-mono mt-1.5 tracking-[0.16em] uppercase" style={{ color: 'rgba(196,154,78,0.70)' }}>
                    General Secretariat of State · ADSS Command
                  </p>
                </div>
              </div>

              {/* Auth mode tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-sm text-xs font-mono" style={{ background: 'rgba(14,27,49,0.70)', border: '1px solid rgba(196,154,78,0.16)' }}>
                {([
                  { key: 'smartcard', label: 'Smartcard / HSM', icon: Cpu },
                  { key: 'totp', label: '2FA TOTP', icon: KeyRound },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAuthMode(key)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-sm font-bold transition-all ${authMode === key ? 'text-gold' : 'text-parchment/50 hover:text-parchment/70'}`}
                    style={authMode === key ? { background: 'rgba(196,154,78,0.12)', border: '1px solid rgba(196,154,78,0.30)' } : {}}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Smartcard mode */}
              {authMode === 'smartcard' && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-3 py-3">
                    <div
                      className="w-16 h-16 rounded-sm flex items-center justify-center relative overflow-hidden"
                      style={{ background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.35)' }}
                    >
                      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(196,154,78,0.12) 0%, transparent 70%)' }} />
                      <Cpu className="w-8 h-8 text-gold animate-breathe relative z-10" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color: '#F4EEDF' }}>Insert PIV / CAC Token</p>
                      <p className="text-[11px] mt-1" style={{ color: 'rgba(244,238,223,0.55)' }}>
                        Touch your security token and enter your officer authorization PIN
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">
                      Security PIN / Token Passphrase
                    </label>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        placeholder="Enter authorization PIN"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none font-mono"
                        style={{ background: 'rgba(14,27,49,0.70)', border: '1px solid rgba(196,154,78,0.22)', color: '#F4EEDF' }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(196,154,78,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(196,154,78,0.08)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(196,154,78,0.22)'; e.target.style.boxShadow = 'none'; }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: 'rgba(244,238,223,0.35)' }}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleLogin()}
                    className="btn-sovereign-gold btn-shimmer w-full py-3.5 rounded-sm flex items-center justify-center gap-2.5 text-sm font-bold"
                  >
                    {isVerifying ? (
                      <>
                        <Zap className="w-4 h-4 animate-pulse" />
                        <span>Authenticating Sovereign Session…</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4" />
                        <span>Authenticate Officer Token</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* TOTP mode */}
              {authMode === 'totp' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">Ministry / Portfolio</label>
                    <select
                      className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none"
                      style={{ background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.20)', color: '#F4EEDF' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(196,154,78,0.55)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(196,154,78,0.20)'; }}
                    >
                      <option style={{ background: '#0E1B31' }}>General Secretariat of State</option>
                      <option style={{ background: '#0E1B31' }}>ADSS Immigration & Border Command</option>
                      <option style={{ background: '#0E1B31' }}>Ministry of Treasury & Finance</option>
                      <option style={{ background: '#0E1B31' }}>Ministry of Digital State & Registries</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">Officer ID</label>
                    <input
                      type="text"
                      placeholder="e.g. SEC-OFFICER-0091"
                      value={officerId}
                      onChange={(e) => setOfficerId(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none font-mono"
                      style={{ background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.20)', color: '#F4EEDF' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(196,154,78,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(196,154,78,0.08)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(196,154,78,0.20)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">6-Digit Hardware TOTP Code</label>
                    <input
                      type="text"
                      placeholder="000 000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      maxLength={7}
                      className="w-full px-4 py-3 text-center text-lg font-extrabold tracking-[0.4em] rounded-sm focus:outline-none font-mono"
                      style={{ background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.20)', color: '#C49A4E', letterSpacing: '0.4em' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(196,154,78,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(196,154,78,0.08)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(196,154,78,0.20)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="btn-sovereign-gold btn-shimmer w-full py-3.5 rounded-sm flex items-center justify-center gap-2.5 text-sm font-bold"
                  >
                    {isVerifying ? (
                      <><Zap className="w-4 h-4 animate-pulse" /> Validating Token…</>
                    ) : (
                      <><KeyRound className="w-4 h-4" /> Authorize Console Session <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(196,154,78,0.12)' }} />
                <span className="text-[10px] font-mono" style={{ color: 'rgba(244,238,223,0.25)' }}>OR DEMO ACCESS</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(196,154,78,0.12)' }} />
              </div>

              {/* Demo button */}
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="w-full py-3 rounded-sm border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all group"
                style={{ background: 'rgba(196,154,78,0.06)', border: '1px solid rgba(196,154,78,0.25)', color: '#C49A4E' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(196,154,78,0.10)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(196,154,78,0.06)'; }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Demo: Duty Officer Thorne (Level 4)</span>
              </button>

              {/* Security badges */}
              <div className="flex items-center justify-center gap-4 pt-2">
                {SECURITY_LEVELS.map(({ label, icon: Icon, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1 group" title={label}>
                    <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-[8px] font-mono text-center leading-tight" style={{ color: 'rgba(244,238,223,0.30)' }}>{label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Return link */}
              <div className="text-center">
                <Link
                  href="/"
                  className="text-[11px] font-mono transition-colors inline-flex items-center gap-1"
                  style={{ color: 'rgba(196,154,78,0.55)' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = '#C49A4E'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(196,154,78,0.55)'; }}
                >
                  ← Return to Official State Platform
                </Link>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <p className="text-center text-[10px] font-mono mt-4" style={{ color: 'rgba(244,238,223,0.20)' }}>
            All access attempts are logged and auditable under Covenant Law § 19
          </p>
        </div>
      </div>
    </div>
  );
}
