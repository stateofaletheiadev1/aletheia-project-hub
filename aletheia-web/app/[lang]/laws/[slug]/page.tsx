import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { STATUTE_DATABASE, getStatute } from '@/lib/statutes';
import { isLocale, localizeHref } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';
import { languageAlternates } from '@/lib/routes';
import { StatuteView } from './StatuteView';

export function generateStaticParams() {
  return Object.keys(STATUTE_DATABASE).map((slug) => ({ slug }));
}

// Only statutes in the register exist; anything else is a 404.
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/[lang]/laws/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params;
  const statute = getStatute(slug);
  if (!statute || !isLocale(lang)) return {};
  const { t } = await getTranslator(lang);
  const path = `/laws/${statute.slug}`;
  return {
    title: `${t(statute.title)} (${statute.code})`,
    description: t(statute.preamble),
    alternates: { canonical: localizeHref(path, lang), languages: languageAlternates(path) },
  };
}

export default async function Page({ params }: PageProps<'/[lang]/laws/[slug]'>) {
  const { slug } = await params;
  if (!getStatute(slug)) notFound();
  return <StatuteView slug={slug} />;
}
