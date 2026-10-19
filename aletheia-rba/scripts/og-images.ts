/**
 * Builds the 1200 × 630 Open Graph images in static/og/: typographic navy and parchment
 * compositions with the Bank's mark, set in Manrope. Rendered in Chromium (Playwright), so the
 * fonts and the seal are exactly those of the site.
 *
 * Usage: tsx scripts/og-images.ts
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { markSvg } from '../src/lib/brand/seal.ts';

const out = resolve('static', 'og');
mkdirSync(out, { recursive: true });

const font = readFileSync(resolve('src/lib/assets/fonts/manrope-latin-wght-normal.woff2')).toString(
	'base64'
);

const NAVY = '#15294a';
const PARCHMENT = '#f4eedf';
const GOLD = '#c49a4e';
const GOLD_INK = '#7e6029';

interface Card {
	file: string;
	eyebrow: string;
	title: string;
	note: string;
	tone: 'navy' | 'parchment';
}

const cards: Card[] = [
	{
		file: 'default',
		eyebrow: 'Reserve Bank of Aletheia',
		title: 'Stewardship of the Aletheian Guilder.',
		note: 'Sovereign Covenant State of Aletheia',
		tone: 'navy'
	},
	{
		file: 'currency',
		eyebrow: 'The currency',
		title: 'The Aletheian Guilder (AEY).',
		note: 'The currency of the Sovereign Covenant State of Aletheia',
		tone: 'parchment'
	},
	{
		file: 'banknotes',
		eyebrow: 'Banknote designs',
		title: 'Five denominations, in design.',
		note: '1 · 5 · 10 · 20 · 100 AEY',
		tone: 'navy'
	},
	{
		file: 'monetary-policy',
		eyebrow: 'Monetary policy',
		title: 'A framework decided in public.',
		note: 'The intended framework for the Aletheian Guilder',
		tone: 'parchment'
	},
	{
		file: 'reserves',
		eyebrow: 'Reserves',
		title: 'Reserves and exchange.',
		note: 'Policy and reports of the Reserve Bank of Aletheia',
		tone: 'navy'
	},
	{
		file: 'publications',
		eyebrow: 'Publications',
		title: 'The written record.',
		note: 'Documents of the Reserve Bank of Aletheia',
		tone: 'parchment'
	}
];

function html(card: Card): string {
	const navy = card.tone === 'navy';
	const fg = navy ? PARCHMENT : NAVY;
	const accent = navy ? GOLD : GOLD_INK;
	const mark = markSvg(
		{ line: navy ? GOLD : NAVY, star: GOLD, ground: navy ? NAVY : PARCHMENT },
		380
	);
	return `<!doctype html><html><head><style>
@font-face { font-family: Manrope; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: ${navy ? NAVY : PARCHMENT}; color: ${fg}; font-family: Manrope; overflow: hidden; }
.frame { position: absolute; inset: 28px; border: 1px solid ${navy ? 'rgba(244,238,223,.28)' : 'rgba(21,41,74,.3)'}; }
.frame::after { content: ''; position: absolute; inset: 6px; border: 1px solid ${navy ? 'rgba(196,154,78,.5)' : 'rgba(196,154,78,.7)'}; }
.text { position: absolute; left: 84px; top: 84px; width: 660px; height: 462px; display: flex; flex-direction: column; }
.eyebrow { font-size: 22px; font-weight: 650; letter-spacing: .12em; text-transform: uppercase; color: ${accent}; }
h1 { margin-top: 36px; font-size: 76px; line-height: 1.04; font-weight: 300; letter-spacing: -0.03em; }
.note { margin-top: auto; font-size: 24px; font-weight: 450; opacity: .8; }
.domain { margin-top: 14px; font-size: 20px; font-weight: 650; letter-spacing: .08em; color: ${accent}; }
.mark { position: absolute; right: 70px; top: 125px; opacity: .95; }
</style></head><body><div class="frame"></div>
<div class="text"><p class="eyebrow">${card.eyebrow}</p><h1>${card.title}</h1><p class="note">${card.note}</p><p class="domain">RBALETHEIA.ORG</p></div>
<div class="mark">${mark}</div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const card of cards) {
	await page.setContent(html(card), { waitUntil: 'load' });
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: join(out, `${card.file}.png`), type: 'png' });
	console.log(`static/og/${card.file}.png`);
}
await browser.close();
