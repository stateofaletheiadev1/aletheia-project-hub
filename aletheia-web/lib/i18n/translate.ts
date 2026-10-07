import type { Locale } from '@/lib/i18n/config';

/** English source string → translation. English needs no dictionary. */
export type Messages = Record<string, string>;

export type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** Normalises whitespace so JSX-wrapped and data strings share one key. */
export function normalizeKey(source: string): string {
  return source.replace(/\s+/g, ' ').trim();
}

export interface Translator {
  locale: Locale;
  /** Translate an English source string; falls back to English. Supports {var} placeholders. */
  t: (source: string, vars?: Vars) => string;
  /** Translate any rendered value: strings are looked up, everything else passes through. */
  tx: <T>(value: T) => T;
}

export function createTranslator(locale: Locale, messages: Messages): Translator {
  const t = (source: string, vars?: Vars) => {
    if (locale === 'en') return interpolate(source, vars);
    const key = normalizeKey(source);
    const hit = messages[key];
    if (hit === undefined) return interpolate(source, vars);
    // Preserve the source's outer whitespace (JSX spacing between inline elements).
    const lead = source.match(/^\s*/)?.[0] ?? '';
    const trail = source.match(/\s*$/)?.[0] ?? '';
    return lead + interpolate(hit, vars) + trail;
  };
  const tx = <T,>(value: T): T => (typeof value === 'string' ? (t(value) as T) : value);
  return { locale, t, tx };
}
