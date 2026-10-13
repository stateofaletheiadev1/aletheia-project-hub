import { json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { listPasskeys } from '@/lib/server/passkeys';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json({ passkeys: await listPasskeys(account._id) });
});
