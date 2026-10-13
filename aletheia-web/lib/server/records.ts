import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { ERASED, openFields, sealFields, type Sealed } from './envelope';
import { enqueueEmail } from './mail';
import { sha256 } from './crypto';
import { retryOnConflict } from './http';

// Sequences, the audit trail and notifications: small records every service writes.

type Counter = { name: string; value: number };

/** The next number in a named sequence (1, 2, 3 …), safe under concurrent requests. */
export async function nextNumber(name: string): Promise<number> {
  const counters = collection<Counter>('counters');
  return retryOnConflict(async () => {
    const c = await counters.findOne({ name });
    if (!c) {
      // A concurrent first insert loses on the unique index and retries through the update path.
      await counters.insertOne({ name, value: 1 });
      return 1;
    }
    const updated = await counters.updateOne(c._id, c._rev, { $inc: { value: 1 } });
    return updated.value;
  }, 10);
}

/** "PREFIX-2026-000042" from a per-year sequence. */
export async function nextReference(prefix: string, width = 6): Promise<string> {
  const year = new Date().getUTCFullYear();
  const n = await nextNumber(`${prefix}-${year}`);
  return `${prefix}-${year}-${String(n).padStart(width, '0')}`;
}

export const AUDIT_CATEGORIES = ['Citizenship', 'E-Residency', 'Border / E-Gate', 'Incorporation', 'Documents', 'Wallet', 'Treasury', 'Security', 'Accounts'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

// The audit trail names people by their State identifiers (Aletheia ID, officer ID, national
// ID, references), never by name, so it holds no personal data in clear. `day` (YYYY-MM-DD,
// UTC) is indexed: lists read day by day instead of scanning the whole trail.
export type AuditEvent = {
  at: string;
  day: string;
  category: AuditCategory;
  actor: string;
  actorId: string | null;
  action: string;
  subjectAccountId: string | null;
  outcome: 'success' | 'failure';
  hash: string;
};

export const auditEvents = () => collection<AuditEvent>('audit_events');

export async function audit(e: Omit<AuditEvent, 'at' | 'day' | 'hash' | 'outcome' | 'subjectAccountId'> & { outcome?: AuditEvent['outcome']; subjectAccountId?: string | null }): Promise<void> {
  const at = new Date().toISOString();
  const record = { at, day: at.slice(0, 10), outcome: e.outcome ?? 'success', subjectAccountId: e.subjectAccountId ?? null, category: e.category, actor: e.actor, actorId: e.actorId, action: e.action };
  try {
    await auditEvents().insertOne({ ...record, hash: sha256(JSON.stringify(record)) });
  } catch (err) {
    // The audit trail must not take a completed action down with it; the log keeps the gap visible.
    console.error('[audit] could not record event:', record.action, err);
  }
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * The newest audit events matching `filter`, newest first, older than `before` (a timestamp
 * cursor from a previous page). Reads a week of days at a time through the `day` index, at
 * most `maxDays` back. `next` is the cursor for the following page, or null at the end.
 */
export async function recentAudit(filter: Record<string, unknown>, opts: { limit?: number; before?: string | null; maxDays?: number } = {}) {
  const limit = opts.limit ?? 100;
  const maxDays = opts.maxDays ?? 366;
  const cursor = opts.before && !Number.isNaN(Date.parse(opts.before)) ? new Date(opts.before).toISOString() : null;
  const start = cursor ? Date.parse(cursor) : Date.now();
  const found: Doc<AuditEvent>[] = [];
  for (let read = 0; found.length < limit && read < maxDays; read += 7) {
    const days = Array.from({ length: Math.min(7, maxDays - read) }, (_, i) => dayOf(start - (read + i) * 86_400_000));
    const { documents } = await auditEvents().find({ ...filter, day: { $in: days }, ...(cursor ? { at: { $lt: cursor } } : {}) }, { sort: { at: -1 }, limit: limit - found.length });
    found.push(...documents);
  }
  return { events: found, next: found.length >= limit ? found.at(-1)!.at : null };
}

// ---------------------------------------------------------------- notifications

// Title and message are personal (they name decisions about a person), so they are sealed
// under the person's key. When the person wants email, a copy goes to the outbox (mail.ts).
export type Notification = {
  accountId: string;
  sealed: Sealed;
  category: 'Identity' | 'Corporate' | 'Financial';
  linkText: string | null;
  linkHref: string | null;
  unread: boolean;
  createdAt: string;
};

export const notifications = () => collection<Notification>('notifications');
const NOTE = 'notifications';

export async function notify(n: { accountId: string; title: string; message: string; category: Notification['category']; linkText?: string; linkHref?: string }): Promise<void> {
  const account = await collection<{ subject: string; notifyEmail: boolean; notifyLedger: boolean }>('accounts').findById(n.accountId);
  if (!account) return;
  await notifications().insertOne({
    accountId: n.accountId,
    sealed: await sealFields(account.subject, { title: n.title, message: n.message }, NOTE),
    category: n.category,
    linkText: n.linkText ?? null,
    linkHref: n.linkHref ?? null,
    unread: true,
    createdAt: new Date().toISOString(),
  });
  const wantsEmail = n.category === 'Financial' ? account.notifyEmail && account.notifyLedger : account.notifyEmail;
  if (wantsEmail) await enqueueEmail(n.accountId, account.subject, n.title, n.message, n.linkHref ?? null);
}

export async function notificationView(n: Doc<Notification>, subject: string) {
  const { title, message } = await openFields(subject, n.sealed, NOTE, { title: ERASED, message: '' });
  return { id: n._id, title, message, category: n.category, timestamp: n.createdAt, unread: n.unread, linkText: n.linkText, linkHref: n.linkHref };
}
