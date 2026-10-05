'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { useRouter } from '@/lib/i18n/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import {
  Fingerprint, KeyRound, QrCode, ShieldCheck, ArrowRight,
  Lock, CheckCircle2, Sparkles, Smartphone, Eye, EyeOff, Zap,
} from 'lucide-react';

import { setUserSession } from '@/lib/auth';

const TRUST_ITEMS = [
  { label: 'ICAO eMRTD Compliant', icon: ShieldCheck, color: '#3D8664' },
  { label: 'Zero-Knowledge Auth', icon: Lock, color: '#C49A4E' },
  { label: 'Biometric Secured', icon: Fingerprint, color: '#8B5CF6' },
];

export default function CitizenPortalLoginPage() {
  const { t, tx } = useI18n();
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<'passkey' | 'credentials' | 'qr'>('passkey');
  const [credentialId, setCredentialId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const timer = setTimeout(() => setMounted(true), 60); return () => clearTimeout(timer); }, []);

  const handleAuthenticate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAuthenticating(true);
    setUserSession({
      id: credentialId || 'ALE-ERES-2026-004928',
      name: 'Dr. Elena Vasquez',
      role: 'E-Resident · Founder',
      status: 'E-Resident · Verified',
      avatarInitials: 'EV',
    });
    setTimeout(() => { setIsAuthenticating(false); router.push('/portal'); }, 1200);
  };

  const handleDemoSignIn = () => {
    setCredentialId('ALE-ERES-2026-004928');
    setIsAuthenticating(true);
    setUserSession({ id: 'ALE-ERES-2026-004928', name: 'Dr. Elena Vasquez', role: 'E-Resident · Founder', status: 'E-Resident · Verified', avatarInitials: 'EV' });
    setTimeout(() => { router.push('/portal'); }, 1200);
  };

  return (
    <div className="flex min-h-screen overflow-hidden">

      {/* ── LEFT DECORATIVE PANEL (desktop only) ── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #15294A 0%, #0D1B35 50%, #060C14 100%)' }}
      >
        {/* Background orbs */}
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full animate-orb-float-1" style={{ background: 'radial-gradient(circle, rgba(196,154,78,0.20) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full animate-orb-float-2" style={{ background: 'radial-gradient(circle, rgba(47,107,79,0.15) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        </div>

        {/* Hexagonal grid */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hex-p" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
                <polygon points="28,2 54,16 54,44 28,58 2,44 2,16" fill="none" stroke="#C49A4E" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex-p)" />
          </svg>
        </div>

        {/* Top gold hairline */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #C49A4E 50%, transparent)' }} />

        {/* Branding */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group mb-16">
            <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: 'rgba(196,154,78,0.15)', border: '1px solid rgba(196,154,78,0.35)' }}>
              <StarOfTruth size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold">{t("Aletheia")}</div>
              <div className="text-[9px]" style={{ color: 'rgba(244,238,223,0.40)' }}>{t("Sovereign Civic Portal")}</div>
            </div>
          </Link>

          <div className="space-y-4 max-w-xs">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight" style={{ color: '#F4EEDF' }}>{t("Your sovereign")}<br />
              <span className="text-gradient-shift">{t("digital identity.")}</span>
            </h1>
            <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(244,238,223,0.55)' }}>{t("Access your e-residency status, digital passport, AEY wallet, and company registrations — all in one secure portal.")}</p>
          </div>
        </div>

        {/* Feature checklist */}
        <div className="relative z-10 space-y-4">
          {[
            'Zero-knowledge cryptographic authentication',
            'Real-time identity verification on-chain',
            'Immutable civic record management',
            'ICAO eMRTD biometric passport access',
          ].map(feat => (
            <div key={feat} className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#3D8664' }} />
              <span className="text-[12px]" style={{ color: 'rgba(244,238,223,0.65)' }}>{tx(feat)}</span>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="relative z-10 flex items-center gap-4 pt-8" style={{ borderTop: '1px solid rgba(196,154,78,0.12)' }}>
          {TRUST_ITEMS.map(({ label, icon: Icon, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}28` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span className="text-[8px] leading-tight" style={{ color: 'rgba(244,238,223,0.35)' }}>{tx(label)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT SIGN-IN PANEL ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 relative"
        style={{ background: '#F2EFE6' }}
      >
        {/* Subtle bg texture */}
        <div className="absolute inset-0 pointer-events-none portal-login-bg" />

        <div className={`w-full max-w-sm relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: '#15294A', border: '1px solid rgba(196,154,78,0.35)' }}>
                <StarOfTruth size={18} />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold">{t("Aletheia")}</div>
                <div className="text-[9px] text-navy/50">{t("Civic Services Portal")}</div>
              </div>
            </Link>
          </div>

          <div className="space-y-1 mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: '#15294A' }}>{t("Welcome back")}</h2>
            <p className="text-sm" style={{ color: 'rgba(21,41,74,0.55)' }}>{t("Sign in to your Aletheia civic portal")}</p>
          </div>

          {/* Auth method tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-sm mb-6" style={{ background: 'rgba(21,41,74,0.06)', border: '1px solid rgba(21,41,74,0.10)' }}>
            {([
              { key: 'passkey', label: 'Passkey', icon: Fingerprint },
              { key: 'credentials', label: 'ID + Pass', icon: KeyRound },
              { key: 'qr', label: 'QR Code', icon: QrCode },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setAuthMethod(key)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-sm text-[11px] font-bold transition-all ${authMethod === key ? 'text-navy shadow-sm' : 'text-navy/45 hover:text-navy/65'}`}
                style={authMethod === key ? { background: '#FFFFFF', boxShadow: '0 1px 3px rgba(21,41,74,0.10)' } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {tx(label)}
              </button>
            ))}
          </div>

          {/* Passkey method */}
          {tx(authMethod === 'passkey' && (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-6 gap-4">
                <button
                  type="button"
                  onClick={() => handleAuthenticate()}
                  className="w-20 h-20 rounded-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative"
                  style={{ background: 'linear-gradient(135deg, #15294A, #0D1B35)', border: '2px solid rgba(196,154,78,0.40)', boxShadow: '0 0 32px rgba(196,154,78,0.18)' }}
                >
                  <div className="absolute inset-0 rounded-sm" style={{ background: 'radial-gradient(circle, rgba(196,154,78,0.12) 0%, transparent 70%)' }} />
                  <Fingerprint className="w-9 h-9 text-gold relative z-10" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: '#15294A' }}>{t("Tap to authenticate")}</p>
                  <p className="text-[11px] mt-1" style={{ color: 'rgba(21,41,74,0.50)' }}>{t("Use your device passkey or biometric")}</p>
                </div>
              </div>

              <button
                type="button"
                disabled={isAuthenticating}
                onClick={() => handleAuthenticate()}
                className="btn-sovereign-gold btn-shimmer w-full py-3.5 rounded-sm flex items-center justify-center gap-2.5 text-sm font-bold"
              >
                {tx(isAuthenticating
                  ? <><Zap className="w-4 h-4 animate-pulse" />{' '}{t("Authenticating Identity…")}</>
                  : <><Fingerprint className="w-4 h-4" />{' '}{t("Authenticate with Passkey")}{' '}<ArrowRight className="w-4 h-4" /></>)
                }
              </button>
            </div>
          ))}

          {/* Credentials method */}
          {tx(authMethod === 'credentials' && (
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(21,41,74,0.55)' }}>{t("Aletheia ID / E-Residency Number")}</label>
                <input
                  type="text"
                  placeholder={t("e.g. ALE-ERES-2026-004928")}
                  value={credentialId}
                  onChange={e => setCredentialId(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none font-mono"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(21,41,74,0.14)', color: '#15294A' }}
                  onFocus={e => { e.target.style.borderColor = '#C49A4E'; e.target.style.boxShadow = '0 0 0 3px rgba(196,154,78,0.10)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(21,41,74,0.14)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(21,41,74,0.55)' }}>{t("Passphrase")}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder={t("Your sovereign passphrase")}
                    value={passphrase}
                    onChange={e => setPassphrase(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-sm focus:outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid rgba(21,41,74,0.14)', color: '#15294A' }}
                    onFocus={e => { e.target.style.borderColor = '#C49A4E'; e.target.style.boxShadow = '0 0 0 3px rgba(196,154,78,0.10)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(21,41,74,0.14)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(21,41,74,0.35)' }}>
                    {tx(showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />)}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="btn-sovereign-gold btn-shimmer w-full py-3.5 rounded-sm flex items-center justify-center gap-2 text-sm font-bold"
              >
                {tx(isAuthenticating
                  ? <><Zap className="w-4 h-4 animate-pulse" />{' '}{t("Verifying Identity…")}</>
                  : <><Lock className="w-4 h-4" />{' '}{t("Sign In Securely")}{' '}<ArrowRight className="w-4 h-4" /></>)
                }
              </button>
            </form>
          ))}

          {/* QR method */}
          {tx(authMethod === 'qr' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="p-4 rounded-sm" style={{ background: '#FFFFFF', border: '2px solid rgba(21,41,74,0.12)', boxShadow: '0 4px 20px rgba(21,41,74,0.08)' }}>
                <div className="w-40 h-40 bg-navy/5 rounded-sm flex items-center justify-center relative">
                  <QrCode className="w-24 h-24" style={{ color: '#15294A' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-sm bg-white flex items-center justify-center">
                      <StarOfTruth size={14} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold" style={{ color: '#15294A' }}>{t("Scan with Aletheia App")}</p>
                <p className="text-[11px]" style={{ color: 'rgba(21,41,74,0.50)' }}>{t("Open your Aletheia authenticator and scan this code")}</p>
              </div>
            </div>
          ))}

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(21,41,74,0.10)' }} />
            <span className="text-[10px] font-bold" style={{ color: 'rgba(21,41,74,0.30)' }}>{t("OR")}</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(21,41,74,0.10)' }} />
          </div>

          {/* Demo button */}
          <button
            type="button"
            onClick={handleDemoSignIn}
            className="w-full py-3 rounded-sm text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{ background: 'rgba(21,41,74,0.06)', border: '1px solid rgba(21,41,74,0.12)', color: '#15294A' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(21,41,74,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(21,41,74,0.06)'; }}
          >
            <Sparkles className="w-4 h-4 text-gold" />
            <span>{t("Demo: Dr. Elena Vasquez (E-Resident)")}</span>
          </button>

          {/* New user / return link */}
          <div className="flex items-center justify-between mt-6 pt-5" style={{ borderTop: '1px solid rgba(21,41,74,0.08)' }}>
            <Link href="/e-residency" className="text-[11px] font-bold transition-colors" style={{ color: 'rgba(21,41,74,0.40)' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#C49A4E'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(21,41,74,0.40)'; }}>{t("Apply for E-Residency →")}</Link>
            <Link href="/" className="text-[11px] font-semibold transition-colors" style={{ color: 'rgba(21,41,74,0.40)' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#15294A'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(21,41,74,0.40)'; }}>{t("← Back to Home")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
