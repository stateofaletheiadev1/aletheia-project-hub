'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-navy focus:text-parchment focus:border focus:border-gold"
    >
      {t('Skip to main content')}
    </a>
  );
}
