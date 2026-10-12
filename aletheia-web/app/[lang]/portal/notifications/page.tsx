'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import { api, reload, setCached, useApi } from '@/lib/client/api';
import type { PortalNotification } from '@/lib/auth';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { Bell, ArrowRight } from 'lucide-react';

const PATH = '/api/portal/notifications';

export default function PortalNotificationsPage() {
  const { t, tx, intl } = useI18n();
  const { data, loading } = useApi<{ notifications: PortalNotification[] }>(PATH);
  const notifications = data?.notifications ?? [];

  const markAllAsRead = async () => {
    setCached(PATH, { notifications: notifications.map((n) => ({ ...n, unread: false })) });
    await api(PATH, { method: 'PATCH', body: {} }).catch(() => undefined);
    await reload(PATH);
  };

  const markAsRead = async (id: string) => {
    setCached(PATH, { notifications: notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)) });
    await api(`${PATH}/${id}`, { method: 'PATCH', body: {} }).catch(() => undefined);
    await reload(PATH);
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
          {tx(!loading && notifications.length === 0 && (
            <p className="p-6 rounded-sm bg-white border border-navy/10 text-sm text-navy/60">{t("No notifications yet.")}</p>
          ))}
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
                      <span className="text-navy/40 font-mono">{new Date(n.timestamp).toLocaleString(intl, { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
