import { body, fail, json, retryOnConflict, route, str } from '@/lib/server/http';
import { accounts, accountView, requireAccount } from '@/lib/server/accounts';
import { audit } from '@/lib/server/records';

/** Registers a new public key (key rotation). The private key never leaves the person's device. */
export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  const publicKey = str(await body(req), 'publicKey', { max: 64, label: 'Public key' }).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(publicKey)) fail(400, 'The public key must be 64 hexadecimal characters (an Ed25519 key).');
  const updated = await retryOnConflict(async () => {
    const a = (await accounts().findById(account._id))!;
    return accounts().updateOne(a._id, a._rev, { $set: { publicKey, keyRotatedAt: new Date().toISOString() } });
  });
  await audit({ category: 'Security', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: 'Identity key rotated' });
  return json({ account: await accountView(updated) });
});
