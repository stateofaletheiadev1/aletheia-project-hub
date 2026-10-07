import 'server-only';
import type { Locale } from '@/lib/i18n/config';
import { createTranslator, type Messages } from '@/lib/i18n/translate';

const loaders: Record<Exclude<Locale, 'en'>, () => Promise<Messages>> = {
  de: () => import('./messages/de.json').then((m) => m.default as Messages),
  nl: () => import('./messages/nl.json').then((m) => m.default as Messages),
  sr: () => import('./messages/sr.json').then((m) => m.default as Messages),
  it: () => import('./messages/it.json').then((m) => m.default as Messages),
};

export async function getMessages(locale: Locale): Promise<Messages> {
  // English is the source language: no dictionary needed.
  if (locale === 'en') return {};
  return loaders[locale]();
}

export async function getTranslator(locale: Locale) {
  return createTranslator(locale, await getMessages(locale));
}
