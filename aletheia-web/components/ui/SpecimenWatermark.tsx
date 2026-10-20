'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

/**
 * Diagonal overprint for travel-document design images. The parent must be
 * positioned and should clip overflow.
 */
export function SpecimenWatermark({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const text = t('SPECIMEN · DESIGN CONCEPT · NOT A TRAVEL DOCUMENT');
  return (
    <div className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none overflow-hidden ${className}`}>
      <span
        role="img"
        aria-label={text}
        className="block -rotate-[32deg] whitespace-nowrap border-y-2 border-[#9B1C2C]/70 bg-[#F4EEDF]/55 px-4 py-1 text-[11px] sm:text-xs font-extrabold tracking-[0.18em] text-[#9B1C2C]/85"
      >
        {text}
      </span>
    </div>
  );
}
