import { body, clientIp, json, rateLimit, route, str } from '@/lib/server/http';
import { accountView, checkAccountCredentials } from '@/lib/server/accounts';
import { createSession, setSessionCookie } from '@/lib/server/sessions';

export const POST = route(async (req) => {
  rateLimit(`portal-login:${clientIp(req)}`, 10, 60_000);
  const b = await body(req);
  const identifier = str(b, 'identifier', { max: 254, label: 'Aletheia ID or email' });
  const passphrase = typeof b.passphrase === 'string' ? b.passphrase.slice(0, 200) : '';
  const account = await checkAccountCredentials(identifier, passphrase);
  const res = json({ account: await accountView(account) });
  setSessionCookie(res, 'citizen', await createSession('citizen', account._id, req, 30));
  return res;
});
