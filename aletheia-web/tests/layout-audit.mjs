/**
 * Layout audit: flags overlapping text and horizontal overflow on every public
 * page at phone, tablet, laptop and desktop widths.
 *
 *   node tests/layout-audit.mjs [baseURL]     (default http://localhost:3123)
 *
 * Exits non-zero when any page has overlapping text or sideways scrolling.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3123';
const WIDTHS = [390, 768, 1024, 1280, 1440];
const PAGES = [
  '/', '/aletheia', '/vision', '/identity', '/society', '/healthcare', '/education', '/transparency', '/news',
  '/news/public-key-directory', '/documents', '/contact', '/faq', '/government', '/government/ministry-of-foreign-affairs',
  '/government/ministry-of-maritime', '/constitution', '/laws', '/laws/adss-act', '/citizenship', '/citizenship/apply',
  '/registry', '/e-residency', '/immigration', '/design/travel-document', '/founding-members', '/about', '/roadmap', '/thesis', '/host-nations', '/development', '/infrastructure', '/energy', '/economy',
  '/treasury', '/central-bank', '/aey', '/aey/paper-currency', '/de/aey/paper-currency', '/stablechain', '/business', '/invest', '/technology', '/security', '/adss',
  '/adss/cybersecurity', '/privacy', '/terms', '/accessibility', '/portal/login', '/de', '/nl', '/sr', '/it', '/sr/citizenship', '/de/citizenship/apply', '/nl/registry',
];

const AUDIT = () => {
  const vw = document.documentElement.clientWidth;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  // Elements that directly contain text.
  const texts = [...document.querySelectorAll('main *, header *, footer *')].filter((el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) &&
    visible(el) && !el.closest('[aria-hidden="true"], .sr-only, [data-no-reveal], svg') &&
    // Content of a closed <details> is not rendered; wrapped inline text has a multi-line box.
    !el.closest('details:not([open]) > :not(summary)') && el.getClientRects().length === 1,
  );
  const rects = texts.map((el) => ({ el, r: el.getBoundingClientRect() }));
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w <= 2 || h <= 2) continue;
      const smaller = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if ((w * h) / smaller > 0.25) {
        overlaps.push(`"${a.el.textContent.trim().slice(0, 40)}" × "${b.el.textContent.trim().slice(0, 40)}"`);
      }
    }
  }
  return { overflow: document.documentElement.scrollWidth - vw, overlaps: [...new Set(overlaps)].slice(0, 6) };
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let problems = 0;
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const { overflow, overlaps } = await page.evaluate(AUDIT);
    if (overflow > 1 || overlaps.length) {
      problems++;
      console.log(`✗ ${width}px ${path}${overflow > 1 ? `  overflow +${overflow}px` : ''}`);
      for (const o of overlaps) console.log(`    overlap ${o}`);
    }
  }
  await page.close();
}
await browser.close();
console.log(problems ? `\n${problems} page/width combination(s) need attention` : '\nlayout OK');
process.exit(problems ? 1 : 0);
