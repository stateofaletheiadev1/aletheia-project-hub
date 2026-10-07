import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GAZETTE_POSTS, getGazettePost } from '@/lib/gazette';
import { unsplash } from '@/lib/imagery';
import { isLocale, localizeHref } from '@/lib/i18n/config';
import { getTranslator } from '@/lib/i18n/server';
import { languageAlternates } from '@/lib/routes';
import { GazetteArticleView } from './GazetteArticleView';

export function generateStaticParams() {
  return GAZETTE_POSTS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/[lang]/news/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params;
  const post = getGazettePost(slug);
  if (!post || !isLocale(lang)) return {};
  const { t } = await getTranslator(lang);
  const path = `/news/${post.slug}`;
  return {
    title: t(post.title),
    description: t(post.summary),
    alternates: { canonical: localizeHref(path, lang), languages: languageAlternates(path) },
    openGraph: {
      type: 'article',
      title: t(post.title),
      description: t(post.summary),
      publishedTime: post.date,
      images: [{ url: unsplash(post.image, 1200) }],
    },
  };
}

export default async function Page({ params }: PageProps<'/[lang]/news/[slug]'>) {
  const { slug } = await params;
  if (!getGazettePost(slug)) notFound();
  return <GazetteArticleView slug={slug} />;
}
