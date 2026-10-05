'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  Settings,
  User,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Lock,
  Globe2,
  Mail,
  Bell,
} from 'lucide-react';
import { getUserSession, setUserSession } from '@/lib/auth';

export default function PortalSettingsPage() {
  const { t, tx } = useI18n();
  const session = getUserSession();
  const [name, setName] = useState(session.name || 'Dr. Elena Vasquez');
  const [email, setEmail] = useState('elena.vasquez@kaelenmarine.ale');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyLedger, setNotifyLedger] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUserSession({ name });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
                  <span className="text-navy font-bold font-mono">{t("ALE-ERES-2026-004928")}</span>
                </div>
                <div>
                  <span className="text-navy/40 block">{t("Identity Tier")}</span>
                  <span className="text-emerald-700 font-bold font-mono">{t("Tier I Biometric Verified")}</span>
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
                <span className="text-navy text-xs">{t("Emit instant ledger webhook pulses upon AEY payment finality")}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors"
            >{t("Save Profile Settings")}</button>
          </div>
        </form>
      </div>
    </PortalShell>
  );
}
