'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { LOCALE_META, type Locale } from '@/lib/i18n/config';
import { createTranslator, type Messages, type Translator } from '@/lib/i18n/translate';

interface I18nValue extends Translator {
  /** BCP 47 tag for Intl formatting, e.g. "de-DE". */
  intl: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(
    () => ({ ...createTranslator(locale, messages), intl: LOCALE_META[locale].intl }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const ENGLISH: I18nValue = { ...createTranslator('en', {}), intl: 'en-GB' };

/** Translation and locale formatting for client components. */
export function useI18n(): I18nValue {
  // Outside a provider (e.g. global error boundary) fall back to English.
  return useContext(I18nContext) ?? ENGLISH;
}
