/**
 * The officer console on its own address (ADMIN_HOST). The test uses two names for the same
 * machine: 127.0.0.1 plays the console's address, localhost the main site's.
 *
 *   npm run build && npm run test:hosts
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { start } from './harness.mjs';

const webDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 3195;
const SITE = `http://localhost:${PORT}`;
const CONSOLE = `http://127.0.0.1:${PORT}`;
const PASS = 'correct horse battery staple 42';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const get = (url, init = {}) => fetch(url, { redirect: 'manual', ...init });

// The public site's published address; on a real deployment it differs from the console's,
// so redirects to it stay absolute (Next.js shortens a redirect to the server's own origin).
const PUBLIC_SITE = 'https://site.example';
const env = await start({ dbPort: 7795, webPort: PORT, smtpPort: 2595, env: { ADMIN_HOST: '127.0.0.1', PUBLIC_SITE_URL: PUBLIC_SITE } });
try {
  execFileSync(process.execPath, [path.join(webDir, 'scripts/db/officer-bootstrap.mjs'), 'registrar@example.org', 'Amara Okafor'], {
    env: { ...process.env, ALETHEIADB_URL: env.dbUrl, DATA_ENCRYPTION_MASTER_KEY: env.masterKey, BOOTSTRAP_PASSPHRASE: PASS },
    cwd: webDir,
    stdio: 'ignore',
  });

  console.log('main site');
  let r = await get(`${SITE}/admin/login`);
  check('/admin/login moves to the console address', r.status === 308 && r.headers.get('location') === 'https://127.0.0.1/admin/login', `${r.status} ${r.headers.get('location')}`);
  r = await get(`${SITE}/de/admin/citizens?x=1`);
  check('localised console pages move too, with the query', r.status === 308 && r.headers.get('location') === 'https://127.0.0.1/de/admin/citizens?x=1', r.headers.get('location'));
  r = await get(`${SITE}/officer`);
  check('/officer moves too', r.status === 308);
  check('the console API is not served on the main site', (await get(`${SITE}/api/admin/me`)).status === 404);
  check('public pages stay', (await get(`${SITE}/`)).status === 200);
  check('the portal stays', [200].includes((await get(`${SITE}/portal/login`)).status));
  check('the portal API stays', (await get(`${SITE}/api/portal/me`)).status === 401);

  console.log('console address');
  r = await get(`${CONSOLE}/`);
  check('the root opens the console', r.status === 307 && new URL(r.headers.get('location'), CONSOLE).pathname === '/admin', r.headers.get('location'));
  check('the console login page is served', (await get(`${CONSOLE}/admin/login`)).status === 200);
  r = await get(`${CONSOLE}/citizenship?a=b`);
  check('public pages go back to the main site', r.status === 308 && r.headers.get('location') === `${PUBLIC_SITE}/citizenship?a=b`, r.headers.get('location'));
  check('the portal is not served on the console address', (await get(`${CONSOLE}/portal/login`)).status === 308);
  check('the portal API is not served on the console address', (await get(`${CONSOLE}/api/portal/me`)).status === 404);

  console.log('sign-in on the console address');
  r = await get(`${CONSOLE}/api/admin/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: CONSOLE }, body: JSON.stringify({ username: 'SEC-OFFICER-0001', passphrase: PASS }) });
  const cookie = (r.headers.getSetCookie()[0] ?? '').split(';')[0];
  check('officer signs in', r.status === 200 && cookie.startsWith('ale_officer_session='), String(r.status));
  check('the cookie belongs to the console address only', !/domain=/i.test(r.headers.getSetCookie()[0] ?? ''));
  r = await get(`${CONSOLE}/api/admin/me`, { headers: { cookie } });
  check('session works on the console address', r.status === 200);
  check('a write from the main site is refused', (await get(`${CONSOLE}/api/admin/auth/logout`, { method: 'POST', headers: { origin: SITE, cookie, 'content-type': 'application/json' }, body: '{}' })).status === 403);
} catch (e) {
  check('flow completed', false, String(e));
} finally {
  env.stop();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
