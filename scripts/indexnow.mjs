#!/usr/bin/env node
/**
 * Tell IndexNow search engines (Bing, Yandex, Seznam, Naver, Yep; Bing feeds Yahoo,
 * DuckDuckGo and Ecosia) about every URL in each site's live sitemap.
 *
 *   node scripts/indexnow.mjs            all three sites
 *   node scripts/indexnow.mjs rba        only hosts containing "rba"
 *   node scripts/indexnow.mjs --dry-run  list what would be sent
 *
 * The key is public by design: each site serves it at /<key>.txt so engines can
 * check that the submission comes from the site owner. Run after a deploy.
 */
const KEY = 'df78f7d95376dbe1ae712a9fdef944e3';
const SITES = ['https://stateofaletheia.org', 'https://aletheiagov.org', 'https://rba.aletheiagov.org'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filter = args.find((a) => !a.startsWith('--'));

async function sitemapUrls(origin) {
  const res = await fetch(`${origin}/sitemap.xml`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${origin}/sitemap.xml returned ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

let failed = false;
for (const origin of SITES.filter((s) => !filter || s.includes(filter))) {
  const host = new URL(origin).host;
  try {
    const key = await fetch(`${origin}/${KEY}.txt`, { redirect: 'manual' });
    if (key.status !== 200 || (await key.text()).trim() !== KEY) {
      throw new Error(`key file not served directly at ${origin}/${KEY}.txt (status ${key.status}); deploy first`);
    }
    // Only URLs on this exact host are accepted; IndexNow takes up to 10,000 per request.
    const urls = [...new Set(await sitemapUrls(origin))].filter((u) => new URL(u).host === host).slice(0, 10000);
    if (dryRun) {
      console.log(`${host}: ${urls.length} URLs\n  ${urls.join('\n  ')}`);
      continue;
    }
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: KEY, keyLocation: `${origin}/${KEY}.txt`, urlList: urls }),
    });
    // 200 = accepted, 202 = accepted, key check pending.
    if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow returned ${res.status}: ${await res.text()}`);
    console.log(`${host}: submitted ${urls.length} URLs (${res.status})`);
  } catch (e) {
    failed = true;
    console.error(`${host}: ${e.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
