// Checks the outgoing-mail settings and sends one test message.
//   node --env-file=.env.mail.local scripts/mail/test.mjs you@example.org
// Reads SMTP_USER, SMTP_PASS and, if set, SMTP_HOST and SMTP_PORT. If the login fails on the
// configured host, tries Zoho's other servers and says which one accepts it, so SMTP_HOST can be
// set correctly on Vercel. Prints no secret.
import nodemailer from 'nodemailer';

const to = process.argv[2];
const { SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT, MAIL_FROM } = process.env;
if (!to || !SMTP_USER || !SMTP_PASS) {
  console.error('usage: SMTP_USER=… SMTP_PASS=… node scripts/mail/test.mjs <recipient>');
  process.exit(2);
}

const port = Number(SMTP_PORT || 465);
const hosts = [...new Set([SMTP_HOST || 'smtp.zoho.com', 'smtp.zoho.com', 'smtppro.zoho.com', 'smtp.zoho.eu', 'smtppro.zoho.eu', 'smtp.zoho.in', 'smtppro.zoho.in'])];

for (const host of hosts) {
  const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 15_000 });
  try {
    await t.verify();
  } catch (e) {
    console.log(`✗ ${host}: ${String(e.message).split('\n')[0].slice(0, 100)}`);
    continue;
  }
  console.log(`✓ ${host} accepts the login.`);
  const info = await t.sendMail({
    from: MAIL_FROM || `Sovereign Covenant State of Aletheia <${SMTP_USER}>`,
    to,
    subject: 'Aletheia: test message',
    text: 'This is a test message from the Aletheia websites. If you can read it, outgoing email works.',
  });
  console.log(`✓ Test message sent to ${to} (${info.messageId}).`);
  if (host !== (SMTP_HOST || 'smtp.zoho.com')) console.log(`\nSet SMTP_HOST=${host} on Vercel.`);
  process.exit(0);
}
console.error('\nNo Zoho server accepted the login. Check the password, or create an application-specific password in Zoho Mail (Settings → Security) if two-factor sign-in is on.');
process.exit(1);
