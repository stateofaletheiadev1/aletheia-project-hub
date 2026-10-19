import { describe, expect, it } from 'vitest';
import { RULES, scanHtml, scanSource, visibleText } from '../../scripts/claims-rules';

// One phrase per rule that the rule must catch.
const CAUGHT: Record<string, string> = {
	'percent-backed': 'AEY is 100% euro-backed.',
	'fully-backed': 'Each note is fully backed.',
	'eur-to-aey-rate': 'EUR 1 = 1 AEY at all times.',
	'aey-to-eur-rate': '1 AEY = €1.00',
	'guaranteed-conversion': 'We offer guaranteed redemption.',
	'redeemable-in-euro': 'Notes are redeemable in euro.',
	'reserve-figure': 'The Bank holds 40 million in reserve.',
	'legal-tender': 'AEY is legal tender.',
	'licensed-or-regulated': 'The Bank is regulated by the authority.',
	recognised: 'A recognised central bank.',
	'in-circulation': 'Notes in circulation.',
	hype: 'Redefining finance for web3.'
};

describe('claims rules', () => {
	it('has a test phrase for every rule', () => {
		expect(Object.keys(CAUGHT).sort()).toEqual(RULES.map((r) => r.id).sort());
	});

	for (const [id, phrase] of Object.entries(CAUGHT)) {
		it(`catches ${id}`, () => {
			expect(scanSource(`const copy = '${phrase}';`).map((v) => v.rule)).toContain(id);
		});
	}

	it('passes honest copy', () => {
		const copy = [
			'The Aletheian Guilder is a proposed currency and has not been issued.',
			'Aletheia currently holds no euro reserves.',
			'Conversion to euros is not offered, and no rate has been set.'
		].join('\n');
		expect(scanSource(copy)).toEqual([]);
	});

	it('respects an allow comment with a reason on the same line', () => {
		const text = [
			"q: 'Is AEY legal tender?', // claims-lint-allow: negated FAQ question",
			'<p>No notes are in circulation.</p> <!-- claims-lint-allow: negated -->'
		].join('\n');
		expect(scanSource(text)).toEqual([]);
	});

	it('rejects an allow comment without a reason', () => {
		expect(scanSource("'AEY is legal tender.' // claims-lint-allow:")).toHaveLength(1);
	});

	it('does not let an allow comment cover other lines', () => {
		const text = ["'fine' // claims-lint-allow: unrelated", "'AEY is legal tender.'"].join('\n');
		const found = scanSource(text);
		expect(found).toHaveLength(1);
		expect(found[0]?.line).toBe(2);
	});

	it('catches a claim split across lines', () => {
		expect(scanSource('<p>AEY is legal\n\t\ttender.</p>').map((v) => v.rule)).toEqual([
			'legal-tender'
		]);
	});
});

describe('built HTML', () => {
	it('scans visible text across tags and entities', () => {
		expect(scanHtml('<p>Every note is 100<span>&percnt;</span> backed</p>')).toHaveLength(1);
		expect(scanHtml('<p>1 AEY = &euro;1</p>')).toHaveLength(1);
	});

	it('ignores scripts, styles and comments', () => {
		const html = '<script>"legal tender"</script><style>/* in circulation */</style><!-- web3 -->';
		expect(scanHtml(html)).toEqual([]);
	});

	it('exempts elements marked data-claims-allow, including nested markup', () => {
		const html =
			'<div data-claims-allow="negated FAQ answer"><p>AEY is <em>not</em> legal tender.</p></div><p>ok</p>';
		expect(scanHtml(html)).toEqual([]);
		expect(visibleText(html)).toContain('ok');
	});

	it('still catches text after an exempt element closes', () => {
		const html = '<p data-claims-allow="negated">Not legal tender.</p><p>Fully backed.</p>';
		expect(scanHtml(html).map((v) => v.rule)).toEqual(['fully-backed']);
	});

	it('does not exempt an empty data-claims-allow reason', () => {
		expect(scanHtml('<p data-claims-allow="">legal tender</p>')).toHaveLength(1);
	});
});
