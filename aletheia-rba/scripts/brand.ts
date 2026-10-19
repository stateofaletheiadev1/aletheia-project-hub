/**
 * Exports the Bank's mark (src/lib/brand/seal.ts) as static files: an SVG master, favicons and
 * the PNG logo used in structured data. The website itself draws the seal inline.
 *
 * Usage: tsx scripts/brand.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { markSvg, smallMarkSvg } from '../src/lib/brand/seal.ts';

const statics = resolve('static');
const NAVY = '#15294a';
const GOLD = '#c49a4e';
const PARCHMENT = '#f4eedf';

// Navy linework with the gold star on a parchment disc: legible on light and dark tabs alike.
const onParchment = markSvg({ line: NAVY, star: GOLD, ground: PARCHMENT });
// Gold on navy, for the square icons.
const onNavy = markSvg({ line: GOLD, star: GOLD, ground: NAVY });

writeFileSync(join(statics, 'rba-mark.svg'), onParchment);
console.log('static/rba-mark.svg');

async function png(svg: string, size: number, file: string, square?: string) {
	const mark = await sharp(Buffer.from(svg), { density: 72 * (size / 200) * 2 })
		.resize(square ? Math.round(size * 0.84) : size, square ? Math.round(size * 0.84) : size)
		.png()
		.toBuffer();
	const out = square
		? sharp({ create: { width: size, height: size, channels: 4, background: square } }).composite([
				{ input: mark, gravity: 'centre' }
			])
		: sharp(mark);
	await out.png({ compressionLevel: 9 }).toFile(join(statics, file));
	console.log(`static/${file}`);
}

await png(smallMarkSvg({ line: NAVY, star: GOLD, ground: PARCHMENT }), 32, 'favicon-32.png');
await png(onParchment, 512, 'logo.png');
await png(onNavy, 180, 'apple-touch-icon.png', NAVY);
await png(onNavy, 192, 'icon-192.png', NAVY);
await png(onNavy, 512, 'icon-512.png', NAVY);
