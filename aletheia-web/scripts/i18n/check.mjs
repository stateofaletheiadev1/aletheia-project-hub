/**
 * i18n quality gate (run in CI via `npm run i18n:check`).
 *
 *   node scripts/i18n/check.mjs            verify coverage + placeholders
 *   node scripts/i18n/check.mjs --merge D  first merge translation chunks from dir D
 *
 * Chunk files are JSON objects: { "English source": ["de", "nl", "sr", "it"] }.
 */
import fs from 'node:fs';
import path from 'node:path';

const LOCALES = ['de', 'nl', 'sr', 'it'];
const dir = path.join(process.cwd(), 'lib/i18n/messages');
const source = JSON.parse(fs.readFileSync('lib/i18n/source.json', 'utf8'));
const messages = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'))]));
const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

let errors = 0;
const fail = (msg) => { errors++; console.log('  ✗ ' + msg); };

const mergeIdx = process.argv.indexOf('--merge');
if (mergeIdx > -1) {
  const chunkDir = process.argv[mergeIdx + 1];
  let merged = 0;
  for (const f of fs.readdirSync(chunkDir).filter((x) => /^t\d+\.json$/.test(x)).sort()) {
    const chunk = JSON.parse(fs.readFileSync(path.join(chunkDir, f), 'utf8'));
    for (const [src, tr] of Object.entries(chunk)) {
      if (!(src in source)) { fail(`${f}: unknown source "${src.slice(0, 70)}"`); continue; }
      if (!Array.isArray(tr) || tr.length !== 4 || tr.some((x) => typeof x !== 'string' || !x.trim())) {
        fail(`${f}: needs 4 translations for "${src.slice(0, 70)}"`);
        continue;
      }
      LOCALES.forEach((l, i) => { messages[l][src] = tr[i]; });
      merged++;
    }
  }
  for (const l of LOCALES) {
    // Drop translations whose English source no longer exists.
    const sorted = Object.fromEntries(Object.entries(messages[l]).filter(([k]) => k in source).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(path.join(dir, `${l}.json`), JSON.stringify(sorted, null, 2) + '\n');
    messages[l] = sorted;
  }
  console.log(`merged ${merged} entries`);
}

for (const l of LOCALES) {
  const m = messages[l];
  const missing = Object.keys(source).filter((k) => !(k in m));
  const stale = Object.keys(m).filter((k) => !(k in source));
  for (const k of Object.keys(m)) {
    if (k in source && placeholders(k) !== placeholders(m[k])) fail(`${l}: placeholders differ for "${k.slice(0, 60)}"`);
  }
  console.log(`${l}: ${Object.keys(source).length - missing.length}/${Object.keys(source).length} translated, ${stale.length} stale`);
  if (missing.length) {
    fail(`${l}: ${missing.length} missing, e.g. "${missing[0].slice(0, 60)}"`);
  }
}

if (errors) {
  console.log(`\n${errors} problem(s)`);
  process.exit(1);
}
console.log('\ni18n OK');
