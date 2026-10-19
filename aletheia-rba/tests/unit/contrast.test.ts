import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/lib/utils/contrast';

/** Reads the palette from tokens.css itself, so the tokens cannot drift from what is tested. */
const css = readFileSync(new URL('../../src/lib/styles/tokens.css', import.meta.url), 'utf8');
const palette = Object.fromEntries(
	[...css.matchAll(/--c-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]])
) as Record<string, string>;

const c = (name: string) => {
	const hex = palette[name];
	if (!hex) throw new Error(`--c-${name} missing from tokens.css`);
	return hex;
};

describe('contrast', () => {
	it('computes known WCAG values', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
	});

	const text: [string, string][] = [
		['ink', 'parchment'],
		['navy', 'parchment'],
		['ink-muted', 'parchment'],
		['ink-muted', 'parchment-50'],
		['gold-ink', 'parchment'],
		['gold-ink', 'parchment-50'],
		['laurel', 'parchment'],
		['parchment', 'navy'],
		['parchment-400', 'navy'],
		['gold', 'navy']
	];

	for (const [fg, bg] of text) {
		it(`${fg} on ${bg} meets 4.5:1 for text`, () => {
			expect(contrastRatio(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5);
		});
	}

	it('focus rings meet 3:1: navy on parchment, gold on navy', () => {
		expect(contrastRatio(c('navy'), c('parchment'))).toBeGreaterThanOrEqual(3);
		expect(contrastRatio(c('gold'), c('navy'))).toBeGreaterThanOrEqual(3);
	});

	it('gold on parchment stays below text contrast (ornament only)', () => {
		expect(contrastRatio(c('gold'), c('parchment'))).toBeLessThan(3);
	});
});
