import { json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { listPasskeys, removePasskey } from '@/lib/server/passkeys';

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { account } = await requireAccount(req);
  await removePasskey(account, (await params).id);
  return json({ passkeys: await listPasskeys(account._id) });
});
