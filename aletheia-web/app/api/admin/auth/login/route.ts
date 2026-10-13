import { body, clientIp, json, rateLimit, route, str } from '@/lib/server/http';
import { checkOfficerCredentials, getSettings, officerView } from '@/lib/server/officers';
import { audit } from '@/lib/server/records';
import { createSession, setSessionCookie } from '@/lib/server/sessions';

export const POST = route(async (req) => {
  rateLimit(`officer-login:${clientIp(req)}`, 10, 60_000);
  const b = await body(req);
  const officerId = str(b, 'officerId', { max: 40, label: 'Officer ID' });
  const passphrase = typeof b.passphrase === 'string' ? b.passphrase.slice(0, 200) : '';
  const code = typeof b.code === 'string' ? b.code.replace(/\s/g, '') : '';
  const officer = await checkOfficerCredentials(officerId, passphrase, code);
  const { sessionTimeoutMinutes } = await getSettings();
  await audit({ category: 'Security', actor: officer.officerId, actorId: officer._id, action: `Officer ${officer.officerId} signed in` });
  const res = json({ officer: await officerView(officer) });
  setSessionCookie(res, 'officer', await createSession('officer', officer._id, req, sessionTimeoutMinutes));
  return res;
});
