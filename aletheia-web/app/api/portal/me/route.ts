import { ConflictError } from '@aletheia/aletheiadb';
import { body, fail, isEmail, json, retryOnConflict, route, str } from '@/lib/server/http';
import { accounts, accountView, requireAccount } from '@/lib/server/accounts';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json({ account: accountView(account) });
});

export const PATCH = route(async (req) => {
  const { account } = await requireAccount(req);
  const b = await body(req);
  const name = str(b, 'name', { max: 120, label: 'Full name' });
  const email = str(b, 'email', { max: 254, label: 'Email' }).toLowerCase();
  if (!isEmail(email)) fail(400, 'Enter a valid email address.');
  if (typeof b.notifyEmail !== 'boolean' || typeof b.notifyLedger !== 'boolean') fail(400, 'Notification preferences must be true or false.');
  if (email !== account.email && (await accounts().findOne({ email }))) fail(409, 'Another account already uses this email.');
  try {
    const updated = await retryOnConflict(async () => {
      const a = (await accounts().findById(account._id))!;
      return accounts().updateOne(a._id, a._rev, { $set: { name, email, notifyEmail: b.notifyEmail, notifyLedger: b.notifyLedger } });
    });
    return json({ account: accountView(updated) });
  } catch (e) {
    // The unique index on email refuses an address another account uses.
    if (e instanceof ConflictError) fail(409, 'Another account already uses this email.');
    throw e;
  }
});
