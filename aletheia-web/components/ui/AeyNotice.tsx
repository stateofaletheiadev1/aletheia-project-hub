'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { Info } from 'lucide-react';

export const AEY_NOTICE =
  'AEY is not currently issued to the public and is not legal tender or e-money. Any future issuance would take place only through a properly licensed issuer, in compliance with applicable law (including the EU’s MiCA regulation).';

/** The standing notice shown wherever the AEY is described. */
export function AeyNotice({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  const { t } = useI18n();
  const toneClass =
    tone === 'dark'
      ? 'border-gold/30 bg-navy/40 text-parchment/75'
      : 'border-navy/15 bg-parchment-light text-navy/70';
  return (
    <aside role="note" className={`flex items-start gap-3 border-l-[3px] border-l-gold rounded-sm border px-4 py-3 text-xs leading-relaxed ${toneClass} ${className}`}>
      <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden="true" />
      <p>{t(AEY_NOTICE)}</p>
    </aside>
  );
}
