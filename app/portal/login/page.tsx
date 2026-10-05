'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Fingerprint,
  KeyRound,
  QrCode,
  ShieldCheck,
  ArrowRight,
  Lock,
  CheckCircle2,
  Sparkles,
  Smartphone,
  AlertCircle,
} from 'lucide-react';

export default function CitizenPortalLoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<'passkey' | 'credentials' | 'qr'>('passkey');
  const [credentialId, setCredentialId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuthenticate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      router.push('/portal');
    }, 900);
  };

  const handleDemoSignIn = () => {
    setCredentialId('ALE-ERES-2026-004928');
    setPassphrase('••••••••••••••••');
    handleAuthenticate();
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── AMBIENT HERO BANNER ── */}
      <section className="relative guilloche-bg text-parchment pt-24 pb-24 lg:pt-32 lg:pb-28 border-b border-gold/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/98 via-navy/90 to-navy-deep pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] mesh-ambient pointer-events-none opacity-40" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 border border-gold/40 bg-navy-deep/90 rounded-sm gold-glow">
            <StarOfTruth size={14} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Civic Identity Gateway</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-parchment leading-tight">
            Sign In to the <span className="text-gold-metallic">Civic Portal</span>
          </h1>

          <p className="text-xs sm:text-sm text-parchment/80 font-light max-w-lg mx-auto leading-relaxed">
            Authenticate using your biometric passkey, sovereign hardware key, or digital credential to access your state registries and corporate entities.
          </p>
        </div>
      </section>

      {/* ── AUTHENTICATION BOX CONTAINER ── */}
      <section className="py-12 lg:py-16 max-w-lg mx-auto px-4 sm:px-6 lg:px-8 w-full -mt-12 relative z-10">
        <div className="sovereign-card bg-white border border-gold/30 rounded-sm p-8 sm:p-10 shadow-2xl space-y-6 gold-glow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
          
          {/* Method Selection Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-parchment-canvas p-1 rounded-sm border border-navy/10 text-xs">
            <button
              onClick={() => setAuthMethod('passkey')}
              className={`py-2 px-2 rounded-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMethod === 'passkey'
                  ? 'bg-navy text-gold shadow-sm border border-gold/20'
                  : 'text-navy/70 hover:text-navy'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Passkey</span>
            </button>

            <button
              onClick={() => setAuthMethod('credentials')}
              className={`py-2 px-2 rounded-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMethod === 'credentials'
                  ? 'bg-navy text-gold shadow-sm border border-gold/20'
                  : 'text-navy/70 hover:text-navy'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>ID &amp; Key</span>
            </button>

            <button
              onClick={() => setAuthMethod('qr')}
              className={`py-2 px-2 rounded-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMethod === 'qr'
                  ? 'bg-navy text-gold shadow-sm border border-gold/20'
                  : 'text-navy/70 hover:text-navy'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Mobile App</span>
            </button>
          </div>

          {/* TAB 1: PASSKEY / WEBAUTHN */}
          {authMethod === 'passkey' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-20 h-20 rounded-full bg-navy/5 border-2 border-dashed border-gold/40 mx-auto flex items-center justify-center relative group">
                <Fingerprint className="w-10 h-10 text-gold-shadow group-hover:text-gold transition-colors animate-pulse" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-navy">TouchID, FaceID or Security Key</h3>
                <p className="text-xs text-navy/60 max-w-xs mx-auto font-light leading-relaxed">
                  Use your device&apos;s cryptographic enclave or FIDO2 hardware token to authenticate instantly.
                </p>
              </div>

              <button
                type="button"
                disabled={isAuthenticating}
                onClick={() => handleAuthenticate()}
                className="btn-sovereign-gold w-full py-3.5 rounded-sm flex items-center justify-center gap-2 group"
              >
                {isAuthenticating ? (
                  <>Verifying Biometric Key...</>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-navy" /> Authenticate with Device Passkey
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: CREDENTIAL ID & PASSPHRASE */}
          {authMethod === 'credentials' && (
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                  Credential ID or Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ALE-ERES-2026-004928"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Cryptographic Passphrase
                  </label>
                  <button type="button" onClick={() => alert('Passphrase recovery is mediated through your registered recovery seed.')} className="text-[10px] text-gold hover:underline">
                    Forgot key?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="Enter state encryption passphrase..."
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2.5 bg-navy text-gold font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-all flex items-center justify-center gap-2"
              >
                {isAuthenticating ? 'Decrypting Key...' : 'Sign In with Cryptographic Key'}
              </button>
            </form>
          )}

          {/* TAB 3: QR CODE SCAN */}
          {authMethod === 'qr' && (
            <div className="space-y-6 text-center py-4">
              <div className="p-4 bg-navy-deep rounded-sm border border-gold/30 inline-block mx-auto shadow-inner">
                <div className="w-36 h-36 bg-white rounded-xs p-2 flex items-center justify-center">
                  <QrCode className="w-32 h-32 text-navy" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-navy">Scan with Aletheia ID App</h3>
                <p className="text-[11px] text-navy/60 max-w-xs mx-auto">
                  Open your mobile biometric sovereign app and point camera to sign in securely.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAuthenticate()}
                className="text-xs text-navy font-bold hover:text-gold transition-colors inline-flex items-center gap-1"
              >
                <Smartphone className="w-3.5 h-3.5" /> Simulate mobile QR scan confirmation
              </button>
            </div>
          )}

          {/* ONE-CLICK DEMO SIGN-IN BUTTON */}
          <div className="pt-4 border-t border-navy/10 space-y-3">
            <button
              type="button"
              onClick={handleDemoSignIn}
              className="w-full py-2 bg-parchment-light border border-gold/40 text-navy text-xs font-bold rounded-sm hover:bg-gold/10 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span>Quick Demo Sign-In (Dr. Thorne-Vance)</span>
            </button>

            <div className="flex justify-between items-center text-[11px] text-navy/60 pt-1">
              <span>Don&apos;t have an e-residency?</span>
              <Link href="/portal/apply" className="font-bold text-gold hover:underline">
                Apply for E-Residency →
              </Link>
            </div>
          </div>

        </div>

        {/* Security Assurance Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-navy/50 font-mono">
          <ShieldCheck className="w-4 h-4 text-laurel" />
          <span>FIPS 140-3 Cryptographic Boundary · Zero Cloud Password Storage</span>
        </div>
      </section>

    </div>
  );
}
