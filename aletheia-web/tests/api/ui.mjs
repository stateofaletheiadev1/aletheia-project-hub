/**
 * Browser test of the portal and the officer console against a real AletheiaDB:
 * an applicant signs up, uploads a document and applies for e-residency; an officer signs in
 * with a TOTP code, verifies the document and grants the application; the applicant then sees
 * the e-residency and downloads the certificate. Every portal and console page is opened and
 * must render without errors.
 *
 *   npm run build && npm run test:ui
 */
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from './harness.mjs';

const webDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PASS = 'correct horse battery staple 42';
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

function totp(secret, t = Date.now()) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const c of secret) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(t / 30_000)));
  const mac = createHmac('sha1', Buffer.from(out)).update(msg).digest();
  const o = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const env = await start({ dbPort: 7798, webPort: 3198 });
// CHROMIUM_PATH points at a browser when the installed Playwright has none of its own.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined }).catch((e) => {
  env.stop();
  throw e;
});
setTimeout(() => { console.error('ui test: overall timeout'); process.exit(2); }, 420_000).unref();
try {
  const { base } = env;
  const out = execFileSync(process.execPath, [path.join(webDir, 'scripts/db/officer-bootstrap.mjs'), 'registrar@stateofaletheia.org', 'Amara Okafor'], {
    env: { ...process.env, ALETHEIADB_URL: env.dbUrl, DATA_ENCRYPTION_MASTER_KEY: env.masterKey, BOOTSTRAP_PASSPHRASE: PASS },
    cwd: webDir,
  }).toString();
  const officerId = out.match(/(SEC-OFFICER-\d+)/)[1];
  const secret = out.match(/secret \(TOTP[^:]*: ([A-Z2-7]+)/)[1];

  const errorsOf = (page) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    return errors;
  };

  console.log('applicant');
  const citizen = await browser.newContext({ acceptDownloads: true });
  const p = await citizen.newPage();
  const pErrors = errorsOf(p);
  await p.goto(`${base}/portal`);
  await p.waitForURL('**/portal/login');
  check('unauthenticated portal redirects to sign-in', p.url().endsWith('/portal/login'));
  await p.getByRole('button', { name: 'Create account' }).first().click();
  await p.getByLabel('Full legal name').fill('Grace Hopper');
  await p.getByLabel('Email address').fill('grace@example.org');
  await p.getByLabel('Passphrase', { exact: true }).fill(PASS);
  await p.locator('form button[type=submit]').click();
  await p.waitForURL('**/portal/apply');
  check('sign-up lands on the application wizard', true);
  await p.getByText('Applying as Grace Hopper').waitFor();
  await p.locator('input[type=date]').fill('1906-12-09');
  await p.locator('input.font-mono').first().fill('US1234567');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByText('Upload your passport data page').waitFor();
  check('cannot continue without a document', await (async () => { await p.getByRole('button', { name: 'Continue' }).click(); return p.getByText('Upload at least one identity document to continue.').isVisible(); })());
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 'x'), Buffer.from('\n%%EOF')]);
  await p.locator('input[type=file]').setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: pdf });
  await p.getByText('passport.pdf · Biometric Passport Scan').waitFor();
  check('document uploaded from the wizard', true);
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  const key = await p.locator('code').innerText();
  check('Ed25519 public key generated in the browser', /^[0-9a-f]{64}$/.test(key.trim()), key);
  await p.locator('input[type=checkbox]').check();
  await p.getByRole('button', { name: 'Submit Application' }).click();
  await p.getByText('Application Submitted to the State Registry').waitFor();
  const reference = (await p.locator('div.text-sm', { hasText: /^ERES-/ }).innerText()).trim();
  check('application submitted with a registry reference', /^ERES-/.test(reference), reference);

  console.log('officer');
  const officer = await browser.newContext({ acceptDownloads: true });
  const o = await officer.newPage();
  const oErrors = errorsOf(o);
  await o.goto(`${base}/admin`);
  await o.waitForURL('**/admin/login');
  check('unauthenticated console redirects to sign-in', true);
  await o.getByLabel('Officer ID').fill(officerId);
  await o.getByLabel('Passphrase', { exact: true }).fill(PASS);
  await o.getByLabel('6-digit authenticator code').fill(totp(secret));
  await o.getByRole('button', { name: /Authorize Console Session/ }).click();
  await o.waitForURL(/\/admin$/);
  await o.getByRole('cell', { name: reference, exact: true }).waitFor();
  check('dashboard queue shows the application', true);
  await o.goto(`${base}/admin/documents`);
  await o.getByRole('button', { name: 'Examine' }).first().click();
  await o.getByRole('button', { name: 'Verify Document' }).click();
  await o.getByText('passport.pdf verified.').first().waitFor();
  check('officer verifies the document', true);
  await o.goto(`${base}/admin/e-residency`);
  await o.getByText('Verified (1 doc)').first().waitFor();
  check('queue shows KYC verified', true);
  await o.getByRole('button', { name: 'Grant E-Residency' }).first().click();
  await o.getByText(`${reference} approved for Grace Hopper`).first().waitFor();
  check('officer grants e-residency', true);

  console.log('treasury');
  o.on('dialog', (d) => d.accept());
  await o.goto(`${base}/admin/treasury`);
  await o.getByLabel('Recipient Aletheia ID').fill('ALE-ID-' + new Date().getUTCFullYear() + '-000001');
  await o.getByLabel('Amount (AEY)').fill('50');
  await o.getByLabel('Reason').fill('Founding grant (test)');
  await o.getByRole('button', { name: 'Issue', exact: true }).click();
  await o.getByText(/AEY issued to ALE-ID-/).first().waitFor();
  check('administrator issues AEY from the Treasury page', (await o.getByText('Total issued: 50.00 AEY').count()) === 1);

  for (const path of ['/admin', '/admin/activity', '/admin/treasury', '/admin/citizens', '/admin/citizenship', '/admin/rescissions', '/admin/immigration', '/admin/e-residency', '/admin/companies', '/admin/documents', '/admin/security', '/admin/settings']) {
    await o.goto(base + path);
    await o.locator('main main h1').first().waitFor();
    await o.waitForLoadState('networkidle');
    const text = await o.locator('main main').innerText();
    check(`console page ${path} renders`, !/Something went wrong|Loading…$/.test(text));
  }
  await o.goto(`${base}/admin/activity`);
  await o.getByText(`Approved e-residency application ${reference}`).first().waitFor();
  check('decision appears in the audit trail', true);
  check('no console errors in the officer browser', oErrors.length === 0, oErrors.join(' | '));

  console.log('applicant again');
  await p.goto(`${base}/portal`);
  await p.getByText('E-Resident · Valid through').first().waitFor();
  check('dashboard shows the e-residency', true);
  await p.goto(`${base}/portal/documents`);
  await p.getByText('Aletheia_E_Residence_Certificate.pdf').first().waitFor();
  const [download] = await Promise.all([
    p.waitForEvent('download'),
    p.getByRole('row', { name: /Aletheia_E_Residence_Certificate/ }).getByRole('button', { name: 'PDF' }).click(),
  ]);
  const bytes = await (await import('node:fs')).promises.readFile(await download.path());
  check('certificate PDF downloads', bytes.subarray(0, 5).toString() === '%PDF-', String(bytes.length));
  await p.goto(`${base}/portal/notifications`);
  await p.getByText('E-Residency granted').first().waitFor();
  check('approval notification delivered', true);
  for (const path of ['/portal', '/portal/notifications', '/portal/identity', '/portal/residency', '/portal/biometrics', '/portal/documents', '/portal/apply', '/portal/companies', '/portal/wallet', '/portal/settings']) {
    await p.goto(base + path);
    await p.locator('main main h1, main main h2').first().waitFor();
    await p.waitForLoadState('networkidle');
    const text = await p.locator('main main').innerText();
    check(`portal page ${path} renders`, !/Something went wrong|Loading…$/.test(text));
  }
  await p.goto(`${base}/portal/wallet`);
  await p.getByText('Issued by the Treasury').first().waitFor();
  check('issued AEY appears in the wallet', (await p.getByText('50.00').count()) > 0);

  console.log('passkey');
  const cdp = await citizen.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await p.goto(`${base}/portal/biometrics`);
  await p.getByLabel('Passkey name').fill('Test laptop');
  await p.getByRole('button', { name: 'Add a passkey' }).click();
  await p.getByText('Passkey added.').first().waitFor();
  check('passkey registered', (await p.getByText('Test laptop').count()) === 1);
  await citizen.clearCookies();
  await p.goto(`${base}/portal/login`);
  await p.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await p.waitForURL(/\/portal$/);
  await p.getByText('Welcome, Grace Hopper').first().waitFor();
  check('signed in with the passkey alone', true);

  console.log('citizenship and oath');
  await p.goto(`${base}/portal/apply?route=naturalisation`);
  await p.locator('input[type=date]').fill('1906-12-09');
  await p.locator('input.font-mono').first().fill('US1234567');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.locator('input[type=checkbox]').check();
  await p.getByRole('button', { name: 'Submit Application' }).click();
  const citRef = (await p.locator('div.text-sm', { hasText: /^CIT-APP-/ }).innerText()).trim();
  check('citizenship application submitted', /^CIT-APP-/.test(citRef), citRef);
  await o.goto(`${base}/admin/citizenship`);
  await o.getByRole('button', { name: 'Grant Citizenship' }).first().click();
  await o.getByText(`${citRef} approved for Grace Hopper`).first().waitFor();
  await p.goto(`${base}/portal/identity`);
  await p.getByText('Your citizenship has been granted: swear the oath').waitFor();
  await p.getByLabel('Type your full name').fill('Grace Hopper');
  await p.getByLabel('I swear this oath freely and in good faith.').check();
  await p.getByRole('button', { name: 'Swear the oath' }).click();
  await p.getByText(/Passport: ALE-\d{6}/).first().waitFor();
  check('oath sworn in the portal; passport issued', true);
  await o.goto(`${base}/admin/citizens`);
  await o.getByRole('cell', { name: 'Grace Hopper' }).first().waitFor();
  check('new citizen in the registry', true);

  await p.goto(`${base}/portal/companies`);
  await p.getByRole('button', { name: 'Incorporate New Entity' }).click();
  await p.getByLabel('Company name').fill('Hopper Compilers');
  await p.getByLabel('Share capital (AEY)').fill('1000');
  await p.getByLabel('Beneficial owners and shares').fill('Grace Hopper (100%)');
  await p.getByLabel('Business purpose').fill('Compilers');
  await p.getByRole('button', { name: 'File with the Registrar' }).click();
  await p.getByText(/Registration # ALE-SARL-/).first().waitFor();
  check('company filed from the portal', true);
  await p.goto(`${base}/portal/settings`);
  await p.locator('input[type=text]').first().fill('Grace B. Hopper');
  await p.getByRole('button', { name: 'Save Profile Settings' }).click();
  await p.getByText('Profile and notification preferences successfully saved.').first().waitFor();
  await p.reload();
  check('profile change persists', (await p.locator('input[type=text]').first().inputValue()) === 'Grace B. Hopper');
  await p.getByRole('button', { name: /Sign Out|Log Out|Sign out/i }).first().click().catch(() => undefined);
  check('no console errors in the applicant browser', pErrors.length === 0, pErrors.join(' | '));
} catch (e) {
  check('flow completed', false, String(e).split('\n').slice(0, 6).join('\n'));
} finally {
  await browser.close();
  env.stop();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
