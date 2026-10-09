'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import { downloadPortalDocument } from '@/lib/pdf/portal';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { CheckCircle2, Download, ArrowRight } from 'lucide-react';

export default function PortalResidencyStatusPage() {
  const { t, tx } = useI18n();
  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("E-Residency Status & Privileges")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t("ACTIVE · 3-YEAR TERM")}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Statutory e-residency granted under Sovereign Covenant State Digital Economy Act § 7")}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => void downloadPortalDocument('e-residence-certificate', 'Aletheia_E_Residence_Certificate.pdf')}
                className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
              >
              <Download className="w-3.5 h-3.5 text-gold" />
              <span>{t("Download Certificate")}</span>
            </button>
          </div>
        </div>

        {/* Term & Validity Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {[
            { label: 'E-Residency ID', value: 'ALE-ERES-2026-004928', sub: 'National Roll Entry', good: true },
            { label: 'Valid From', value: '2026-10-01', sub: 'Inaugural Charter Date', good: true },
            { label: 'Valid Through', value: '2029-10-01', sub: '3-Year Renewable Term', good: true },
            { label: 'Renewal Window', value: 'Opens July 2029', sub: '60 Days Prior to Expiry', good: false },
          ].map((c) => (
            <div key={c.label} className="p-5 rounded-sm bg-white border border-navy/10 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-navy/40">{tx(c.label)}</span>
              <div className="text-lg font-bold text-navy">{tx(c.value)}</div>
              <div className="text-[10px] text-navy/50">{tx(c.sub)}</div>
            </div>
          ))}
        </div>

        {/* Rights & Statutory Privileges */}
        <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-5">
          <div className="flex items-center justify-between border-b border-navy/10 pb-3">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Sovereign Rights & Accorded Privileges")}</h3>
            <span className="text-[11px] font-mono text-emerald-700 font-bold">{t("100% Accorded")}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {[
              {
                title: 'Remote Company Formation',
                desc: 'Establish and administer 100% tax-free SARL or AG corporations within 15 minutes on StableChain.',
                active: true,
              },
              {
                title: 'AEY Sovereign Settlement',
                desc: 'Hold, receive, and disburse 100% reserve-backed Aletheian Guilders at fixed, published fees.',
                active: true,
              },
              {
                title: 'High Court Commercial Arbitration',
                desc: 'Access to the automated digital dispute resolution system and High Court contract enforcement.',
                active: true,
              },
              {
                title: 'Consular Maritime Access',
                desc: 'Eligible for vessel flagging, maritime asset registration, and port privileges across Aletheian berths.',
                active: true,
              },
            ].map((p) => (
              <div key={p.title} className="p-4 rounded-sm bg-parchment-light border border-navy/5 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-navy">{tx(p.title)}</span>
                </div>
                <p className="text-navy/70 text-[11px] font-sans leading-relaxed">
                  {tx(p.desc)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Corporate Link */}
        <div className="p-5 rounded-sm bg-white border border-gold/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-navy">{t("Associated Enterprise Registration")}</h4>
            <p className="text-xs text-navy/60 font-sans">{t("You are currently registered as Sole Director of")}{' '}<strong>{t("Kaelen Vance Marine Ltd (ALE-SARL-2026-0012)")}</strong>.
            </p>
          </div>
          <Link
            href="/portal/companies"
            className="px-4 py-2 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>{t("Manage Corporate Entity")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </PortalShell>
  );
}
