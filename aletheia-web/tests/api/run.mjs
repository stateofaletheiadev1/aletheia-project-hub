/**
 * End-to-end test of the portal and administration APIs against a real AletheiaDB.
 *
 *   npm run build && npm run test:api
 *
 * Covers sign-up, sign-in, applications, approvals, the citizen registry, companies, document
 * upload and review, notifications, the wallet, rescissions, border checks, settings,
 * officers, and the access rules between them.
 */
import { execFileSync } from 'node:child_process';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { AletheiaDB } from '@aletheia/aletheiadb';
import { start } from './harness.mjs';

const webDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
let failures = 0;
let passes = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }
  async req(method, url, data, { origin = this.base, raw = false, form } = {}) {
    const headers = { origin };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let body;
    if (form) body = form;
    else if (data !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(data);
    }
    const res = await fetch(this.base + url, { method, headers, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, v] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    if (raw) return res;
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { text };
    }
    return { status: res.status, ...json };
  }
  get = (u) => this.req('GET', u);
  post = (u, d) => this.req('POST', u, d ?? {});
  patch = (u, d) => this.req('PATCH', u, d ?? {});
  put = (u, d) => this.req('PUT', u, d ?? {});
}

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

const publicKeyHex = () => generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
const PASS = 'correct horse battery staple 42';

const env = await start();
try {
  const { base } = env;

  console.log('first administrator');
  const out = execFileSync(process.execPath, [path.join(webDir, 'scripts/db/officer-bootstrap.mjs'), 'registrar@stateofaletheia.org', 'Amara Okafor'], {
    env: { ...process.env, ALETHEIADB_URL: env.dbUrl, DATA_ENCRYPTION_MASTER_KEY: env.masterKey, BOOTSTRAP_PASSPHRASE: PASS },
    cwd: webDir,
  }).toString();
  const adminId = out.match(/(SEC-OFFICER-\d+)/)[1];
  check('bootstrap prints the officer id', adminId === 'SEC-OFFICER-0001', out);
  let again = '';
  try {
    execFileSync(process.execPath, [path.join(webDir, 'scripts/db/officer-bootstrap.mjs'), 'x@y.org', 'X'], { env: { ...process.env, ALETHEIADB_URL: env.dbUrl, DATA_ENCRYPTION_MASTER_KEY: env.masterKey, BOOTSTRAP_PASSPHRASE: PASS }, cwd: webDir, stdio: 'pipe' });
  } catch (e) {
    again = String(e.stderr);
  }
  check('bootstrap refuses a second time', again.includes('Refusing'));

  console.log('access rules');
  const anon = new Client(base);
  check('portal API needs a session', (await anon.get('/api/portal/me')).status === 401);
  check('admin API needs a session', (await anon.get('/api/admin/dashboard')).status === 401);
  check('cross-site write refused', (await anon.req('POST', '/api/portal/auth/login', { identifier: 'a', passphrase: 'b' }, { origin: 'https://evil.example' })).status === 403);

  console.log('portal sign-up and sign-in');
  const ada = new Client(base);
  check('weak passphrase refused', (await ada.post('/api/portal/auth/register', { name: 'Ada Lovelace', email: 'ada@example.org', passphrase: 'short' })).status === 400);
  let r = await ada.post('/api/portal/auth/register', { name: 'Ada Lovelace', email: 'ada@example.org', passphrase: PASS });
  check('register creates account', r.status === 201 && /^ALE-ID-\d{4}-\d{6}$/.test(r.account?.id), JSON.stringify(r));
  const adaId = r.account.id;
  check('registration signs in', (await ada.get('/api/portal/me')).account?.email === 'ada@example.org');
  check('duplicate email refused', (await new Client(base).post('/api/portal/auth/register', { name: 'X', email: 'ADA@example.org', passphrase: PASS })).status === 409);
  check('logout ends session', (await ada.post('/api/portal/auth/logout')).ok === true && (await ada.get('/api/portal/me')).status === 401);
  check('wrong passphrase refused', (await ada.post('/api/portal/auth/login', { identifier: adaId, passphrase: 'wrong passphrase!!' })).status === 401);
  r = await ada.post('/api/portal/auth/login', { identifier: adaId, passphrase: PASS });
  check('sign in with Aletheia ID', r.status === 200 && r.account.id === adaId);
  const ada2 = new Client(base);
  check('sign in with email', (await ada2.post('/api/portal/auth/login', { identifier: 'Ada@Example.org', passphrase: PASS })).status === 200);

  console.log('profile');
  r = await ada.patch('/api/portal/me', { name: 'Ada King', email: 'ada@example.org', notifyEmail: false, notifyLedger: true });
  check('profile update saved', r.account?.name === 'Ada King' && r.account.notifyEmail === false);
  check('profile update persisted', (await ada2.get('/api/portal/me')).account?.name === 'Ada King');
  check('email preferences re-enabled', (await ada.patch('/api/portal/me', { name: 'Ada King', email: 'ada@example.org', notifyEmail: true, notifyLedger: true })).account?.notifyEmail === true);

  console.log('e-residency application');
  check('company needs residency', (await ada.post('/api/portal/companies', { name: 'X Ltd', structure: 'SARL (Limited)', shareCapital: 1000, beneficialOwners: 'Ada (100%)', purpose: 'Software' })).status === 403);
  const appBody = { route: 'e-residency', nationality: 'GB', dob: '1990-12-10', passportNumber: 'gb1234567', purpose: 'business', intendedEntity: 'sarl', publicKey: publicKeyHex(), acceptedCovenant: true };
  check('bad public key refused', (await ada.post('/api/portal/applications', { ...appBody, publicKey: 'xyz' })).status === 400);
  check('covenant must be accepted', (await ada.post('/api/portal/applications', { ...appBody, acceptedCovenant: false })).status === 400);
  r = await ada.post('/api/portal/applications', appBody);
  check('application submitted', r.status === 201 && /^ERES-\d{4}-\d{6}$/.test(r.application?.reference), JSON.stringify(r));
  const eresAppId = r.application.id;
  check('second pending application refused', (await ada.post('/api/portal/applications', appBody)).status === 409);
  r = await ada.get('/api/portal/dashboard');
  check('dashboard shows pending application', r.applications?.length === 1 && r.applications[0].status === 'Pending' && r.unreadNotifications === 1);

  console.log('document upload');
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(400_000, 'a'), Buffer.from('\n%%EOF')]);
  let form = new FormData();
  form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'passport scan.pdf');
  form.set('docType', 'Biometric Passport Scan');
  r = await ada.req('POST', '/api/portal/documents', undefined, { form });
  check('upload stored (multi-chunk)', r.status === 201 && r.document?.status === 'Pending Review' && r.document.size === pdf.length, JSON.stringify(r).slice(0, 300));
  const docId = r.document.id;
  form = new FormData();
  form.set('file', new Blob([Buffer.from('not a pdf')], { type: 'application/pdf' }), 'fake.pdf');
  form.set('docType', 'Biometric Passport Scan');
  check('mismatched content refused', (await ada.req('POST', '/api/portal/documents', undefined, { form })).status === 415);
  const dl = await ada.req('GET', `/api/portal/documents/${docId}/file`, undefined, { raw: true });
  const dlBytes = Buffer.from(await dl.arrayBuffer());
  check('owner downloads identical file', dl.status === 200 && dlBytes.equals(pdf));

  console.log('officer sign-in');
  const off = new Client(base);
  check('wrong password refused', (await off.post('/api/admin/auth/login', { username: adminId, passphrase: 'wrong password!!' })).status === 401);
  r = await off.post('/api/admin/auth/login', { username: adminId, passphrase: PASS });
  check('officer signs in with username and password only', r.status === 200 && r.officer?.isAdministrator === true && r.officer.twoStep === false, JSON.stringify(r));
  check('email works as the username', (await new Client(base).post('/api/admin/auth/login', { username: 'Registrar@StateOfAletheia.org', passphrase: PASS })).status === 200);

  console.log('optional authenticator code');
  const setupTotp = await off.post('/api/admin/me/totp');
  check('code setup gives a key', /^[A-Z2-7]{32}$/.test(setupTotp.secret ?? ''), JSON.stringify(setupTotp));
  check('wrong confirmation refused', (await off.put('/api/admin/me/totp', { code: '000000' })).status === 400);
  r = await off.put('/api/admin/me/totp', { code: totp(setupTotp.secret) });
  check('code switched on', r.officer?.twoStep === true);
  const adminSecret = setupTotp.secret;
  r = await new Client(base).post('/api/admin/auth/login', { username: adminId, passphrase: PASS });
  check('sign-in now asks for the code', r.status === 401 && r.needsCode === true);
  check('wrong code refused', (await new Client(base).post('/api/admin/auth/login', { username: adminId, passphrase: PASS, code: '000000' })).status === 401);
  check('same code cannot be replayed', (await new Client(base).post('/api/admin/auth/login', { username: adminId, passphrase: PASS, code: totp(adminSecret) })).status === 401);
  check('next code signs in', (await new Client(base).post('/api/admin/auth/login', { username: adminId, passphrase: PASS, code: totp(adminSecret, Date.now() + 30_000) })).status === 200);
  check('switching off needs the password', (await off.req('DELETE', '/api/admin/me/totp', { passphrase: 'nope' })).status === 401);
  check('code switched off', (await off.req('DELETE', '/api/admin/me/totp', { passphrase: PASS })).officer?.twoStep === false);
  check('username and password work again', (await new Client(base).post('/api/admin/auth/login', { username: adminId, passphrase: PASS })).status === 200);
  check('citizen session does not open admin API', (await ada.get('/api/admin/dashboard')).status === 401);
  check('officer session does not open portal API', (await off.get('/api/portal/me')).status === 401);

  console.log('review');
  r = await off.get('/api/admin/dashboard');
  check('dashboard counts pending work', r.pending?.eResidency === 1 && r.pending.documents === 1 && r.queue?.length === 1, JSON.stringify(r).slice(0, 300));
  r = await off.get('/api/admin/applications?type=e-residency');
  check('e-residency queue lists application', r.applications?.length === 1 && r.applications[0].kycStatus === 'Pending Verification');
  check('officer downloads submitted file', (await off.req('GET', `/api/admin/documents/${docId}/file`, undefined, { raw: true })).status === 200);
  check('another citizen cannot download it', (await new Client(base).get(`/api/portal/documents/${docId}/file`)).status === 401);
  r = await off.post(`/api/admin/documents/${docId}/decision`, { decision: 'verify' });
  check('document verified', r.document?.status === 'Verified');
  check('KYC now verified', (await off.get('/api/admin/applications?type=e-residency')).applications[0].kycStatus === 'Verified');
  r = await off.post(`/api/admin/applications/${eresAppId}/decision`, { decision: 'approve' });
  check('application approved', r.application?.status === 'Approved');
  check('cannot decide twice', (await off.post(`/api/admin/applications/${eresAppId}/decision`, { decision: 'reject' })).status === 409);
  r = await ada.get('/api/portal/me');
  check('account is now e-resident with residency', r.account?.status === 'e-resident' && r.account.residency?.validUntil > new Date().toISOString());
  r = await ada.get('/api/portal/documents');
  check('certificate issued to vault', r.documents?.some((d) => d.kind === 'e-residence-certificate' && d.status === 'Verified'));

  console.log('companies');
  r = await ada.post('/api/portal/companies', { name: 'Lovelace Analytical Engines', structure: 'SARL (Limited)', shareCapital: 50000, beneficialOwners: 'Ada King (100%)', purpose: 'Computing' });
  check('company filed', r.status === 201 && /^ALE-SARL-\d{4}-\d{4}$/.test(r.company?.regNumber), JSON.stringify(r));
  const coId = r.company.id;
  check('changes need a note', (await off.post(`/api/admin/companies/${coId}/decision`, { decision: 'request-changes' })).status === 400);
  r = await off.post(`/api/admin/companies/${coId}/decision`, { decision: 'request-changes', note: 'Name the second director.' });
  check('changes requested', r.company?.status === 'Changes Requested');
  r = await ada.put(`/api/portal/companies/${coId}`, { name: 'Lovelace Analytical Engines', structure: 'SARL (Limited)', shareCapital: 50000, beneficialOwners: 'Ada King (60%), C. Babbage (40%)', purpose: 'Computing' });
  check('founder amends filing', r.company?.status === 'Pending Review');
  r = await off.post(`/api/admin/companies/${coId}/decision`, { decision: 'approve' });
  check('company chartered', r.company?.status === 'Active / Chartered');
  check('charter in vault', (await ada.get('/api/portal/documents')).documents.some((d) => d.kind === 'company-charter'));

  console.log('citizenship');
  r = await ada.post('/api/portal/applications', { ...appBody, route: 'naturalisation' });
  check('citizenship application submitted', r.status === 201 && r.application.type === 'citizenship');
  const citAppId = r.application.id;
  r = await off.post(`/api/admin/applications/${citAppId}/decision`, { decision: 'approve' });
  check('citizenship approved', r.application?.status === 'Approved');
  r = await ada.get('/api/portal/me');
  check('citizenship granted, oath pending', r.account?.status === 'e-resident' && /^ALE-NAT-/.test(r.account.oathPending?.nationalId) && r.account.passportNumber === null);
  check('registry shows oath pending', (await off.get('/api/admin/citizens')).citizens?.[0]?.status === 'Oath Pending');
  check('oath needs the exact name', (await ada.post('/api/portal/oath', { name: 'Someone Else', sworn: true })).status === 400);
  check('oath must be sworn', (await ada.post('/api/portal/oath', { name: 'Ada King' })).status === 400);
  r = await ada.post('/api/portal/oath', { name: '  ada   king ', sworn: true });
  check('oath sworn: citizen with national ID and passport', r.account?.status === 'citizen' && /^ALE-NAT-/.test(r.account.nationalId) && /^ALE-\d{6}$/.test(r.account.passportNumber), JSON.stringify(r).slice(0, 200));
  check('oath cannot be sworn twice', (await ada.post('/api/portal/oath', { name: 'Ada King', sworn: true })).status === 409);
  const { nationalId, passportNumber } = r.account;
  r = await off.get('/api/admin/citizens');
  check('citizen registry lists her', r.citizens?.length === 1 && r.citizens[0].nationalId === nationalId && r.citizens[0].status === 'Active' && r.citizens[0].name === 'Ada King');
  check('credential issued after oath', (await ada.get('/api/portal/documents')).documents.some((d) => d.kind === 'digital-credential'));

  console.log('border');
  r = await off.get(`/api/admin/immigration?passport=${passportNumber}`);
  check('passport lookup finds citizen', r.traveller?.status === 'CLEARED' && r.traveller.name === 'Ada King');
  check('unknown passport not found', (await off.get('/api/admin/immigration?passport=ZZ999')).traveller === null);
  check('crossing recorded', (await off.post('/api/admin/immigration', { passportNumber, decision: 'CLEARED' })).status === 201);
  check('crossing in history', (await off.get(`/api/admin/immigration?passport=${passportNumber}`)).traveller.history.length === 1);

  console.log('wallet');
  const bob = new Client(base);
  r = await bob.post('/api/portal/auth/register', { name: 'Bob Builder', email: 'bob@example.org', passphrase: PASS });
  const bobId = r.account.id;
  check('wallet starts empty', (await ada.get('/api/portal/wallet')).balance === 0);
  check('overdraft refused', (await ada.post('/api/portal/wallet/transfers', { recipient: bobId, amount: 10 })).status === 400);
  check('self-transfer refused', (await ada.post('/api/portal/wallet/transfers', { recipient: adaId, amount: 1 })).status === 400);
  check('unknown recipient', (await ada.post('/api/portal/wallet/transfers', { recipient: 'ALE-ID-2000-000000', amount: 1 })).status === 404);
  check('issuance needs a reason', (await off.post('/api/admin/treasury', { recipient: adaId, amount: 100, reason: '' })).status === 400);
  check('citizens cannot reach the treasury', (await ada.post('/api/admin/treasury', { recipient: adaId, amount: 100, reason: 'x' })).status === 401);
  r = await off.post('/api/admin/treasury', { recipient: adaId, amount: 100, reason: 'Founding grant for testing' });
  check('treasury issues AEY', r.status === 201 && /^ISS-/.test(r.issuance?.reference) && r.issuance.state === 'completed', JSON.stringify(r));
  r = await off.get('/api/admin/treasury');
  check('issuance listed with total', r.issuances?.length === 1 && r.total === 100 && r.issuances[0].recipient === adaId);
  r = await ada.get('/api/portal/wallet');
  check('issuance credited with entry', r.balance === 100 && r.transactions[0]?.description.startsWith('Issued by the Treasury'));
  check('fractional cents refused', (await ada.post('/api/portal/wallet/transfers', { recipient: bobId, amount: 1.234 })).status === 400);
  r = await ada.post('/api/portal/wallet/transfers', { recipient: bobId.toLowerCase(), amount: 25.5, memo: 'Gears' });
  check('transfer completes', r.status === 201 && r.transfer?.state === 'completed' && r.wallet?.balance === 74.5, JSON.stringify(r).slice(0, 300));
  r = await bob.get('/api/portal/wallet');
  check('recipient credited with entry', r.balance === 25.5 && r.transactions.length === 1 && r.transactions[0].type === 'Credit' && r.transactions[0].description.includes('Ada King') && r.transactions[0].description.includes('Gears'));
  r = await ada.get('/api/portal/wallet');
  check('sender has debit entry', r.transactions.length === 2 && r.transactions[0].type === 'Debit' && r.transactions[0].amount === 25.5 && r.transactions[0].description.includes('Bob Builder'));
  const results = await Promise.all([1, 2, 3, 4].map(() => ada.post('/api/portal/wallet/transfers', { recipient: bobId, amount: 30 })));
  r = await ada.get('/api/portal/wallet');
  check('concurrent transfers never overdraw', r.balance >= 0 && results.filter((x) => x.status === 201).length === 2 && Math.abs(r.balance - 14.5) < 1e-9, `${results.map((x) => x.status)} balance ${r.balance}`);

  console.log('rescission');
  r = await off.post('/api/admin/rescissions', { nationalId, basis: 'Voluntary Renunciation', stage: 'Hearing Scheduled', dossierRef: 'DOS-1' });
  check('proceeding opened', r.status === 201);
  const caseId = r.case.id;
  check('citizen under review', (await off.get('/api/admin/citizens')).citizens[0].status === 'Under Review');
  r = await off.post(`/api/admin/rescissions/${caseId}/decision`, { decision: 'dismiss' });
  check('proceeding dismissed, citizenship reaffirmed', r.case?.status === 'Dismissed' && (await off.get('/api/admin/citizens')).citizens[0].status === 'Active');

  console.log('notifications');
  r = await ada.get('/api/portal/notifications');
  const unread = r.notifications.filter((n) => n.unread).length;
  check('notifications delivered', r.notifications.length >= 6 && unread >= 6, String(r.notifications?.length));
  check('mark one read', (await ada.patch(`/api/portal/notifications/${r.notifications[0].id}`)).ok === true);
  await ada.patch('/api/portal/notifications');
  check('mark all read', (await ada.get('/api/portal/notifications')).notifications.every((n) => !n.unread));
  check('cannot touch others’ notifications', (await bob.patch(`/api/portal/notifications/${r.notifications[0].id}`)).status === 404);

  console.log('settings and officers');
  check('timeout validated', (await off.patch('/api/admin/settings', { sessionTimeoutMinutes: 2 })).status === 400);
  check('timeout saved', (await off.patch('/api/admin/settings', { sessionTimeoutMinutes: 15 })).settings?.sessionTimeoutMinutes === 15);
  r = await off.post('/api/admin/officers', { name: 'Kofi Mensah', email: 'kofi@stateofaletheia.org', role: 'officer', temporaryPassphrase: 'temporary passphrase 77' });
  check('officer created', r.status === 201 && r.officer?.id === 'SEC-OFFICER-0002');
  const kofi = new Client(base);
  check('new officer signs in', (await kofi.post('/api/admin/auth/login', { username: 'SEC-OFFICER-0002', passphrase: 'temporary passphrase 77' })).status === 200);
  check('non-administrator cannot change settings', (await kofi.patch('/api/admin/settings', { sessionTimeoutMinutes: 60 })).status === 403);
  check('non-administrator cannot create officers', (await kofi.post('/api/admin/officers', {})).status === 403);
  check('non-administrator cannot issue AEY', (await kofi.post('/api/admin/treasury', { recipient: adaId, amount: 1, reason: 'not allowed' })).status === 403);
  check('administrator cannot disable self', (await off.patch(`/api/admin/officers/${adminId}`, { disabled: true })).status === 400);
  check('non-administrator cannot disable officers', (await kofi.patch(`/api/admin/officers/${adminId}`, { disabled: true })).status === 403);
  r = await kofi.post('/api/admin/rescissions', { nationalId, basis: 'Fraudulent Acquisition', stage: 'Evidence Review', dossierRef: 'DOS-2' });
  check('non-administrator cannot rescind', (await kofi.post(`/api/admin/rescissions/${r.case.id}/decision`, { decision: 'rescind' })).status === 403);
  r = await off.post(`/api/admin/rescissions/${r.case.id}/decision`, { decision: 'rescind' });
  check('administrator rescinds', r.case?.status === 'Rescinded');
  check('account back to e-resident', (await ada.get('/api/portal/me')).account.status === 'e-resident');
  r = await off.patch('/api/admin/officers/SEC-OFFICER-0002', { disabled: true });
  check('administrator disables an officer', r.officer?.disabled === true);
  check('disabled officer is signed out at once', (await kofi.get('/api/admin/me')).status === 401);
  check('disabled officer cannot sign in', (await new Client(base).post('/api/admin/auth/login', { username: 'SEC-OFFICER-0002', passphrase: 'temporary passphrase 77' })).status === 403);
  check('officer re-enabled', (await off.patch('/api/admin/officers/SEC-OFFICER-0002', { disabled: false })).officer?.disabled === false);

  console.log('passphrase change');
  check('wrong current refused', (await ada.post('/api/portal/me/passphrase', { current: 'nope nope nope', next: 'another long passphrase 9' })).status === 401);
  check('passphrase changed', (await ada.post('/api/portal/me/passphrase', { current: PASS, next: 'another long passphrase 9' })).ok === true);
  check('other sessions signed out', (await ada2.get('/api/portal/me')).status === 401);
  check('this session kept', (await ada.get('/api/portal/me')).status === 200);
  check('new passphrase works', (await new Client(base).post('/api/portal/auth/login', { identifier: adaId, passphrase: 'another long passphrase 9' })).status === 200);

  console.log('activity and security');
  r = await off.get('/api/admin/activity');
  check('audit trail recorded', r.events?.length > 15 && r.events.every((e) => /^[0-9a-f]{64}$/.test(e.hash) || e.actor === 'bootstrap'));
  check('category filter', (await off.get('/api/admin/activity?category=Incorporation')).events.every((e) => e.category === 'Incorporation'));
  r = await off.get('/api/admin/security');
  check('security metrics include failed sign-ins', r.metrics?.failedSignIns24h >= 2 && r.metrics.officers === 2, JSON.stringify(r.metrics));

  console.log('identity key rotation');
  const newKey = publicKeyHex();
  r = await ada.post('/api/portal/identity/key', { publicKey: newKey });
  check('key rotated', r.account?.publicKey === newKey && r.account.keyRotatedAt);

  console.log('audit paging');
  r = await off.get('/api/admin/activity');
  const fifth = r.events[4];
  const older = await off.get(`/api/admin/activity?before=${encodeURIComponent(fifth.timestamp)}`);
  check('activity pages by cursor', older.events.length === r.events.length - 5 && older.events.every((e) => e.timestamp < fifth.timestamp), `${older.events.length} vs ${r.events.length}`);
  check('audit trail names no people', r.events.every((e) => !/Ada|Bob|Kofi|Amara/.test(e.action + e.actor)));

  console.log('encryption at rest');
  const raw = AletheiaDB.connect(env.dbUrl).db();
  const dump = async (c) => JSON.stringify((await raw.collection(c).find({}, { limit: 1000 })).documents);
  const everything = (await Promise.all(['accounts', 'officers', 'applications', 'citizens', 'documents', 'companies', 'notifications', 'wallet_entries', 'wallet_transfers', 'audit_events', 'outbox', 'border_crossings', 'rescissions'].map(dump))).join('\n');
  check('no names in the database', !/Ada King|Bob Builder|Kofi Mensah|Amara Okafor/.test(everything));
  check('no emails in the database', !/ada@example\.org|bob@example\.org|kofi@stateofaletheia/.test(everything));
  check('no foreign passport or birth date in the database', !/GB1234567|1990-12-10/.test(everything));
  const chunks = await dump('file_chunks');
  check('uploaded files are encrypted', chunks.length > 0 && !chunks.includes(Buffer.alloc(300, 'a').toString('base64').slice(0, 200)));

  console.log('email');
  const until = Date.now() + 10_000;
  while (Date.now() < until && !env.mails.some((m) => m.raw.includes('E-Residency granted'))) await new Promise((res) => setTimeout(res, 200));
  const toAda = env.mails.filter((m) => m.to.includes('ada@example.org'));
  check('decisions are emailed', toAda.some((m) => m.raw.includes('E-Residency granted')) && toAda.some((m) => m.raw.includes('Citizenship granted')), `${env.mails.length} mails`);

  console.log('erasure');
  const erase = execFileSync(process.execPath, [path.join(webDir, 'scripts/db/erase-person.mjs'), bobId, '--yes'], { env: { ...process.env, ALETHEIADB_URL: env.dbUrl }, cwd: webDir }).toString();
  check('erasure shreds the key', erase.includes('shredded'), erase);
  check('erased person is signed out', (await bob.get('/api/portal/me')).status === 401);
  check('erased person cannot sign in', [401, 403].includes((await new Client(base).post('/api/portal/auth/login', { identifier: bobId, passphrase: PASS })).status));
  const bobDoc = await raw.collection('accounts').findOne({ aletheiaId: bobId });
  check('erased data key is gone', (await raw.collection('subject_keys').count({ subject: bobDoc.subject })) === 0);
  r = await ada.get('/api/portal/wallet');
  check('other wallets keep their own records', r.transactions.length >= 2);

  console.log('lockout');
  const carolId = (await new Client(base).post('/api/portal/auth/register', { name: 'Carol Danvers', email: 'carol@example.org', passphrase: PASS })).account.id;
  const mallory = new Client(base);
  let last;
  for (let i = 0; i < 10; i++) last = await mallory.post('/api/portal/auth/login', { identifier: carolId, passphrase: `guess number ${i}` });
  check('sign-in rate limited or account locked', last.status === 429 || last.status === 401);
  const locked = await mallory.post('/api/portal/auth/login', { identifier: carolId, passphrase: PASS });
  check('locked account refuses even the right passphrase', locked.status === 423 || locked.status === 429, String(locked.status));
} finally {
  env.stop();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
