import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { banknotes, faq, news, publications, statusLedger } from '../../src/lib/content';
import { EVIDENCE_REQUIRED_AREAS, StatusItem } from '../../src/lib/content/schema';

const ledger = (id: string) => {
	const item = statusLedger.find((s) => s.id === id);
	if (!item) throw new Error(`No ledger item ${id}`);
	return item;
};

describe('status ledger', () => {
	it('encodes the known facts', () => {
		expect(ledger('aletheian-guilder').status).toBe('proposed');
		expect(ledger('monetary-framework').status).toBe('proposed');
		expect(ledger('banknote-designs').status).toBe('proposed');
		expect(ledger('issuance').status).toBe('not_established');
		expect(ledger('reserves-and-exchange').status).toBe('not_established');
	});

	it('never marks reserve, convertibility or issuance items operational without evidence', () => {
		for (const item of statusLedger) {
			if (EVIDENCE_REQUIRED_AREAS.includes(item.area) && item.status === 'operational') {
				expect(item.evidenceUrl, item.id).toMatch(/^https:\/\//);
			}
		}
	});

	it('rejects an operational reserve item without an evidenceUrl', () => {
		const bad = {
			id: 'foreign-reserves',
			area: 'reserves',
			capability: 'Foreign reserves',
			status: 'operational',
			statusAsOf: '2026-10-19',
			explanation: 'Accidental edit'
		};
		expect(StatusItem.safeParse(bad).success).toBe(false);
		expect(
			StatusItem.safeParse({ ...bad, evidenceUrl: 'https://example.org/audited-report.pdf' })
				.success
		).toBe(true);
	});

	it('dates every item', () => {
		for (const item of statusLedger) expect(item.statusAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('banknotes', () => {
	it('has the five denominations in order', () => {
		expect(banknotes.map((b) => b.denomination)).toEqual([1, 5, 10, 20, 100]);
	});

	it('are proposed designs that have not been issued', () => {
		for (const b of banknotes) {
			expect(b.status).toBe('proposed');
			expect(b.issuanceStatus).toBe('not_established');
		}
	});

	it('mark every security feature as a design concept', () => {
		for (const b of banknotes) {
			for (const f of b.securityFeatures) expect(f.implementation).toBe('concept_only');
		}
	});

	it('say in every alt text that the image is a specimen', () => {
		for (const b of banknotes) {
			for (const side of [b.front, b.back]) if (side) expect(side.alt).toMatch(/specimen/i);
		}
	});

	it('have overprinted artwork on disk, front and back, read for its real dimensions', async () => {
		for (const b of banknotes) {
			for (const side of [b.front, b.back]) {
				if (!side) continue;
				const file = `src/lib/assets/banknotes/${side.src}.jpg`;
				expect(existsSync(file), file).toBe(true);
				const meta = await sharp(file).metadata();
				expect(meta.width).toBeGreaterThan(1000);
				expect(meta.height).toBeGreaterThan(600);
			}
		}
	});
});

describe('FAQ', () => {
	it('answers the core questions', () => {
		const ids = faq.map((f) => f.id);
		for (const id of [
			'what-is-the-aletheian-guilder',
			'what-does-fiat-currency-mean',
			'what-are-the-banknote-denominations',
			'what-is-the-relationship-between-aey-and-stablechain',
			'who-will-issue-the-guilder'
		]) {
			expect(ids).toContain(id);
		}
	});

	it('records a claims-lint reason on any answer that names a forbidden phrase', () => {
		for (const f of faq) {
			if (f.answer.some((p) => /legal\s+tender|in\s+circulation/i.test(p))) {
				expect(f.claimsAllow, f.id).toBeTruthy();
			}
		}
	});
});

describe('publications and news', () => {
	it('load (zero at launch is acceptable)', () => {
		expect(Array.isArray(publications)).toBe(true);
		expect(Array.isArray(news)).toBe(true);
	});
});
