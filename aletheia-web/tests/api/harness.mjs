/**
 * Starts a throwaway AletheiaDB and the built web app wired to it, for tests.
 *
 *   ALETHEIADB_BIN=../aletheia-db/target/release/aletheiadb (default)
 *
 * Also starts a local mail server that keeps every message it receives (`mails`).
 * Returns { base, dbUrl, adminUrl, masterKey, mails, stop() }. Needs `npm run build` first.
 */
import { spawn, execFileSync } from 'node:child_process';
import { SMTPServer } from 'smtp-server';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const webDir = path.resolve(here, '../..');

async function waitFor(url, ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${url}`);
}

export async function start({ dbPort = 7799, webPort = 3199, smtpPort = 2599, env: extraEnv = {} } = {}) {
  const bin = process.env.ALETHEIADB_BIN ?? path.resolve(webDir, '../aletheia-db/target/release/aletheiadb');
  if (!fs.existsSync(bin)) throw new Error(`AletheiaDB binary not found at ${bin}: build it with \`cargo build --release\` in aletheia-db, or set ALETHEIADB_BIN`);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aletheiadb-test-'));
  const rootSecret = randomBytes(24).toString('hex');
  const masterKey = randomBytes(32).toString('base64');
  const children = [];

  const mails = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS', 'AUTH'],
    logger: false,
    onData(stream, session, done) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        mails.push({ to: session.envelope.rcptTo.map((r) => r.address), raw: Buffer.concat(chunks).toString('utf8') });
        done();
      });
    },
  });
  await new Promise((r) => smtp.listen(smtpPort, '127.0.0.1', r));

  const db = spawn(bin, ['serve'], {
    env: { ...process.env, ALETHEIADB_LISTEN: `127.0.0.1:${dbPort}`, ALETHEIADB_DATA_DIR: dataDir, ALETHEIADB_ROOT_KEY_SHA256: createHash('sha256').update(rootSecret).digest('hex'), RUST_LOG: 'warn' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  children.push(db);
  let dbExited = false;
  db.on('exit', () => (dbExited = true));
  const dbBase = `http://127.0.0.1:${dbPort}`;
  await waitFor(`${dbBase}/health`);
  await new Promise((r) => setTimeout(r, 200));
  if (dbExited) throw new Error(`AletheiaDB exited at start: is port ${dbPort} already in use?`);

  const root = { authorization: `Bearer root.${rootSecret}`, 'content-type': 'application/json' };
  let r = await fetch(`${dbBase}/v1/databases/web`, { method: 'PUT', headers: root });
  if (!r.ok) throw new Error(`create database: ${r.status} ${await r.text()}`);
  const key = async (role) => {
    const res = await fetch(`${dbBase}/v1/keys`, { method: 'POST', headers: root, body: JSON.stringify({ name: `test-${role}`, database: 'web', role }) });
    if (!res.ok) throw new Error(`create key: ${res.status} ${await res.text()}`);
    const { key: k } = await res.json();
    const [id, secret] = [k.slice(0, k.indexOf('.')), k.slice(k.indexOf('.') + 1)];
    return `aletheiadb://${id}:${secret}@localhost:${dbPort}/web?tls=false`;
  };
  const adminUrl = await key('admin');
  const dbUrl = await key('readWrite');

  execFileSync(process.execPath, [path.join(webDir, 'scripts/db/bootstrap.mjs')], { env: { ...process.env, ALETHEIADB_ADMIN_URL: adminUrl }, stdio: 'ignore', cwd: webDir });
  // Leave any previously set mail settings out of the test run.
  const env = { ...process.env };
  delete env.SMTP_URL;
  delete env.MAIL_FROM;

  const web = spawn(process.execPath, [path.join(webDir, 'node_modules/next/dist/bin/next'), 'start', '-p', String(webPort)], {
    env: { ...env, ALETHEIADB_URL: dbUrl, DATA_ENCRYPTION_MASTER_KEY: masterKey, SMTP_URL: `smtp://127.0.0.1:${smtpPort}`, NODE_ENV: 'production', PORT: String(webPort), ...extraEnv },
    stdio: ['ignore', 'ignore', 'inherit'],
    cwd: webDir,
  });
  children.push(web);
  const base = `http://localhost:${webPort}`;
  await waitFor(`${base}/api/chain`);

  return {
    base,
    dbUrl,
    adminUrl,
    masterKey,
    mails,
    stop() {
      for (const c of children) c.kill('SIGTERM');
      smtp.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
