/**
 * The official languages of the Sovereign Covenant State of Aletheia. A language becomes
 * `available` only when its translation has been supplied and approved; the language switcher
 * and hreflang links appear automatically once more than one is available.
 *
 * Adding a language: translate the content, set `available: true`, and serve it under /<code>/
 * (see docs/CONTENT_GUIDE.md, "Languages").
 */
export interface Locale {
	code: string;
	name: string;
	available: boolean;
}

export const LOCALES: Locale[] = [
	{ code: 'en', name: 'English', available: true },
	{ code: 'de', name: 'Deutsch', available: false },
	{ code: 'nl', name: 'Nederlands', available: false },
	{ code: 'sr', name: 'Српски', available: false },
	{ code: 'it', name: 'Italiano', available: false }
];

export const DEFAULT_LOCALE = 'en';

export const availableLocales = () => LOCALES.filter((l) => l.available);

/** The path of a page in another language: English at the root, others under /<code>. */
export function localePath(path: string, code: string): string {
	const clean = path.replace(/^\/(de|nl|sr|it)(?=\/|$)/, '') || '/';
	if (code === DEFAULT_LOCALE) return clean;
	return clean === '/' ? `/${code}` : `/${code}${clean}`;
}
