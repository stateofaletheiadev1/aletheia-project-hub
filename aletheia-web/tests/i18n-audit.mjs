/**
 * Renders every public route in a non-English locale and reports visible text
 * (and accessible attributes) that is still English.
 *
 *   node tests/i18n-audit.mjs [baseUrl] [locale]
 *
 * A string is flagged when it is an untranslated key from lib/i18n/source.json,
 * or when it reads as English prose (several common English function words).
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3123';
const LOCALE = process.argv[3] || 'de';
const source = JSON.parse(fs.readFileSync('lib/i18n/source.json', 'utf8'));
const messages = JSON.parse(fs.readFileSync(`lib/i18n/messages/${LOCALE}.json`, 'utf8'));
const routesSrc = fs.readFileSync('lib/routes.ts', 'utf8');
const portal = fs.readdirSync('app/[lang]/portal', { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => `/portal/${d.name}`);
const slugs = (file, re) => [...fs.readFileSync(file, 'utf8').matchAll(re)].map((m) => m[1]).slice(0, 3);
const routes = [...new Set([
  ...[...routesSrc.matchAll(/['"](\/[a-z0-9/-]*)['"]/g)].map((m) => m[1]),
  '/portal', ...portal,
  ...slugs('lib/statutes.ts', /slug:\s*'([^']+)'/g).map((s) => `/laws/${s}`),
  ...slugs('lib/gazette.ts', /slug:\s*'([^']+)'/g).map((s) => `/news/${s}`),
])].filter((r) => !/^\/(admin|officer|pdf|api)/.test(r));

// Strings that are legitimately identical in every language.
const identical = new Set(Object.entries(messages).filter(([k, v]) => k === v).map(([k]) => k));
// English function words that are not also everyday words in the target language.
const SHARED = { nl: ['of', 'is', 'will', 'be', 'by'], de: ['will'], it: [], sr: [] };
const STOP = ['the', 'and', 'of', 'with', 'for', 'your', 'is', 'are', 'this', 'from', 'our', 'will', 'be', 'by', 'to']
  .filter((w) => !(SHARED[LOCALE] || []).includes(w));
const ENGLISH = new RegExp(`\\b(${STOP.join('|')})\\b`, 'gi');

// Serbian is written in Cyrillic, so any run of Latin words is suspect there
// (acronyms, product names and codes excepted).
const LATIN_WORDS = /\b[A-Za-z][a-z]{3,}\b/;
const PROPER = /\b(AletheiaChain|Aletheia|Manrope|Unsplash|Merkle|Groth16|Plonk|WebAuthn|Touch ID|Veritas in Foedere|Kaelen Vance Marine|Port Nicholas|Elena Vasquez)\b|did:aletheia:\S+/g;

const translated = new Set(Object.values(messages).map((v) => v.trim()));

const looksEnglish = (s) => {
  if (identical.has(s) || translated.has(s)) return false;
  if (source[s] !== undefined) return true;
  if (LOCALE === 'sr') return LATIN_WORDS.test(s.replace(PROPER, ''));
  const hits = (s.match(ENGLISH) || []).length;
  return s.split(/\s+/).length >= 4 && hits >= 2;
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = {};
for (const route of routes) {
  const url = `${BASE}/${LOCALE}${route === '/' ? '' : route}`;
  const visit = () => page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => null);
  const res = (await visit()) ?? (await visit());
  if (!res || res.status() >= 400) { report[route] = [`HTTP ${res?.status() ?? 'error'}`]; continue; }
  // Reveal hover-only menus on the first page so their labels are audited too.
  if (route === '/') {
    for (const trigger of await page.locator('nav[aria-label] [aria-expanded]').all()) {
      await trigger.hover().catch(() => {});
      await page.waitForTimeout(150);
    }
  }
  const found = await page.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,[lang="en"],[data-i18n-skip]')) continue;
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (s.length > 1) out.add(s);
    }
    for (const el of document.querySelectorAll('[placeholder],[aria-label],[alt],[title]')) {
      for (const a of ['placeholder', 'aria-label', 'alt', 'title']) {
        const v = el.getAttribute(a);
        if (v && v.trim().length > 1) out.add(v.trim());
      }
    }
    out.add(document.title);
    return [...out];
  });
  const english = found.filter(looksEnglish);
  if (english.length) report[route] = english;
}
await browser.close();

let total = 0;
for (const [route, items] of Object.entries(report)) {
  console.log(`\n${route}`);
  for (const s of items) console.log(`  · ${s.slice(0, 140)}`);
  total += items.length;
}
console.log(`\n${total} English string(s) across ${Object.keys(report).length} page(s) in /${LOCALE}`);
process.exit(total ? 1 : 0);
