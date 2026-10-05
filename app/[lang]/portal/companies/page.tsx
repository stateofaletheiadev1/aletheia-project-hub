'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  Building2,
  CheckCircle2,
  FileText,
  CreditCard,
  Users,
  Download,
  Plus,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function PortalMyCompaniesPage() {
  const { t } = useI18n();
  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("My Sovereign Entities")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t("1 ACTIVE CORPORATION")}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Corporate entities registered under the Covenant Commercial Code with 0% corporate tax")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/business"
              className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-gold" />
              <span>{t("Incorporate New Entity")}</span>
            </Link>
          </div>
        </div>

        {/* Company Card */}
        <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy/10 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-sm bg-navy text-gold flex items-center justify-center font-bold text-lg">{t("KM")}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-navy">{t("Kaelen Vance Marine Ltd")}</h2>
                  <span className="px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t("GOOD STANDING")}</span>
                </div>
                <p className="text-xs text-navy/50 font-mono">{t("Registration # ALE-SARL-2026-0012 · Société à Responsabilité Limitée (SARL)")}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/portal/documents"
                className="px-3 py-1.5 bg-parchment-light border border-navy/15 text-navy text-xs font-semibold rounded-sm hover:border-gold transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3 text-gold" />
                <span>{t("Certificate of Good Standing")}</span>
              </Link>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-4 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
              <span className="text-[10px] text-navy/40 uppercase block">{t("Share Capital")}</span>
              <span className="text-navy font-bold text-sm">{t("50,000.00 AEY")}</span>
              <span className="text-[10px] text-emerald-700 block">{t("Fully Deposited")}</span>
            </div>

            <div className="p-4 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
              <span className="text-[10px] text-navy/40 uppercase block">{t("Managing Director")}</span>
              <span className="text-navy font-bold text-sm">{t("Dr. Elena Vasquez")}</span>
              <span className="text-[10px] text-navy/50 block">{t("Sole Directorship")}</span>
            </div>

            <div className="p-4 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
              <span className="text-[10px] text-navy/40 uppercase block">{t("Registered Seat")}</span>
              <span className="text-navy font-bold text-sm">{t("Antioch Hexagonal")}</span>
              <span className="text-[10px] text-navy/50 block">{t("Sovereign Covenant State Federal District")}</span>
            </div>

            <div className="p-4 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
              <span className="text-[10px] text-navy/40 uppercase block">{t("Annual Return Filing")}</span>
              <span className="text-emerald-700 font-bold text-sm">{t("Compliant")}</span>
              <span className="text-[10px] text-navy/50 block">{t("Next Due: 2027-06-12")}</span>
            </div>
          </div>

          {/* Activities and Governance */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Authorized Business Scope")}</h3>
            <p className="text-xs text-navy/70 leading-relaxed font-sans">{t("Maritime engineering consultation, hydrographic surveying, North Sea offshore vessel operations, and sovereign logistics infrastructure contracting under Covenant Commercial License # LIC-MAR-9014.")}</p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
