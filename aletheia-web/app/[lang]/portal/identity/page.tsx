'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { downloadPortalDocument } from '@/lib/pdf/portal';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { StarOfTruth } from '@/components/brand/Logo';
import { api, reload, setCached, useApi } from '@/lib/client/api';
import { day, ME, type PortalAccount, type PortalDocument } from '@/lib/auth';
import {
  Fingerprint,
  Copy,
  Download,
} from 'lucide-react';

export default function PortalDigitalIdentityPage() {
  const { t, tx, intl } = useI18n();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDid, setCopiedDid] = useState(false);
  const me = useApi<{ account: PortalAccount }>(ME);
  const docs = useApi<{ documents: PortalDocument[] }>('/api/portal/documents');
  const account = me.data?.account;
  const credential = docs.data?.documents.find((d) => d.kind === 'digital-credential') ?? docs.data?.documents.find((d) => d.kind === 'e-residence-certificate');

  const [oathName, setOathName] = useState('');
  const [sworn, setSworn] = useState(false);
  const [oathError, setOathError] = useState<string | null>(null);
  const [swearing, setSwearing] = useState(false);
  const oath = useApi<{ oath: string }>(account?.oathPending ? '/api/portal/oath' : null);

  const swear = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwearing(true);
    setOathError(null);
    try {
      const r = await api<{ account: PortalAccount }>('/api/portal/oath', { body: { name: oathName, sworn } });
      setCached(ME, r);
      await Promise.all([reload('/api/portal/documents'), reload('/api/portal/notifications'), reload('/api/portal/dashboard')]);
    } catch (err) {
      setOathError(err instanceof Error ? err.message : t('The oath could not be recorded.'));
    }
    setSwearing(false);
  };

  const publicKey = account?.publicKey ?? t('No identity key enrolled yet. It is created when you apply.');
  const didUri = account?.did ?? '';

  const handleCopyKey = () => {
    if (account?.publicKey) navigator.clipboard.writeText(account.publicKey);
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
        {tx(account?.oathPending && (
          <form onSubmit={swear} className="p-6 rounded-sm bg-white border-2 border-gold/60 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-navy">{t("Your citizenship has been granted: swear the oath")}</h2>
            <p className="text-xs text-navy/70">{t('Your national ID {id} is reserved. Citizenship takes effect, and your passport number is issued, when you swear the oath of allegiance.', { id: account.oathPending.nationalId })}</p>
            <blockquote className="p-4 bg-parchment-light border-l-4 border-gold text-sm text-navy italic">{tx(oath.data?.oath ?? '')}</blockquote>
            <label className="block space-y-1 text-[11px] font-bold text-navy uppercase tracking-wider">{t("Type your full name")}
              <input required value={oathName} onChange={(e) => setOathName(e.target.value)} className="w-full px-3 py-2 text-sm border border-navy/20 rounded-sm text-navy normal-case font-normal tracking-normal" />
            </label>
            <label className="flex items-start gap-2 text-xs text-navy">
              <input type="checkbox" checked={sworn} onChange={(e) => setSworn(e.target.checked)} className="mt-0.5" />
              <span>{t("I swear this oath freely and in good faith.")}</span>
            </label>
            {tx(oathError && <p role="alert" className="text-xs font-semibold text-red-700">{tx(oathError)}</p>)}
            <button type="submit" disabled={!sworn || swearing} className="px-5 py-2 bg-gold text-navy text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-gold-tint disabled:opacity-50">{t("Swear the oath")}</button>
          </form>
        ))}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("My Sovereign Digital Identity")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{tx(account?.statusLabel ?? '')}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Self-sovereign cryptographic credential issued under Sovereign Covenant State Digital Identity Charter § 3")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/portal/biometrics"
              className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
            >
              <Fingerprint className="w-3.5 h-3.5 text-gold" />
              <span>{t("Biometric Keys")}</span>
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
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold block">{t("The Sovereign Covenant State of Aletheia")}</span>
                    <span className="text-[9px] text-parchment/50">{t("Official Civic Digital Identity Credential")}</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-sm bg-gold/20 text-gold border border-gold/40 text-[9px] font-mono font-bold uppercase">{t("ICAO eMRTD Compliant")}</span>
              </div>

              <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-navy shrink-0 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #E4C689, #C49A4E)' }}
                  >{tx(account?.avatarInitials ?? '')}</div>
                  <div>
                    <h2 className="text-xl font-bold text-parchment font-sans">{tx(account?.name ?? '')}</h2>
                    <p className="text-gold text-xs font-mono mt-0.5">{tx(account?.role ?? '')}</p>
                    <p className="text-[11px] text-parchment/60 font-mono mt-0.5">{t('Registry ID: {id}', { id: account?.id ?? '' })}</p>
                    {tx(account?.nationalId && <p className="text-[11px] text-parchment/60 font-mono mt-0.5">{t('National ID: {id}', { id: account.nationalId })}</p>)}
                    {tx(account?.passportNumber && <p className="text-[11px] text-parchment/60 font-mono mt-0.5">{t('Passport: {id}', { id: account.passportNumber })}</p>)}
                  </div>
                </div>

                <div className="text-right sm:text-right font-mono text-xs text-parchment/60 space-y-1">
                  <div>{t("Issued:")}{' '}<strong className="text-parchment">{day(account?.residency?.validFrom ?? account?.createdAt, intl)}</strong></div>
                  <div>{t("Expires:")}{' '}<strong className="text-gold">{account?.residency ? day(account.residency.validUntil, intl) : '—'}</strong></div>
                </div>
              </div>

              {/* DID Details */}
              <div className="pt-4 border-t border-gold/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gold uppercase tracking-wider text-[10px] font-bold">{t("Public Cryptographic Key")}</span>
                  <button
                    onClick={handleCopyKey}
                    className="flex items-center gap-1 text-[11px] text-parchment/70 hover:text-gold transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{tx(copiedKey ? 'Copied to clipboard' : 'Copy Key')}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-sm bg-navy-deep/80 border border-gold/20 text-[11px] font-mono text-gold break-all">
                  {tx(publicKey)}
                </div>
              </div>
            </div>

            {/* Credential Attributes */}
            <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Verified Civic Attributes")}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">{t("Decentralised Identifier (DID)")}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-navy font-bold truncate max-w-[200px]">{tx(didUri)}</span>
                    <button onClick={handleCopyDid} className="text-gold text-[10px] hover:underline">
                      {tx(copiedDid ? 'Copied' : 'Copy')}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">{t("Key enrolled")}</span>
                  <span className="text-emerald-700 font-bold">{account?.keyRotatedAt ? day(account.keyRotatedAt, intl) : '—'}</span>
                </div>

                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">{t("KYC Verification Authority")}</span>
                  <span className="text-navy font-bold">{t("ADSS General Registry § 4")}</span>
                </div>

                <div className="p-3 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/45 uppercase block">{t("Cryptographic Key Type")}</span>
                  <span className="text-navy font-bold">{t("Ed25519")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: QR Verification & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4 text-center">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Your Credential")}</h3>
              <p className="text-[11px] text-navy/60">{t("Officers verify you by your registry ID and identifier")}</p>

              <div className="mx-auto bg-parchment-light border border-navy/15 rounded-sm p-4 flex flex-col items-center justify-center gap-2">
                <Fingerprint className="w-10 h-10 text-navy" />
                <span className="text-[10px] font-mono text-navy/60 break-all" translate="no">{didUri}</span>
              </div>

              <div className="pt-2">
                <button
                type="button"
                disabled={!credential || !account}
                onClick={() => credential?.kind && account && void downloadPortalDocument(credential.kind, credential.name, account, credential)}
                className="w-full py-2 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center justify-center gap-1.5"
              >
                  <Download className="w-3.5 h-3.5 text-gold" />
                  <span>{t("Download Digital Credential")}</span>
                </button>
                {tx(!credential && <p className="text-[10px] text-navy/50 mt-2">{t("Available once an application is approved.")}</p>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
