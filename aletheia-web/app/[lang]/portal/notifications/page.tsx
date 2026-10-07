'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { Bell, ArrowRight } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'Identity' | 'Corporate' | 'Financial';
  timestamp: string;
  unread: boolean;
  linkText?: string;
  linkHref?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'NOTIF-001',
    title: 'Passport Renewal Processing',
    message: 'Your biometric passport application ALE-APP-2026-0041 has passed automated ICAO 9303 MRZ verification. Physical card dispatch scheduled.',
    category: 'Identity',
    timestamp: '2 hours ago',
    unread: true,
    linkText: 'Track Application Status',
    linkHref: '/portal/apply',
  },
  {
    id: 'NOTIF-002',
    title: 'SARL Corporate Certificate Issued',
    message: 'Kaelen Vance Marine Ltd has been formally chartered and entered into the commercial register (ALE-SARL-2026-0012).',
    category: 'Corporate',
    timestamp: 'Yesterday at 16:30',
    unread: true,
    linkText: 'View Corporate Filing',
    linkHref: '/portal/companies',
  },
  {
    id: 'NOTIF-003',
    title: 'AEY Sovereign Bond Coupon Credit',
    message: 'Quarterly yield distribution of 240.00 AEY credited from Sovereign Development Bond Tranche 2026-A.',
    category: 'Financial',
    timestamp: '3 days ago',
    unread: true,
    linkText: 'Open AEY Wallet',
    linkHref: '/portal/wallet',
  },
];

export default function PortalNotificationsPage() {
  const { t, tx } = useI18n();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy">{t("Notifications & Alerts")}</h1>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Statutory notices, identity milestones, and corporate filings from the Sovereign Covenant State")}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="px-3.5 py-1.5 bg-white border border-navy/15 text-navy text-xs font-semibold rounded-sm hover:border-gold hover:text-gold transition-colors"
            >{t("Mark all as read")}</button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 rounded-sm bg-white border transition-all ${
                n.unread
                  ? 'border-gold/40 shadow-sm'
                  : 'border-navy/10 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${
                      n.category === 'Identity'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : n.category === 'Corporate'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-navy">{tx(n.title)}</h3>
                      {tx(n.unread && (
                        <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                      ))}
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-parchment-light text-navy/60 rounded-sm border border-navy/10">
                        {tx(n.category)}
                      </span>
                    </div>

                    <p className="text-xs text-navy/70 leading-relaxed max-w-2xl">
                      {tx(n.message)}
                    </p>

                    <div className="flex items-center gap-4 pt-1 text-[11px]">
                      <span className="text-navy/40 font-mono">{tx(n.timestamp)}</span>
                      {tx(n.linkHref && n.linkText && (
                        <Link
                          href={n.linkHref}
                          className="font-bold text-gold hover:underline inline-flex items-center gap-1"
                        >
                          <span>{tx(n.linkText)}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {tx(n.unread && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-[11px] text-navy/40 hover:text-navy whitespace-nowrap shrink-0"
                  >{t("Mark read")}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
