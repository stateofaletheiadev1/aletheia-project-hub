import type { Metadata } from 'next';
import { PRIVATE_METADATA } from '@/lib/routes';
import { isLocale } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';
import { connection } from 'next/server';
import { ServiceNotOpen } from '@/components/layout/ServiceNotOpen';
import { databaseConfigured } from '@/lib/server/db';

export async function generateMetadata({ params }: LayoutProps<'/[lang]/portal'>): Promise<Metadata> {
  const { lang } = await params;
  const { t } = await getTranslator(isLocale(lang) ? lang : 'en');
  return { ...PRIVATE_METADATA, title: t('Citizen Portal') };
}

// The portal runs on AletheiaDB. Without a database connection (ALETHEIADB_URL) every portal
// route says that it is not open, instead of showing a sign-in that cannot work.
export default async function PortalLayout({ children }: LayoutProps<'/[lang]/portal'>) {
  await connection();
  if (!databaseConfigured()) return <ServiceNotOpen area="portal" />;
  return children;
}
