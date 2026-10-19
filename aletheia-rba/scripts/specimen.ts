/**
 * Builds the published banknote images: the State's artwork with a SPECIMEN overprint baked into
 * the pixels. Published banknote images always carry the overprint.
 *
 * Usage: tsx scripts/specimen.ts [source-dir]
 * Default source: ../currency-proto/new curr (files named "<d> AEY <Front|Back>.jpg").
 * Output: src/lib/assets/banknotes/aey-<d>-<front|back>.jpg at the source's full size.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const DENOMINATIONS = [1, 5, 10, 20, 100] as const;
const SIDES = ['front', 'back'] as const;

const source = resolve(process.argv[2] ?? join('..', 'currency-proto', 'new curr'));
const out = resolve('src', 'lib', 'assets', 'banknotes');

/** Specimen red, the convention for specimen notes; translucent so the design stays legible. */
const INK = '#8b1e2b';

/** The stamp, drawn level; it is rotated as a bitmap, because librsvg mis-rotates text. */
function stamp(width: number): { svg: Buffer; w: number; h: number } {
	const big = Math.round(width * 0.135);
	const small = Math.round(width * 0.022);
	const w = Math.round(width * 0.74);
	const h = Math.round(big * 1.75);
	const line = width * 0.004;
	const inset = width * 0.009;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
	<g fill="none" stroke="${INK}" stroke-opacity="0.72">
		<rect x="${line / 2}" y="${line / 2}" width="${w - line}" height="${h - line}" stroke-width="${line}"/>
		<rect x="${inset}" y="${inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" stroke-width="${width * 0.0015}"/>
	</g>
	<text x="${w / 2}" y="${h / 2 + big * 0.2}" text-anchor="middle" textLength="${w * 0.82}" lengthAdjust="spacing" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${big}" fill="${INK}" fill-opacity="0.66">SPECIMEN</text>
	<text x="${w / 2}" y="${h / 2 + big * 0.2 + small * 2.1}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${small}" fill="${INK}" fill-opacity="0.8">DESIGN CONCEPT  ·  NOT ISSUED  ·  NO MONETARY VALUE</text>
</svg>`;
	return { svg: Buffer.from(svg), w, h };
}

async function overprint(width: number, height: number): Promise<Buffer> {
	const { svg } = stamp(width);
	const rotated = await sharp(svg)
		.rotate(-16, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer({ resolveWithObject: true });
	const left = Math.round((width - rotated.info.width) / 2);
	const top = Math.round((height - rotated.info.height) / 2);
	return sharp({
		create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
	})
		.composite([{ input: rotated.data, left, top }])
		.png()
		.toBuffer();
}

if (!existsSync(source)) {
	console.error(`Source folder not found: ${source}`);
	process.exit(1);
}
mkdirSync(out, { recursive: true });

for (const d of DENOMINATIONS) {
	for (const side of SIDES) {
		const name = `${d} AEY ${side === 'front' ? 'Front' : 'Back'}.jpg`;
		const input = join(source, name);
		const meta = await sharp(input).metadata();
		if (!meta.width || !meta.height) throw new Error(`Cannot read size of ${input}`);
		const target = join(out, `aey-${d}-${side}.jpg`);
		await sharp(input)
			.composite([{ input: await overprint(meta.width, meta.height) }])
			.jpeg({ quality: 90, mozjpeg: true })
			.toFile(target);
		console.log(`${target}  ${meta.width}×${meta.height}`);
	}
}
