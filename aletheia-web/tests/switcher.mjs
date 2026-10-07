/**
 * Clicks the footer language links in a real browser and checks that the
 * page, its <html lang> and its visible copy actually switch — then that the
 * choice sticks on the next unprefixed visit (NEXT_LOCALE cookie).
 *
 *   node tests/switcher.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3123';
const STEPS = [
  { label: 'Deutsch', path: '/de/constitution', lang: 'de-DE', text: 'Bund' },
  { label: 'Nederlands', path: '/nl/constitution', lang: 'nl-NL', text: 'Verbond' },
  { label: 'Српски', path: '/sr/constitution', lang: 'sr-Cyrl-RS', text: 'Завет' },
  { label: 'Italiano', path: '/it/constitution', lang: 'it-IT', text: 'Patto' },
  { label: 'English', path: '/constitution', lang: 'en-GB', text: 'Covenant' },
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/constitution`, { waitUntil: 'networkidle' });
const failures = [];
for (const step of STEPS) {
  await page.locator('footer nav[aria-label] button', { hasText: step.label }).first().click();
  await page.waitForURL((u) => u.pathname === step.path, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  const url = new URL(page.url()).pathname;
  const lang = await page.getAttribute('html', 'lang');
  const h1 = (await page.locator('h1').first().textContent()) || '';
  const ok = url === step.path && lang === step.lang && h1.includes(step.text);
  console.log(`${ok ? '✓' : '✗'} ${step.label}: ${url} lang=${lang} h1="${h1.trim().slice(0, 60)}"`);
  if (!ok) failures.push(step.label);
}

// The last choice should persist: switch to Italian, then revisit an unprefixed URL.
await page.locator('footer nav[aria-label] button', { hasText: 'Italiano' }).first().click();
await page.waitForURL((u) => u.pathname.startsWith('/it'), { timeout: 15000 }).catch(() => {});
await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
const sticky = new URL(page.url()).pathname === '/it/faq';
console.log(`${sticky ? '✓' : '✗'} remembered choice: ${new URL(page.url()).pathname}`);
if (!sticky) failures.push('cookie');

await browser.close();
if (failures.length) { console.error(`\nswitcher failed: ${failures.join(', ')}`); process.exit(1); }
console.log('\nswitcher OK');
