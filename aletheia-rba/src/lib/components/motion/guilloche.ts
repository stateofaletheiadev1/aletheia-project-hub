/**
 * Procedural guilloché, after the engine-turned linework of banknote security printing.
 * Everything is deterministic for a given seed, so prerendered pages are stable between builds.
 */

export interface GuillochePath {
	d: string;
	/** Relative weight of the layer, 0..1, used for opacity. */
	weight: number;
}

/** Small seeded PRNG (mulberry32). */
export function prng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

function toPath(points: [number, number][]): string {
	let d = '';
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		if (!p) continue;
		d += (i === 0 ? 'M' : 'L') + fmt(p[0]) + ' ' + fmt(p[1]);
	}
	return d;
}

/**
 * Hypotrochoid centred on (cx, cy): a circle of radius r rolling inside one of radius R, traced
 * by a pen at distance d. Closes after r / gcd(R, r) turns. Integers keep the figure closed.
 */
export function hypotrochoid(R: number, r: number, d: number, cx: number, cy: number, scale = 1) {
	const turns = r / gcd(R, r);
	const total = Math.PI * 2 * turns;
	const freq = Math.max(1, (R - r) / r);
	const steps = Math.min(2400, Math.ceil(total * freq * 5));
	const k = (R - r) / r;
	const points: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const t = (i / steps) * total;
		points.push([
			cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(k * t)),
			cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(k * t))
		]);
	}
	return toPath(points);
}

/**
 * A rosette of concentric hypotrochoid layers that fits a square of `size`, centred.
 */
export function rosette(seed: number, size: number, layers = 4): GuillochePath[] {
	const rand = prng(seed);
	const R = 120;
	// With R = 120 these radii give dense 30- to 40-lobe figures rather than coarse stars.
	const choices = [21, 27, 33, 39, 44, 51]
		.map((r) => ({ r, key: rand() }))
		.sort((a, b) => a.key - b.key)
		.map((c) => c.r);
	const out: GuillochePath[] = [];
	for (let i = 0; i < layers; i++) {
		const r = choices[i % choices.length] ?? 25;
		const d = r * (0.55 + rand() * 0.6);
		const outer = R - r + d;
		const fit = (size / 2) * (1 - i * (0.14 + rand() * 0.04));
		out.push({ d: hypotrochoid(R, r, d, size / 2, size / 2, fit / outer), weight: 1 - i * 0.18 });
	}
	return out;
}

/**
 * Interfering wave lines across a width × height field: the "lattice" ground of a note.
 */
export function lattice(seed: number, width: number, height: number, lines = 18): GuillochePath[] {
	const rand = prng(seed);
	const k1 = (Math.PI * 2 * (2 + rand() * 2)) / width;
	const k2 = (Math.PI * 2 * (5 + rand() * 3)) / width;
	const amp1 = height * (0.06 + rand() * 0.04);
	const amp2 = height * (0.02 + rand() * 0.02);
	const drift = 0.25 + rand() * 0.35;
	const steps = Math.max(24, Math.round(width / 8));
	const out: GuillochePath[] = [];
	for (let l = 0; l < lines; l++) {
		const y0 = ((l + 0.5) / lines) * height;
		const phase = l * drift;
		const points: [number, number][] = [];
		for (let i = 0; i <= steps; i++) {
			const x = (i / steps) * width;
			points.push([
				x,
				y0 + amp1 * Math.sin(k1 * x + phase) + amp2 * Math.sin(k2 * x - phase * 1.7)
			]);
		}
		out.push({ d: toPath(points), weight: 0.5 + 0.5 * Math.abs(Math.sin(l * 0.7)) });
	}
	return out;
}
