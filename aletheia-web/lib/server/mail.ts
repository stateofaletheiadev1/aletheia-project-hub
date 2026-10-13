import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { collection } from './db';
import { openFields, sealFields, type Sealed } from './envelope';

// Email copies of portal notifications. A message is written to the outbox first (sealed
// under the person's key, like the notification itself) and sent from there, so a failed
// send is retried instead of lost. Sending is on when SMTP_URL is set, e.g.
//   SMTP_URL=smtps://user:password@smtp.example.org:465   MAIL_FROM="Aletheia <no-reply@stateofaletheia.org>"
// Without SMTP_URL messages wait in the outbox and are sent once it is configured.

type Outbox = {
  accountId: string;
  subject: string;
  sealed: Sealed;
  state: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};

const MAX_ATTEMPTS = 5;
const outbox = () => collection<Outbox>('outbox');

let transport: Transporter | null | undefined;
function transporter(): Transporter | null {
  if (transport === undefined) transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export async function enqueueEmail(accountId: string, subject: string, title: string, message: string, linkHref: string | null): Promise<void> {
  await outbox().insertOne({
    accountId,
    subject,
    sealed: await sealFields(subject, { title, message, linkHref }, 'outbox'),
    state: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    sentAt: null,
  });
  void flushOutbox().catch((e) => console.error('[mail] flush failed:', e));
}

let flushing: Promise<number> | null = null;

/** Sends what is waiting in the outbox. Returns how many were sent. */
export function flushOutbox(): Promise<number> {
  return (flushing ??= send().finally(() => (flushing = null)));
}

async function send(): Promise<number> {
  const t = transporter();
  if (!t) return 0;
  const site = (process.env.PUBLIC_SITE_URL ?? 'https://stateofaletheia.org').replace(/\/+$/, '');
  const from = process.env.MAIL_FROM ?? 'Sovereign Covenant State of Aletheia <no-reply@stateofaletheia.org>';
  const { documents } = await outbox().find({ state: 'pending' }, { sort: { createdAt: 1 }, limit: 25 });
  let sent = 0;
  for (const m of documents) {
    let claimed;
    try {
      claimed = await outbox().updateOne(m._id, m._rev, { $set: { state: 'sending' } }); // one sender per message
    } catch {
      continue;
    }
    try {
      const account = await collection<{ subject: string; pii: Sealed }>('accounts').findById(m.accountId);
      const to = account ? (await openFields(account.subject, account.pii, 'accounts', { email: '' } as { email: string })).email : '';
      const body = await openFields(m.subject, m.sealed, 'outbox', { title: '', message: '', linkHref: null as string | null });
      if (!to || !body.title) {
        await outbox().updateOne(claimed._id, claimed._rev, { $set: { state: 'failed', lastError: 'recipient erased' } });
        continue;
      }
      await t.sendMail({
        from,
        to,
        subject: body.title,
        text: `${body.message}\n\n${body.linkHref ? `${site}${body.linkHref}\n\n` : ''}Sovereign Covenant State of Aletheia — Citizen Portal\nYou can turn these emails off in Profile Settings.`,
      });
      await outbox().updateOne(claimed._id, claimed._rev, { $set: { state: 'sent', sentAt: new Date().toISOString(), lastError: null } });
      sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await outbox()
        .updateOne(claimed._id, claimed._rev, { $set: { state: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts, lastError: String(e).slice(0, 300) } })
        .catch(() => undefined);
    }
  }
  return sent;
}
