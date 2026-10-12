'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { CheckCircle2, KeyRound, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, setCached, useApi } from '@/lib/client/api';
import { generateIdentityKey, saveTextFile } from '@/lib/client/keys';
import { day, ME, type PortalAccount } from '@/lib/auth';

export default function PortalBiometricsPage() {
  const { t, tx, intl } = useI18n();
  const me = useApi<{ account: PortalAccount }>(ME);
  const account = me.data?.account;
  const [rotating, setRotating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // A new Ed25519 pair is made in the browser; the State receives only the public key.
  const handleRotateKeys = async () => {
    setRotating(true);
    setNotice(null);
    try {
      const key = await generateIdentityKey();
      const { account: updated } = await api<{ account: PortalAccount }>('/api/portal/identity/key', { body: { publicKey: key.publicKey } });
      setCached(ME, { account: updated });
      saveTextFile('aletheia-identity-key.pem', key.privatePem);
      setNotice({ ok: true, text: t('New identity key registered. Your private key file has been downloaded: keep it safe.') });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : t('The key could not be rotated.') });
    }
    setRotating(false);
  };

  const cards = [
    {
      icon: KeyRound,
      title: 'Identity key',
      sub: 'Ed25519, made on your device',
      rows: [
        ['Status:', account?.publicKey ? 'Enrolled' : 'Not enrolled'],
        ['Since:', account?.keyRotatedAt ? day(account.keyRotatedAt, intl) : '—'],
      ],
    },
    {
      icon: Lock,
      title: 'Passphrase',
      sub: 'Scrypt-hashed on the server',
      rows: [
        ['Lockout:', 'After 10 failed attempts'],
        ['Last sign-in:', account?.lastSignInAt ? day(account.lastSignInAt, intl) : '—'],
      ],
    },
    {
      icon: ShieldCheck,
      title: 'Sessions',
      sub: 'HttpOnly cookie, server-side',
      rows: [
        ['Idle timeout:', '30 minutes'],
        ['Maximum length:', '12 hours'],
      ],
    },
  ];

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy">{t("Keys & Account Security")}</h1>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Your identity key, passphrase and sessions")}</p>
          </div>
          <button
            type="button"
            onClick={handleRotateKeys}
            disabled={rotating}
            className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gold ${rotating ? 'animate-spin' : ''}`} />
            <span>{tx(rotating ? 'Generating key…' : 'Rotate identity key')}</span>
          </button>
        </div>

        {tx(notice && (
          <div role="status" className={`p-3 border rounded-sm text-xs font-mono flex items-center gap-2 ${notice.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{tx(notice.text)}</span>
          </div>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(({ icon: Icon, title, sub, rows }) => (
            <div key={title} className="p-6 rounded-sm bg-white border border-navy/10 space-y-4 shadow-sm">
              <div className="w-10 h-10 rounded-sm bg-navy/5 border border-navy/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy font-sans">{tx(title)}</h3>
                <p className="text-[11px] text-navy/50 font-sans mt-0.5">{tx(sub)}</p>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-navy/50">{tx(k)}</span>
                    <span className="text-navy font-bold">{tx(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 rounded-sm bg-white border border-gold/30 space-y-2">
          <h4 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Your private key stays with you")}</h4>
          <p className="text-xs text-navy/70 leading-relaxed font-sans">{t("The State stores only your public key. If you lose your private key file, rotate your key here: the old public key is replaced.")}</p>
          <Link href="/portal/settings" className="text-xs font-bold text-gold">{t("Change passphrase →")}</Link>
        </div>
      </div>
    </PortalShell>
  );
}
