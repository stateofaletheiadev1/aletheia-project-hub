import { describe, expect, it } from 'vitest';
import { hypotrochoid, lattice, prng, rosette } from '../../src/lib/components/motion/guilloche';

function endpoints(d: string) {
	const nums = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));
	return { first: nums.slice(0, 2), last: nums.slice(-2), all: nums };
}

describe('guilloche', () => {
	it('is deterministic for a seed', () => {
		expect(rosette(3, 320)).toEqual(rosette(3, 320));
		expect(lattice(5, 600, 320)).toEqual(lattice(5, 600, 320));
		expect(rosette(3, 320)).not.toEqual(rosette(4, 320));
	});

	it('prng stays in [0, 1)', () => {
		const r = prng(42);
		for (let i = 0; i < 1000; i++) {
			const v = r();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('closes a hypotrochoid', () => {
		const { first, last } = endpoints(hypotrochoid(120, 33, 20, 100, 100));
		expect(last[0]).toBeCloseTo(first[0] ?? NaN, 0);
		expect(last[1]).toBeCloseTo(first[1] ?? NaN, 0);
	});

	it('keeps a rosette inside its square', () => {
		for (const layer of rosette(9, 200, 5)) {
			for (const n of endpoints(layer.d).all) {
				expect(n).toBeGreaterThanOrEqual(-0.5);
				expect(n).toBeLessThanOrEqual(200.5);
			}
		}
	});

	it('keeps rosette markup within budget', () => {
		const bytes = rosette(3, 320, 4).reduce((sum, p) => sum + p.d.length, 0);
		expect(bytes).toBeLessThan(80_000);
	});
});
