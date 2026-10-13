'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState, useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { useApi } from '@/lib/client/api';
import { day, type ApplicationSummary, type CompanyRecord, type PortalAccount } from '@/lib/auth';
import {
  ShieldCheck,
  Building2,
  CreditCard,
  Clock,
  Download,
  CheckCircle2,
  ArrowRight,
  Globe2,
  User,
  Fingerprint,
  ArrowUpRight,
} from 'lucide-react';

type Dashboard = {
  account: PortalAccount;
  applications: ApplicationSummary[];
  companies: CompanyRecord[];
  timeline: { date: string; event: string; type: 'success' | 'pending' }[];
  unreadNotifications: number;
};

export default function CivicPortalDashboard() {
  const { t, tx, intl } = useI18n();
  const { data } = useApi<Dashboard>('/api/portal/dashboard');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const timer = setTimeout(() => setMounted(true), 60); return () => clearTimeout(timer); }, []);

  const account = data?.account;
  const verified = account?.status === 'e-resident' || account?.status === 'citizen';
  const activeCompanies = (data?.companies ?? []).filter((c) => c.status === 'Active / Chartered');
  const pending = (data?.applications ?? []).filter((a) => a.status === 'Pending');
  const residencyLine = account?.status === 'citizen'
    ? t('Citizen · National ID {id}', { id: account.nationalId ?? '' })
    : account?.residency
      ? t('E-Resident · Valid through {date}', { date: day(account.residency.validUntil, intl) })
      : t('No residency yet');

  const STATUS_CARDS = [
    { label: 'Residency Status', value: account?.role ?? '—', sub: account?.residency ? t('Valid until {date}', { date: day(account.residency.validUntil, intl) }) : t('Apply for e-residency'), icon: Globe2, accent: '#3D8664', bg: 'rgba(47,107,79,0.08)' },
    { label: 'Companies', value: t('{count} Active', { count: activeCompanies.length }), sub: activeCompanies[0]?.name ?? t('None registered yet'), icon: Building2, accent: '#C49A4E', bg: 'rgba(196,154,78,0.08)' },
    { label: 'AEY Balance', value: (account?.balance ?? 0).toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sub: 'Aletheian Guilder', icon: CreditCard, accent: '#15294A', bg: 'rgba(21,41,74,0.06)' },
    { label: 'Pending', value: t('{count} Items', { count: pending.length }), sub: pending[0]?.reference ?? t('Nothing waiting'), icon: Clock, accent: '#E4A628', bg: 'rgba(228,166,40,0.08)' },
  ];

  const copyKey = () => {
    if (!account) return;
    navigator.clipboard.writeText(account.did);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-7">

        {/* ── Welcome Header ── */}
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#15294A' }}>{t('Welcome, {name}', { name: account?.name ?? '' })}</h1>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(21,41,74,0.45)' }}>
              {new Date().toLocaleDateString(intl, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold shrink-0"
            style={{ background: 'rgba(47,107,79,0.10)', border: '1px solid rgba(47,107,79,0.22)', color: '#2F6B4F' }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />{verified ? t("Identity Verified") : t("Application stage")}</div>
        </div>

        {tx(account?.oathPending && (
          <Link href="/portal/identity" className="block p-4 rounded-sm border-2 border-gold/60 bg-white text-sm font-bold text-navy hover:border-gold">
            {t("Your citizenship has been granted. Swear the oath to receive your passport →")}
          </Link>
        ))}

        {/* ── Status Cards ── */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-500 delay-75 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {STATUS_CARDS.map(({ label, value, sub, icon: Icon, accent, bg }) => (
            <div
              key={label}
              className="shell-card-light rounded-sm p-5 group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: 'rgba(21,41,74,0.40)' }}>{tx(label)}</span>
                <div
                  className="w-8 h-8 rounded-sm flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: bg, border: `1px solid ${accent}22` }}
                >
                  <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
              </div>
              <div className="text-xl font-extrabold tracking-tight" style={{ color: '#15294A' }}>{tx(value)}</div>
              <div className="text-[10px] mt-1" style={{ color: 'rgba(21,41,74,0.40)' }}>{tx(sub)}</div>
            </div>
          ))}
        </div>

        {/* ── Main content grid ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-500 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Digital Identity Card (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">

            {/* ID Visual Card */}
            <div className="shell-card-light rounded-sm overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(21,41,74,0.07)' }}>
                <h2 className="text-[13px] font-extrabold" style={{ color: '#15294A' }}>{t("Digital Identity")}</h2>
                <Link href="/portal/identity" className="flex items-center gap-1 text-[11px] font-bold transition-colors" style={{ color: 'rgba(196,154,78,0.75)' }}>{t("Manage")}{' '}<ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5">
                {/* The physical-feeling ID card */}
                <div className="rounded-sm overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #15294A 0%, #0D1B35 50%, #080E1C 100%)', minHeight: '160px' }}>
                  {/* Gold top line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #C49A4E, transparent)' }} />
                  {/* Ambient glow */}
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 0%, rgba(196,154,78,0.14) 0%, transparent 60%)' }} />
                  {/* Hexagonal watermark */}
                  <div className="absolute right-4 bottom-4 opacity-[0.06]">
                    <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                      <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" stroke="#C49A4E" strokeWidth="1.5"/>
                      <polygon points="50,18 78,33 78,67 50,82 22,67 22,33" stroke="#C49A4E" strokeWidth="1"/>
                      <circle cx="50" cy="50" r="12" stroke="#C49A4E" strokeWidth="1"/>
                    </svg>
                  </div>

                  <div className="relative z-10 p-6 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-[9px] font-bold tracking-[0.22em] uppercase mb-1" style={{ color: 'rgba(196,154,78,0.65)' }}>{t("Sovereign Covenant State of Aletheia")}</div>
                      <div className="text-xl font-extrabold" style={{ color: '#F4EEDF' }}>{tx(account?.name ?? '')}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'rgba(244,238,223,0.45)' }}>{tx(residencyLine)}</div>

                      <div className="mt-4 flex items-center gap-2">
                        <Fingerprint className="w-3.5 h-3.5" style={{ color: 'rgba(196,154,78,0.55)' }} />
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(244,238,223,0.45)' }} translate="no" data-i18n-skip="">{account?.id}</span>
                        <button
                          onClick={copyKey}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm transition-all"
                          style={{ background: copied ? 'rgba(61,134,100,0.25)' : 'rgba(196,154,78,0.15)', color: copied ? '#3D8664' : '#C49A4E' }}
                        >
                          {tx(copied ? '✓ Copied' : 'Copy')}
                        </button>
                      </div>
                    </div>

                    <div className="w-14 h-14 rounded-sm flex items-center justify-center shrink-0" style={{ background: 'rgba(196,154,78,0.10)', border: '1px solid rgba(196,154,78,0.25)' }}>
                      <User className="w-7 h-7" style={{ color: 'rgba(196,154,78,0.50)' }} />
                    </div>
                  </div>

                  {/* Credential tags */}
                  <div className="relative z-10 px-6 pb-5 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(196,154,78,0.10)', paddingTop: '14px' }}>
                    {[
                      { label: 'Registry ID', status: account ? 'Active' : '—' },
                      { label: 'Identity key', status: account?.publicKey ? 'Enrolled' : 'Not enrolled' },
                      { label: 'AEY Wallet', status: 'Linked' },
                    ].map(({ label, status }) => (
                      <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm" style={{ background: 'rgba(61,134,100,0.18)', border: '1px solid rgba(61,134,100,0.28)' }}>
                        <CheckCircle2 className="w-3 h-3" style={{ color: '#3D8664' }} />
                        <span className="text-[9px] font-bold" style={{ color: '#3D8664' }}>{tx(label)} · {tx(status)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'Download ID', icon: Download, href: '/portal/documents', color: '#15294A' },
                    { label: account?.residency ? 'Applications' : 'Apply Now', icon: ArrowRight, href: '/portal/apply', color: '#C49A4E' },
                    { label: 'AEY Wallet', icon: CreditCard, href: '/portal/wallet', color: '#15294A' },
                  ].map(({ label, icon: Icon, href, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-sm text-center transition-all group/qa hover:-translate-y-1"
                      style={{ background: 'rgba(21,41,74,0.04)', border: '1px solid rgba(21,41,74,0.08)' }}
                    >
                      <div className="w-8 h-8 rounded-sm flex items-center justify-center transition-all group-hover/qa:scale-110" style={{ background: 'rgba(21,41,74,0.06)', border: `1px solid ${color}18` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <span className="text-[10px] font-bold leading-tight" style={{ color: 'rgba(21,41,74,0.60)' }}>{tx(label)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* AEY Wallet mini */}
            <div className="shell-card-light rounded-sm overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(21,41,74,0.07)' }}>
                <h2 className="text-[13px] font-extrabold" style={{ color: '#15294A' }}>{t("AEY Wallet")}</h2>
                <Link href="/portal/wallet" className="flex items-center gap-1 text-[11px] font-bold" style={{ color: 'rgba(196,154,78,0.75)' }}>{t("Full Wallet")}{' '}<ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-5 flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(21,41,74,0.40)' }}>{t("Available Balance")}</p>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-gold-metallic">{(account?.balance ?? 0).toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-sm font-bold pb-0.5" style={{ color: 'rgba(21,41,74,0.50)' }}>{t("AEY")}</span>
                  </div>
                </div>
                <div className="ml-auto flex gap-3">
                  <Link href="/portal/wallet" className="px-4 py-2 rounded-sm text-xs font-bold transition-all btn-shimmer" style={{ background: 'linear-gradient(135deg, #E4C689, #C49A4E)', color: '#0E1B31', boxShadow: '0 4px 14px rgba(196,154,78,0.28)' }}>{t("Transfer")}</Link>
                  <Link href="/portal/wallet" className="px-4 py-2 rounded-sm text-xs font-bold transition-all" style={{ background: 'rgba(21,41,74,0.06)', border: '1px solid rgba(21,41,74,0.12)', color: '#15294A' }}>{t("History")}</Link>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline (1/3 width) */}
          <div className="shell-card-light rounded-sm overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(21,41,74,0.07)' }}>
              <h2 className="text-[13px] font-extrabold" style={{ color: '#15294A' }}>{t("Recent Activity")}</h2>
            </div>
            <div className="p-4 space-y-4">
              {(data?.timeline ?? []).length === 0 && (
                <p className="text-[11px]" style={{ color: 'rgba(21,41,74,0.45)' }}>{t("No activity yet.")}</p>
              )}
              {(data?.timeline ?? []).map(({ date, event, type }) => (
                <div key={date + event} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 mt-1"
                      style={{ background: type === 'success' ? '#3D8664' : '#E4A628' }}
                    />
                    <div className="w-px flex-1 mt-1" style={{ background: 'rgba(21,41,74,0.08)' }} />
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-[11px] font-semibold leading-snug" style={{ color: '#15294A' }}>{tx(event)}</p>
                    <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(21,41,74,0.38)' }}>{day(date, intl)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <Link href="/portal/notifications" className="text-[11px] font-bold flex items-center gap-1 transition-colors" style={{ color: 'rgba(196,154,78,0.80)' }}>{t("View all activity")}{' '}<ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </PortalShell>
  );
}
