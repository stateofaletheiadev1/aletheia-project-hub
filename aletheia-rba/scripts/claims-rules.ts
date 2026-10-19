/**
 * Forbidden-claims rules (brief §2.3). Pure functions; the CLI is scripts/claims-lint.ts.
 *
 * Source files: a match is allowed only when the line it starts or ends on carries
 * `claims-lint-allow: <reason>` (in any comment style: //, <!-- -->, /* *\/).
 *
 * Built HTML: only visible text is scanned (script, style and comments removed), and text inside
 * an element with a `data-claims-allow="<reason>"` attribute is exempt. Comments do not survive
 * the build, so that attribute is how an allowed source line stays allowed in the output.
 */

export interface Rule {
	id: string;
	pattern: RegExp;
}

export const RULES: readonly Rule[] = [
	{ id: 'percent-backed', pattern: /100\s*%\s*(euro[- ]?)?back/i },
	{ id: 'fully-backed', pattern: /fully\s+backed/i },
	{ id: 'eur-to-aey-rate', pattern: /(€|EUR)\s*1(\.00)?\s*(=|per|to)\s*1?\s*AEY/i },
	{ id: 'aey-to-eur-rate', pattern: /1\s*AEY\s*(=|equals)\s*(€|EUR)/i },
	{ id: 'guaranteed-conversion', pattern: /guaranteed\s+(redemption|convertib|exchange)/i },
	{ id: 'redeemable-in-euro', pattern: /redeemable\s+(for|in)\s+euro/i },
	{ id: 'reserve-figure', pattern: /(holds|reserves of)\s+[\d.,]+\s*(million|billion|bn|m)\b/i },
	{ id: 'legal-tender', pattern: /legal\s+tender/i },
	{ id: 'licensed-or-regulated', pattern: /licensed|regulated\s+by|authori[sz]ed\s+by/i },
	{ id: 'recognised', pattern: /recogni[sz]ed\s+(central\s+bank|by\s+the)/i },
	{ id: 'in-circulation', pattern: /in\s+circulation/i },
	{
		id: 'hype',
		pattern: /revolutionis|unlock(ing)?\s+limitless|redefin(e|ing)\s+finance|to\s+the\s+moon|web3/i
	}
];

export interface Violation {
	rule: string;
	line: number;
	excerpt: string;
}

const ALLOW = /claims-lint-allow:\s*\S/;

function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
	return starts;
}

function lineOf(starts: number[], index: number): number {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if ((starts[mid] ?? 0) <= index) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1;
}

function excerptAround(text: string, start: number, end: number): string {
	return text
		.slice(Math.max(0, start - 30), Math.min(text.length, end + 30))
		.replace(/\s+/g, ' ')
		.trim();
}

/** Scan a source file (.svelte, .ts, .md). */
export function scanSource(text: string): Violation[] {
	const starts = lineStarts(text);
	const lines = text.split('\n');
	const out: Violation[] = [];
	for (const rule of RULES) {
		const re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', '') + 'g');
		for (const m of text.matchAll(re)) {
			const start = m.index ?? 0;
			const end = start + m[0].length;
			const first = lineOf(starts, start);
			const last = lineOf(starts, Math.max(start, end - 1));
			const allowed = [first, last].some((n) => ALLOW.test(lines[n - 1] ?? ''));
			if (!allowed)
				out.push({ rule: rule.id, line: first, excerpt: excerptAround(text, start, end) });
		}
	}
	return out.sort((a, b) => a.line - b.line);
}

const VOID = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'track',
	'wbr'
]);

/**
 * Visible text of an HTML document, minus regions marked `data-claims-allow`. Tags are replaced
 * with spaces so words on either side of a tag stay apart.
 */
export function visibleText(html: string): string {
	const cleaned = html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
		.replace(/<template\b[\s\S]*?<\/template>/gi, ' ');
	const tag = /<\/?([a-zA-Z][\w-]*)\b([^>]*)>/g;
	const stack: { name: string; allow: boolean }[] = [];
	let allowDepth = 0;
	let text = '';
	let last = 0;
	for (const m of cleaned.matchAll(tag)) {
		const index = m.index ?? 0;
		if (allowDepth === 0) text += cleaned.slice(last, index);
		text += ' ';
		last = index + m[0].length;
		const name = (m[1] ?? '').toLowerCase();
		const attrs = m[2] ?? '';
		if (m[0].startsWith('</')) {
			// Pop to the matching open tag; tolerate unclosed elements.
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i]?.name === name) {
					for (const popped of stack.splice(i)) if (popped.allow) allowDepth--;
					break;
				}
			}
		} else if (!VOID.has(name) && !attrs.trimEnd().endsWith('/')) {
			const allow = /\sdata-claims-allow\s*=\s*["'][^"']*\S[^"']*["']/.test(attrs);
			stack.push({ name, allow });
			if (allow) allowDepth++;
		}
	}
	if (allowDepth === 0) text += cleaned.slice(last);
	return decodeEntities(text).replace(/\s+/g, ' ');
}

function decodeEntities(s: string): string {
	return s
		.replace(/&nbsp;|&#160;/g, ' ')
		.replace(/&euro;|&#8364;/g, '€')
		.replace(/&percnt;|&#37;/g, '%')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'");
}

/** Scan a built HTML page. Line numbers are not meaningful here, so `line` is 0. */
export function scanHtml(html: string): Violation[] {
	const text = visibleText(html);
	const out: Violation[] = [];
	for (const rule of RULES) {
		const re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', '') + 'g');
		for (const m of text.matchAll(re)) {
			const start = m.index ?? 0;
			out.push({
				rule: rule.id,
				line: 0,
				excerpt: excerptAround(text, start, start + m[0].length)
			});
		}
	}
	return out;
}
