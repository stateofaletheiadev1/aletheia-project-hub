import { fail, json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { notifications as notes } from '@/lib/server/records';

/** Marks one notification read. */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { account } = await requireAccount(req);
  const { id } = await params;
  const notifications = notes();
  const n = await notifications.findById(id);
  if (!n || n.accountId !== account._id) return fail(404, 'No such notification.');
  if (n.unread) await notifications.updateOne(n._id, n._rev, { $set: { unread: false } });
  return json({ ok: true });
});
