'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  KeyRound,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';

import { OFFICER_ME, type OfficerProfile } from '@/lib/auth';
import { api, ApiError, clearCache, setCached } from '@/lib/client/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [officerId, setOfficerId] = useState('');
  const [pin, setPin] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsVerifying(true);
    setError(null);
    try {
      const { officer } = await api<{ officer: OfficerProfile }>('/api/admin/auth/login', { body: { username: officerId, passphrase: pin, code: totpCode } });
      clearCache();
      setCached(OFFICER_ME, { officer });
      router.push('/admin');
    } catch (err) {
      // Officers who switched on the authenticator code are asked for it after the passphrase.
      if (err instanceof ApiError && err.data.needsCode) setNeedsCode(true);
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setIsVerifying(false);
    }
  };

  const fieldStyle = { background: 'rgba(14,27,49,0.80)', border: '1px solid rgba(196,154,78,0.20)', color: '#F4EEDF' };
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'rgba(196,154,78,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(196,154,78,0.08)'; };
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'rgba(196,154,78,0.20)'; e.target.style.boxShadow = 'none'; };

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

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="officer-id" className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">Username</label>
                  <input id="officer-id" type="text" required autoComplete="username" placeholder="Officer ID or email" value={officerId} onChange={(e) => setOfficerId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none font-mono" style={fieldStyle} onFocus={focus} onBlur={blur} />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="officer-pass" className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">Password</label>
                  <div className="relative">
                    <input id="officer-pass" type={showPin ? 'text' : 'password'} required autoComplete="current-password" placeholder="Password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none font-mono" style={fieldStyle} onFocus={focus} onBlur={blur} />
                    <button type="button" aria-label="Show or hide passphrase" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'rgba(244,238,223,0.35)' }}>
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {needsCode && (
                <div className="space-y-1.5">
                  <label htmlFor="officer-code" className="text-[10px] font-mono font-bold tracking-[0.20em] uppercase text-gold block">6-digit authenticator code</label>
                  <input
                    id="officer-code"
                    type="text"
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9 ]{6,7}"
                    placeholder="000 000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    maxLength={7}
                    className="w-full px-4 py-3 text-center text-lg font-extrabold tracking-[0.4em] rounded-sm focus:outline-none font-mono"
                    style={{ ...fieldStyle, color: '#C49A4E', letterSpacing: '0.4em' }}
                    onFocus={focus}
                    onBlur={blur}
                  />
                </div>
                )}

                {error && (
                  <p role="alert" className="text-[12px] font-semibold px-3 py-2 rounded-sm" style={{ background: 'rgba(192,57,43,0.12)', color: '#fca5a5', border: '1px solid rgba(192,57,43,0.35)' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="btn-sovereign-gold btn-shimmer w-full py-3.5 rounded-sm flex items-center justify-center gap-2.5 text-sm font-bold"
                >
                  {isVerifying ? (
                    <><Zap className="w-4 h-4 animate-pulse" /> Validating…</>
                  ) : (
                    <><KeyRound className="w-4 h-4" /> Authorize Console Session <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

          {/* Footnote */}
          <p className="text-center text-[10px] font-mono mt-4" style={{ color: 'rgba(244,238,223,0.20)' }}>
            All access attempts are logged and auditable under Covenant Law § 19
          </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
