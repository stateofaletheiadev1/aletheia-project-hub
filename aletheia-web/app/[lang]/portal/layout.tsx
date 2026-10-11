import type { Metadata } from 'next';
import { PRIVATE_METADATA } from '@/lib/routes';
import { isLocale } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';
import { ServiceNotOpen } from '@/components/layout/ServiceNotOpen';

export async function generateMetadata({ params }: LayoutProps<'/[lang]/portal'>): Promise<Metadata> {
  const { lang } = await params;
  const { t } = await getTranslator(isLocale(lang) ? lang : 'en');
  return { ...PRIVATE_METADATA, title: t('Citizen Portal') };
}

// The portal has no live system behind it yet: every portal route shows that it is not open,
// instead of a simulated sign-in. The pages stay in the codebase for when it opens.
export default function PortalLayout() {
  return <ServiceNotOpen area="portal" />;
}
