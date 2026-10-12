import { body, clientIp, fail, json, rateLimit, retryOnConflict, route } from '@/lib/server/http';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/crypto';
import { officers, requireOfficer } from '@/lib/server/officers';
import { audit } from '@/lib/server/records';
import { endAllSessions } from '@/lib/server/sessions';

export const POST = route(async (req) => {
  const { officer, sessionId } = await requireOfficer(req);
  rateLimit(`officer-pass:${clientIp(req)}`, 10, 60_000);
  const b = await body(req);
  const current = typeof b.current === 'string' ? b.current : '';
  const next = typeof b.next === 'string' ? b.next : '';
  if (!(await verifyPassword(officer.passwordHash, current))) fail(401, 'Your current passphrase is not correct.');
  const problem = passwordProblem(next, officer.email);
  if (problem) fail(400, problem);
  const passwordHash = await hashPassword(next);
  await retryOnConflict(async () => {
    const o = (await officers().findById(officer._id))!;
    await officers().updateOne(o._id, o._rev, { $set: { passwordHash } });
  });
  await endAllSessions(officer._id, sessionId);
  await audit({ category: 'Security', actor: officer.name, actorId: officer._id, action: 'Officer passphrase changed' });
  return json({ ok: true });
});
