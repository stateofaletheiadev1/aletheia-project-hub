import { json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { collection } from '@/lib/server/db';
import type { Notification } from '@/lib/server/records';

const notifications = () => collection<Notification>('notifications');

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  const { documents } = await notifications().find({ accountId: account._id }, { sort: { createdAt: -1 }, limit: 100 });
  return json({
    notifications: documents.map((n) => ({ id: n._id, title: n.title, message: n.message, category: n.category, timestamp: n.createdAt, unread: n.unread, linkText: n.linkText, linkHref: n.linkHref })),
  });
});

/** Marks every notification read. */
export const PATCH = route(async (req) => {
  const { account } = await requireAccount(req);
  const { documents } = await notifications().find({ accountId: account._id, unread: true }, { limit: 1000 });
  await Promise.all(documents.map((n) => notifications().updateOne(n._id, n._rev, { $set: { unread: false } }).catch(() => undefined)));
  return json({ ok: true, updated: documents.length });
});
