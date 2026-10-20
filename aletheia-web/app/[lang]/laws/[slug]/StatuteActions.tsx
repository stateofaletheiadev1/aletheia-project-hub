'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { Download, Printer } from 'lucide-react';

export function StatuteActions({ slug }: { slug: string }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2" data-print-hide>
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-1.5 border border-navy/20 text-navy font-semibold rounded-sm hover:border-gold hover:text-gold transition-colors flex items-center gap-1.5"
      >
        <Printer className="w-3.5 h-3.5" />{' '}{t("Print")}</button>
      <a
        href={`/pdf/statutes/${slug}`}
        target="_blank"
        rel="noopener"
        className="px-3 py-1.5 bg-navy text-gold font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />{' '}{t("PDF Edition")}</a>
    </div>
  );
}
