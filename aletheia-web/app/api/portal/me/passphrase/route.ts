import { body, clientIp, fail, json, rateLimit, retryOnConflict, route } from '@/lib/server/http';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/crypto';
import { accountPii, accounts, requireAccount } from '@/lib/server/accounts';
import { audit } from '@/lib/server/records';
import { endAllSessions } from '@/lib/server/sessions';

export const POST = route(async (req) => {
  const { account, sessionId } = await requireAccount(req);
  rateLimit(`portal-pass:${clientIp(req)}`, 10, 60_000);
  const b = await body(req);
  const current = typeof b.current === 'string' ? b.current : '';
  const next = typeof b.next === 'string' ? b.next : '';
  if (!(await verifyPassword(account.passwordHash, current))) fail(401, 'Your current passphrase is not correct.');
  const problem = passwordProblem(next, (await accountPii(account)).email);
  if (problem) fail(400, problem);
  const passwordHash = await hashPassword(next);
  await retryOnConflict(async () => {
    const a = (await accounts().findById(account._id))!;
    await accounts().updateOne(a._id, a._rev, { $set: { passwordHash } });
  });
  // Every other signed-in device is signed out.
  await endAllSessions(account._id, sessionId);
  await audit({ category: 'Security', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: 'Portal passphrase changed' });
  return json({ ok: true });
});
