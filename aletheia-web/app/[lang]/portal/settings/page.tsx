'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';
import { User, CheckCircle2, Bell } from 'lucide-react';
import { ME, type PortalAccount } from '@/lib/auth';
import { api, setCached, useApi } from '@/lib/client/api';

export default function PortalSettingsPage() {
  const { t, tx } = useI18n();
  const me = useApi<{ account: PortalAccount }>(ME);
  const account = me.data?.account;
  // Edits start from the saved profile; nothing is copied into state until the person types.
  const [draft, setDraft] = useState<{ name: string; email: string; notifyEmail: boolean; notifyLedger: boolean } | null>(null);
  const form = draft ?? { name: account?.name ?? '', email: account?.email ?? '', notifyEmail: account?.notifyEmail ?? true, notifyLedger: account?.notifyLedger ?? true };
  const edit = (patch: Partial<typeof form>) => setDraft({ ...form, ...patch });
  const { name, email, notifyEmail, notifyLedger } = form;
  const setName = (v: string) => edit({ name: v });
  const setEmail = (v: string) => edit({ email: v });
  const setNotifyEmail = (v: boolean) => edit({ notifyEmail: v });
  const setNotifyLedger = (v: boolean) => edit({ notifyLedger: v });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pass, setPass] = useState({ current: '', next: '' });
  const [passNotice, setPassNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { account: updated } = await api<{ account: PortalAccount }>(ME, { method: 'PATCH', body: form });
      setCached(ME, { account: updated });
      setDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Your settings could not be saved.'));
    }
  };

  const handlePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/portal/me/passphrase', { body: pass });
      setPass({ current: '', next: '' });
      setPassNotice({ ok: true, text: t('Passphrase changed. Your other devices have been signed out.') });
    } catch (err) {
      setPassNotice({ ok: false, text: err instanceof Error ? err.message : t('The passphrase could not be changed.') });
    }
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy">{t("Profile & Account Settings")}</h1>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Manage personal contact information, cryptographic credentials, and notification preferences")}</p>
          </div>
        </div>

        {tx(saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs font-mono text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t("Profile and notification preferences successfully saved.")}</span>
          </div>
        ))}

        <form onSubmit={handleSave} className="space-y-6 max-w-2xl text-xs font-mono">
          {/* Identity Information */}
          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-gold" />
              <span>{t("Civic Profile Information")}</span>
            </h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-navy/60 block">{t("Full Name")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-parchment-light border border-navy/15 rounded-sm text-navy focus:outline-none focus:border-gold font-sans font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-navy/60 block">{t("Official Contact Email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-parchment-light border border-navy/15 rounded-sm text-navy focus:outline-none focus:border-gold font-sans font-medium text-xs"
                />
              </div>

              <div className="pt-2 border-t border-navy/5 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-navy/40 block">{t("E-Residency ID")}</span>
                  <span className="text-navy font-bold font-mono">{tx(account?.id ?? '')}</span>
                </div>
                <div>
                  <span className="text-navy/40 block">{t("Identity Tier")}</span>
                  <span className="text-emerald-700 font-bold font-mono">{tx(account?.statusLabel ?? '')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-gold" />
              <span>{t("Notification Dispatch Preferences")}</span>
            </h3>

            <div className="space-y-3 font-sans">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="rounded-sm accent-[#C49A4E]"
                />
                <span className="text-navy text-xs">{t("Dispatch statutory renewal and corporate notices to official email")}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyLedger}
                  onChange={(e) => setNotifyLedger(e.target.checked)}
                  className="rounded-sm accent-[#C49A4E]"
                />
                <span className="text-navy text-xs">{t("Notify me in the portal when AEY arrives in my wallet")}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors"
            >{t("Save Profile Settings")}</button>
          {tx(error && <p role="alert" className="text-xs font-semibold text-red-700">{tx(error)}</p>)}
          </div>
        </form>

        <form onSubmit={handlePassphrase} className="space-y-3 max-w-2xl text-xs font-mono p-6 rounded-sm bg-white border border-navy/10">
          <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Change passphrase")}</h3>
          <input type="password" required autoComplete="current-password" aria-label={t("Current passphrase")} placeholder={t("Current passphrase")} value={pass.current} onChange={(e) => setPass({ ...pass, current: e.target.value })} className="w-full px-3 py-2 border border-navy/20 rounded-sm text-navy" />
          <input type="password" required minLength={12} autoComplete="new-password" aria-label={t("New passphrase")} placeholder={t("New passphrase (12+ characters)")} value={pass.next} onChange={(e) => setPass({ ...pass, next: e.target.value })} className="w-full px-3 py-2 border border-navy/20 rounded-sm text-navy" />
          {tx(passNotice && <p role="status" className={`font-semibold ${passNotice.ok ? 'text-emerald-700' : 'text-red-700'}`}>{tx(passNotice.text)}</p>)}
          <button type="submit" className="px-6 py-2.5 bg-navy text-parchment font-bold rounded-sm hover:bg-navy-deep transition-colors">{t("Change passphrase")}</button>
        </form>
      </div>
    </PortalShell>
  );
}
