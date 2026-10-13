import { body, clientIp, json, rateLimit, route, str } from '@/lib/server/http';
import { checkOfficerCredentials, CodeRequired, getSettings, officerView } from '@/lib/server/officers';
import { audit } from '@/lib/server/records';
import { createSession, setSessionCookie } from '@/lib/server/sessions';

/** Username (officer ID or email) and passphrase; plus the 6-digit code for officers who switched it on. */
export const POST = route(async (req) => {
  rateLimit(`officer-login:${clientIp(req)}`, 10, 60_000);
  const b = await body(req);
  const username = str(b, typeof b.username === 'string' ? 'username' : 'officerId', { max: 254, label: 'Username' });
  const passphrase = typeof b.passphrase === 'string' ? b.passphrase.slice(0, 200) : '';
  const code = typeof b.code === 'string' ? b.code.replace(/\s/g, '') : '';
  let officer;
  try {
    officer = await checkOfficerCredentials(username, passphrase, code);
  } catch (e) {
    if (e instanceof CodeRequired) return json({ error: 'Enter the 6-digit code from your authenticator app.', needsCode: true }, 401);
    throw e;
  }
  const { sessionTimeoutMinutes } = await getSettings();
  await audit({ category: 'Security', actor: officer.officerId, actorId: officer._id, action: `Officer ${officer.officerId} signed in` });
  const res = json({ officer: await officerView(officer) });
  setSessionCookie(res, 'officer', await createSession('officer', officer._id, req, sessionTimeoutMinutes));
  return res;
});
