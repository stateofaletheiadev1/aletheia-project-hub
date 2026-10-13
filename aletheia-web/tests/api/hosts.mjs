/**
 * The officer console on its own address, as on the real domains: requests carry the Host
 * stateofaletheia.org / www.stateofaletheia.org / adss.oiss.stateofaletheia.org, and a browser
 * opens http://stateofaletheia.org (mapped to the local server) and clicks "Officer Portal".
 * No setting is involved: the split is automatic on those domains.
 *
 *   npm run build && npm run test:hosts
 */
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from './harness.mjs';

const webDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 3195;
const PASS = 'correct horse battery staple 42';
const SITE = 'stateofaletheia.org';
const CONSOLE = 'adss.oiss.stateofaletheia.org';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

/** A request to the local server as if it arrived for `host`. */
function req(host, pathname, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: pathname, method, headers: { host, ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, cookies: res.headers['set-cookie'] ?? [], body: data }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

const env = await start({ dbPort: 7795, webPort: PORT, smtpPort: 2595 });
let browser;
try {
  execFileSync(process.execPath, [path.join(webDir, 'scripts/db/officer-bootstrap.mjs'), 'registrar@example.org', 'Amara Okafor'], {
    env: { ...process.env, ALETHEIADB_URL: env.dbUrl, DATA_ENCRYPTION_MASTER_KEY: env.masterKey, BOOTSTRAP_PASSPHRASE: PASS },
    cwd: webDir,
    stdio: 'ignore',
  });

  console.log('main site (stateofaletheia.org and www.)');
  let r = await req(SITE, '/admin/login');
  check('/admin/login moves to the console address', r.status === 308 && r.location === `https://${CONSOLE}/admin/login`, `${r.status} ${r.location}`);
  r = await req(`www.${SITE}`, '/admin/login');
  check('same from www.', r.status === 308 && r.location === `https://${CONSOLE}/admin/login`, `${r.status} ${r.location}`);
  r = await req(SITE, '/de/admin/citizens?x=1');
  check('localised console pages move too, with the query', r.location === `https://${CONSOLE}/de/admin/citizens?x=1`, r.location);
  check('/officer moves too', (await req(SITE, '/officer')).status === 308);
  check('the console API is not served on the main site', (await req(SITE, '/api/admin/me')).status === 404);
  check('public pages stay', (await req(SITE, '/')).status === 200);
  check('the portal stays', (await req(SITE, '/portal/login')).status === 200);
  check('the portal API stays', (await req(SITE, '/api/portal/me')).status === 401);

  console.log('console address (adss.oiss.stateofaletheia.org)');
  r = await req(CONSOLE, '/');
  check('the root opens the console login', r.status === 307 && new URL(r.location, `https://${CONSOLE}`).pathname === '/admin/login', r.location);
  check('the console login page is served', (await req(CONSOLE, '/admin/login')).status === 200);
  r = await req(CONSOLE, '/citizenship?a=b');
  check('public pages go back to the main site', r.status === 308 && r.location === `https://${SITE}/citizenship?a=b`, r.location);
  check('the portal is not served on the console address', (await req(CONSOLE, '/portal/login')).status === 308);
  check('the portal API is not served on the console address', (await req(CONSOLE, '/api/portal/me')).status === 404);

  console.log('sign-in on the console address');
  r = await req(CONSOLE, '/api/admin/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: `https://${CONSOLE}` }, body: JSON.stringify({ username: 'SEC-OFFICER-0001', passphrase: PASS }) });
  const cookie = (r.cookies[0] ?? '').split(';')[0];
  check('officer signs in', r.status === 200 && cookie.startsWith('ale_officer_session='), `${r.status} ${r.body.slice(0, 120)}`);
  check('the cookie belongs to the console address only', !/domain=/i.test(r.cookies[0] ?? ''));
  check('session works on the console address', (await req(CONSOLE, '/api/admin/me', { headers: { cookie } })).status === 200);
  check('a write from the main site is refused', (await req(CONSOLE, '/api/admin/auth/logout', { method: 'POST', headers: { origin: `https://${SITE}`, cookie, 'content-type': 'application/json' }, body: '{}' })).status === 403);

  console.log('elsewhere (local, previews)');
  check('localhost serves the console directly', (await req(`localhost:${PORT}`, '/admin/login')).status === 200);
  check('a vercel.app preview serves the console directly', (await req('aletheia-web-iota.vercel.app', '/admin/login')).status === 200);

  console.log('in a browser');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: [`--host-resolver-rules=MAP ${SITE} 127.0.0.1:${PORT}, MAP www.${SITE} 127.0.0.1:${PORT}`] });
  const page = await browser.newPage();
  // The console's real address needs TLS this machine does not have: answer it with a marker page.
  await page.route(`https://${CONSOLE}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: `<title>console</title><p id="where">${route.request().url()}</p>` }));
  for (const [where, link] of [['top bar', 'Officer Portal'], ['footer', 'Officer Admin Clearance Access']]) {
    await page.goto(`http://${SITE}/`);
    await page.getByRole('link', { name: link }).first().click();
    await page.waitForURL(`https://${CONSOLE}/**`, { timeout: 15000 });
    check(`clicking "${link}" (${where}) shows https://${CONSOLE}/admin/login in the address bar`, page.url() === `https://${CONSOLE}/admin/login`, page.url());
  }
} catch (e) {
  check('flow completed', false, String(e).split('\n').slice(0, 3).join(' '));
} finally {
  await browser?.close();
  env.stop();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
