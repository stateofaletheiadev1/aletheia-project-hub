import { body, json, route, str } from '@/lib/server/http';
import { accountView, requireAccount } from '@/lib/server/accounts';
import { OATH_TEXT, takeOath } from '@/lib/server/registry';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json({ oath: OATH_TEXT, pending: account.oathPending });
});

/** The citizen swears the oath by typing their full name. */
export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  const b = await body(req);
  if (b.sworn !== true) return json({ error: 'You must swear the oath to continue.' }, 400);
  const updated = await takeOath(account, str(b, 'name', { max: 120, label: 'Full name' }));
  return json({ account: await accountView(updated) });
});
