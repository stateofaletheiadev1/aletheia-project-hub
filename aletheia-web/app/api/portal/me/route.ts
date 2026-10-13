import { ConflictError } from '@aletheia/aletheiadb';
import { body, fail, isEmail, json, route, str } from '@/lib/server/http';
import { accountPii, accounts, accountView, emailIndex, requireAccount, updateAccountPii } from '@/lib/server/accounts';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json({ account: await accountView(account) });
});

export const PATCH = route(async (req) => {
  const { account } = await requireAccount(req);
  const b = await body(req);
  const name = str(b, 'name', { max: 120, label: 'Full name' });
  const email = str(b, 'email', { max: 254, label: 'Email' }).toLowerCase();
  if (!isEmail(email)) fail(400, 'Enter a valid email address.');
  if (typeof b.notifyEmail !== 'boolean' || typeof b.notifyLedger !== 'boolean') fail(400, 'Notification preferences must be true or false.');
  const index = emailIndex(email);
  const changed = email !== (await accountPii(account)).email;
  if (changed && (await accounts().findOne({ emailIndex: index }))) fail(409, 'Another account already uses this email.');
  try {
    const updated = await updateAccountPii(account._id, { name, email }, { emailIndex: index, notifyEmail: b.notifyEmail, notifyLedger: b.notifyLedger });
    return json({ account: await accountView(updated) });
  } catch (e) {
    // The unique index on the email's blind index refuses an address another account uses.
    if (e instanceof ConflictError) fail(409, 'Another account already uses this email.');
    throw e;
  }
});
