import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PRIVATE_METADATA } from '@/lib/routes';
import { isLocale } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';

export async function generateMetadata({ params }: LayoutProps<'/[lang]/portal'>): Promise<Metadata> {
  const { lang } = await params;
  const { t } = await getTranslator(isLocale(lang) ? lang : 'en');
  return { ...PRIVATE_METADATA, title: t('Citizen Portal') };
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}
