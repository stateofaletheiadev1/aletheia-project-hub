import { describe, expect, it } from 'vitest';
import { localePath } from '../../src/lib/i18n/locales';
import { search, terms, type IndexedPage } from '../../src/lib/search';

const page = (url: string, title: string, text = '', headings: string[] = []): IndexedPage => ({
	url,
	title,
	description: '',
	headings,
	text
});

const index = [
	page('/banknotes', 'Banknote designs', 'Five denominations from 1 to 100 AEY.'),
	page('/monetary-policy', 'Monetary Policy Framework', 'A fiat currency.', ['Principles']),
	page('/about/governance', 'Governance', 'The Board and the Monetary Policy Committee.')
];

describe('search', () => {
	it('splits and normalises terms', () => {
		expect(terms('  Monetary-Policy, Ä ')).toEqual(['monetary', 'policy']);
	});

	it('ranks title matches above body matches', () => {
		const hits = search(index, 'monetary policy');
		expect(hits.map((h) => h.page.url)).toEqual(['/monetary-policy', '/about/governance']);
	});

	it('requires every term to match', () => {
		expect(search(index, 'banknote governance')).toEqual([]);
	});

	it('returns nothing for an empty query', () => {
		expect(search(index, '   ')).toEqual([]);
	});
});

describe('locale paths', () => {
	it('keeps English at the root and prefixes other languages', () => {
		expect(localePath('/about', 'en')).toBe('/about');
		expect(localePath('/about', 'de')).toBe('/de/about');
		expect(localePath('/de/about', 'en')).toBe('/about');
		expect(localePath('/', 'it')).toBe('/it');
	});
});
