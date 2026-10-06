/**
 * HTTP smoke test against a running build: locale routing, localized 404s and
 * every official PDF.
 *
 *   node tests/smoke.mjs [baseUrl]
 */
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3123';
const ids = (file, key) => [...fs.readFileSync(file, 'utf8').matchAll(new RegExp(`${key}:\\s*'([^']+)'`, 'g'))].map((m) => m[1]);

const failures = [];
async function expect(path, { status, location, type, lang, headers = {} }) {
  const res = await fetch(BASE + path, { redirect: 'manual', headers });
  const problems = [];
  if (res.status !== status) problems.push(`status ${res.status} ≠ ${status}`);
  if (location && !(res.headers.get('location') || '').endsWith(location)) problems.push(`location ${res.headers.get('location')} ≠ …${location}`);
  if (type && !(res.headers.get('content-type') || '').startsWith(type)) problems.push(`content-type ${res.headers.get('content-type')}`);
  if (type === 'application/pdf') {
    const head = Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString();
    if (head !== '%PDF-') problems.push('body is not a PDF');
  } else if (lang) {
    const html = await res.text();
    if (!html.includes(`<html lang="${lang}"`)) problems.push(`html lang ≠ ${lang}`);
  }
  if (problems.length) failures.push(`${path}: ${problems.join(', ')}`);
  else console.log(`✓ ${path}`);
}

// Locale routing
await expect('/', { status: 200, lang: 'en-GB' });
for (const [l, intl] of [['de', 'de-DE'], ['nl', 'nl-NL'], ['sr', 'sr-Cyrl-RS'], ['it', 'it-IT']]) {
  await expect(`/${l}`, { status: 200, lang: intl });
  await expect(`/${l}/constitution`, { status: 200, lang: intl });
}
await expect('/en/faq', { status: 308, location: '/faq' });
await expect('/faq', { status: 307, location: '/de/faq', headers: { 'accept-language': 'de-DE,de;q=0.9' } });
await expect('/faq', { status: 307, location: '/nl/faq', headers: { cookie: 'NEXT_LOCALE=nl' } });
await expect('/no-such-page', { status: 404 });
await expect('/de/no-such-page', { status: 404 });

// Official PDFs
await expect('/pdf/constitution', { status: 200, type: 'application/pdf' });
for (const s of ids('lib/statutes.ts', 'slug')) await expect(`/pdf/statutes/${s}`, { status: 200, type: 'application/pdf' });
for (const s of ids('lib/gazette.ts', 'slug')) await expect(`/pdf/gazette/${s}`, { status: 200, type: 'application/pdf' });
for (const s of ids('lib/documents.ts', 'id')) await expect(`/pdf/documents/${s}`, { status: 200, type: 'application/pdf' });
for (const s of ids('lib/bonds.ts', 'id')) await expect(`/pdf/bonds/${s}`, { status: 200, type: 'application/pdf' });
await expect('/pdf/statutes/no-such-act', { status: 404 });

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nsmoke OK');
