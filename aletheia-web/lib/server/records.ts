import 'server-only';
import { collection } from './db';
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

export const AUDIT_CATEGORIES = ['Citizenship', 'E-Residency', 'Border / E-Gate', 'Incorporation', 'Documents', 'Wallet', 'Security', 'Accounts'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export type AuditEvent = {
  at: string;
  category: AuditCategory;
  actor: string;
  actorId: string | null;
  action: string;
  subjectAccountId: string | null;
  outcome: 'success' | 'failure';
  hash: string;
};

export async function audit(e: Omit<AuditEvent, 'at' | 'hash' | 'outcome' | 'subjectAccountId'> & { outcome?: AuditEvent['outcome']; subjectAccountId?: string | null }): Promise<void> {
  const at = new Date().toISOString();
  const record = { at, outcome: e.outcome ?? 'success', subjectAccountId: e.subjectAccountId ?? null, category: e.category, actor: e.actor, actorId: e.actorId, action: e.action };
  try {
    await collection<AuditEvent>('audit_events').insertOne({ ...record, hash: sha256(JSON.stringify(record)) });
  } catch (err) {
    // The audit trail must not take a completed action down with it; the log keeps the gap visible.
    console.error('[audit] could not record event:', record.action, err);
  }
}

export type Notification = {
  accountId: string;
  title: string;
  message: string;
  category: 'Identity' | 'Corporate' | 'Financial';
  linkText: string | null;
  linkHref: string | null;
  unread: boolean;
  createdAt: string;
};

export async function notify(n: Omit<Notification, 'unread' | 'createdAt' | 'linkText' | 'linkHref'> & { linkText?: string; linkHref?: string }): Promise<void> {
  await collection<Notification>('notifications').insertOne({
    ...n,
    linkText: n.linkText ?? null,
    linkHref: n.linkHref ?? null,
    unread: true,
    createdAt: new Date().toISOString(),
  });
}
