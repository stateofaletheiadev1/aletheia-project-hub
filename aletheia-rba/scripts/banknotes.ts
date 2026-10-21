/**
 * Builds the published banknote images from the State's artwork.
 *
 * Usage: tsx scripts/banknotes.ts [source-dir]
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

if (!existsSync(source)) {
	console.error(`Source folder not found: ${source}`);
	process.exit(1);
}
mkdirSync(out, { recursive: true });

for (const d of DENOMINATIONS) {
	for (const side of SIDES) {
		const input = join(source, `${d} AEY ${side === 'front' ? 'Front' : 'Back'}.jpg`);
		const meta = await sharp(input).metadata();
		if (!meta.width || !meta.height) throw new Error(`Cannot read size of ${input}`);
		const target = join(out, `aey-${d}-${side}.jpg`);
		await sharp(input).jpeg({ quality: 90, mozjpeg: true }).toFile(target);
		console.log(`${target}  ${meta.width}×${meta.height}`);
	}
}
