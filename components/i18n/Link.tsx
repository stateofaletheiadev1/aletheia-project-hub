'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { localizeHref } from '@/lib/i18n/config';
import { useI18n } from '@/components/i18n/I18nProvider';

/** Drop-in for next/link that keeps the reader in their chosen language. */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const { locale } = useI18n();
  const localized = typeof href === 'string' ? localizeHref(href, locale) : href;
  return <NextLink href={localized} {...props} />;
}
