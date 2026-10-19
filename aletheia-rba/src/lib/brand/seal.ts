/**
 * Geometry of the Reserve Bank of Aletheia seal: an engraved rosette inside double rings, with
 * the eight-pointed star of Aletheia at its centre. Drawn for the Bank on 2026-10-19 at the
 * request of the State (the Bank uses its own mark, not the national coat of arms).
 *
 * All coordinates are in a 200 × 200 box centred on (100, 100). Shared by the Svelte component
 * and scripts/brand.ts, so the website and the exported files cannot drift apart.
 */
import { hypotrochoid } from '../components/motion/guilloche';

export const C = 100;

/** Eight-pointed star: long rays on the axes, short rays on the diagonals. */
export function starPath(outer = 22, inner = 7.5, diagonal = 14): string {
	const pts: string[] = [];
	for (let i = 0; i < 16; i++) {
		const angle = (Math.PI / 8) * i - Math.PI / 2;
		const r = i % 2 === 1 ? inner : i % 4 === 0 ? outer : diagonal;
		pts.push(`${(C + r * Math.cos(angle)).toFixed(2)} ${(C + r * Math.sin(angle)).toFixed(2)}`);
	}
	return `M${pts.join('L')}Z`;
}

/** Two interleaved hypotrochoids filling the inner field (radius ≈ fit). */
export function rosettePaths(fit = 58): string[] {
	const layers: [number, number, number][] = [
		[120, 33, 26],
		[120, 27, 18]
	];
	return layers.map(([R, r, d], i) => {
		const outer = R - r + d;
		const scale = (fit * (1 - i * 0.12)) / outer;
		return hypotrochoid(R, r, d, C, C, scale);
	});
}

export const RINGS = {
	outer: 96,
	outerInner: 92,
	text: 80.5,
	inner: 68
};

export interface SealColours {
	line: string;
	star: string;
	ground: string | null;
}

/** Ring and star only: the form used below 64 px. */
export function smallMarkSvg(colours: SealColours, size = 200): string {
	const ground = colours.ground
		? `<circle cx="${C}" cy="${C}" r="${RINGS.outer + 2}" fill="${colours.ground}"/>`
		: '';
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">${ground}<circle cx="${C}" cy="${C}" r="${RINGS.outer - 3}" fill="none" stroke="${colours.line}" stroke-width="12"/><path d="${starPath(62, 19, 38)}" fill="${colours.star}"/></svg>`;
}

/** The text-free mark as a standalone SVG document (favicons, structured-data logo). */
export function markSvg(colours: SealColours, size = 200): string {
	const rosette = rosettePaths(78)
		.map(
			(d, i) =>
				`<path d="${d}" fill="none" stroke="${colours.line}" stroke-width="${i ? 0.6 : 0.8}" opacity="${i ? 0.7 : 1}"/>`
		)
		.join('');
	const ground = colours.ground
		? `<circle cx="${C}" cy="${C}" r="${RINGS.outer + 2}" fill="${colours.ground}"/>`
		: '';
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">${ground}<circle cx="${C}" cy="${C}" r="${RINGS.outer}" fill="none" stroke="${colours.line}" stroke-width="3"/><circle cx="${C}" cy="${C}" r="${RINGS.outerInner - 1}" fill="none" stroke="${colours.line}" stroke-width="1"/>${rosette}<circle cx="${C}" cy="${C}" r="30" fill="${colours.ground ?? 'none'}" stroke="${colours.line}" stroke-width="1.2"/><path d="${starPath(26, 8.5, 16)}" fill="${colours.star}"/></svg>`;
}
