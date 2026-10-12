import { json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { walletView } from '@/lib/server/wallet';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json(await walletView(account));
});
