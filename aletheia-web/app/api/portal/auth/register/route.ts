import { body, clientIp, fail, isEmail, json, rateLimit, route, str } from '@/lib/server/http';
import { passwordProblem } from '@/lib/server/crypto';
import { accountView, registerAccount } from '@/lib/server/accounts';
import { audit } from '@/lib/server/records';
import { createSession, setSessionCookie } from '@/lib/server/sessions';

export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 5, 60 * 60_000);
  const b = await body(req);
  const name = str(b, 'name', { max: 120, label: 'Full name' });
  const email = str(b, 'email', { max: 254, label: 'Email' });
  const passphrase = typeof b.passphrase === 'string' ? b.passphrase : '';
  if (!isEmail(email)) fail(400, 'Enter a valid email address.');
  const problem = passwordProblem(passphrase, email);
  if (problem) fail(400, problem);
  const account = await registerAccount({ name, email, password: passphrase });
  await audit({ category: 'Accounts', actor: name, actorId: account._id, subjectAccountId: account._id, action: `Portal account ${account.aletheiaId} registered` });
  const res = json({ account: accountView(account) }, 201);
  setSessionCookie(res, 'citizen', await createSession('citizen', account._id, req, 30));
  return res;
});
