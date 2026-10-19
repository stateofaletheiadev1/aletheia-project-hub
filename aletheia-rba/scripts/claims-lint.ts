/**
 * Fails when site source or built pages state a forbidden monetary claim (brief §2.3).
 * Usage: tsx scripts/claims-lint.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { scanHtml, scanSource, type Violation } from './claims-rules.ts';

const root = process.cwd();

function walk(dir: string, accept: (file: string) => boolean): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...walk(path, accept));
		else if (accept(path)) out.push(path);
	}
	return out;
}

const sources = walk(join(root, 'src'), (f) => /\.(svelte|ts|md)$/.test(f));
const pages = walk(join(root, 'build'), (f) => f.endsWith('.html'));

const failures: { file: string; v: Violation }[] = [];
for (const file of sources) {
	for (const v of scanSource(readFileSync(file, 'utf8'))) failures.push({ file, v });
}
for (const file of pages) {
	for (const v of scanHtml(readFileSync(file, 'utf8'))) failures.push({ file, v });
}

for (const { file, v } of failures) {
	const where = v.line > 0 ? `${relative(root, file)}:${v.line}` : relative(root, file);
	console.error(`${where}  [${v.rule}]  …${v.excerpt}…`);
}

const scope = `${sources.length} source files, ${pages.length} built pages${pages.length ? '' : ' (no build/ yet)'}`;
if (failures.length) {
	console.error(`\nclaims-lint: ${failures.length} forbidden claim(s) in ${scope}.`);
	process.exit(1);
}
console.log(`claims-lint: no forbidden claims in ${scope}.`);
