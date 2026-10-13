import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { body, clientIp, json, rateLimit, route } from '@/lib/server/http';
import { accountView } from '@/lib/server/accounts';
import { login, loginOptions } from '@/lib/server/passkeys';
import { createSession, setSessionCookie } from '@/lib/server/sessions';

/** Step 1: options for navigator.credentials.get() (any passkey registered with the portal). */
export const GET = route(async (req) => {
  rateLimit(`passkey-options:${clientIp(req)}`, 30, 60_000);
  return json({ options: await loginOptions(req) });
});

/** Step 2: the signed response; signs in. */
export const POST = route(async (req) => {
  rateLimit(`portal-login:${clientIp(req)}`, 10, 60_000);
  const { response } = await body<{ response: AuthenticationResponseJSON }>(req, 16 * 1024);
  const account = await login(req, response);
  const res = json({ account: await accountView(account) });
  setSessionCookie(res, 'citizen', await createSession('citizen', account._id, req, 30));
  return res;
});
